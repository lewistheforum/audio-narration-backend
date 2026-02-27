import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppointmentRepository, AppointmentPackageRepository } from './repositories';
import { ClinicStaffInformationRepository, AccountRepository } from '../accounts/repositories';
import { AccountRole } from '../accounts/enums';
import { EmployeeScheduleRepository } from '../schedules/repositories/employee-schedule.repository';
import {
  QueryAppointmentDto,
  AppointmentResponseDto,
  PaginatedAppointmentResponseDto,
  CreateAppointmentDto,
  StaffCreateAppointmentDto,
  CancelAppointmentDto,
  RescheduleAppointmentDto,
  CheckInDto,
  AcceptAppointmentDto,
  DeclineAppointmentDto,
  UpdateAppointmentStatusDto,
  AppointmentDetailResponseDto,
  WorkHistoryQueryDto,
} from './dto';
import { MESSAGES } from 'src/common/message';
import { Appointment, AppointmentPackage, ServiceAppointment } from './entities';
import { AppointmentStatus } from './enums';

/**
 * Appointments Service
 *
 * Handles business logic for appointment management
 *
 * Features:
 * - Staff viewing clinic appointments
 * - Filtering by status and date
 * - Pagination support
 * - Doctor accepting appointments (PENDING → CONFIRMED)
 * - Doctor declining appointments (PENDING → CANCELLED)
 */
@Injectable()
export class AppointmentsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly appointmentRepository: AppointmentRepository,
    private readonly appointmentPackageRepository: AppointmentPackageRepository,
    private readonly clinicStaffRepository: ClinicStaffInformationRepository,
    private readonly employeeScheduleRepository: EmployeeScheduleRepository,
    private readonly accountRepository: AccountRepository,
  ) { }

  /**
   * Get all appointments for a clinic (Staff access)
   *
   * Staff can view all appointments of the clinic they work for
   *
   * @param staffAccountId - Staff account UUID
   * @param queryDto - Query parameters (filters, pagination)
   * @returns Paginated list of appointments
   * @throws NotFoundException if staff information not found
   */
  async getAppointmentsForStaff(
    staffAccountId: string,
    queryDto: QueryAppointmentDto,
  ): Promise<PaginatedAppointmentResponseDto> {
    // Get staff account to verify clinic access
    const staffAccount = await this.accountRepository.findAccountById(staffAccountId);

    if (!staffAccount || staffAccount.role !== AccountRole.CLINIC_STAFF || !staffAccount.parentId) {
      throw new NotFoundException(MESSAGES.failMessage.accountNotFound);
    }

    // Get clinic ID from staff's parent account (clinic manager)
    const clinicId = staffAccount.parentId;

    // Prepare filters
    const filters = {
      status: queryDto.status,
      appointmentDate: queryDto.appointmentDate,
    };

    // Query appointments with pagination
    const [appointments, total] =
      await this.appointmentRepository.findByClinicWithPagination(
        clinicId,
        filters,
        queryDto.page,
        queryDto.limit,
      );

    // Get appointment IDs
    const appointmentIds = appointments.map((apt) => apt._id);

    // Fetch services for all appointments
    const servicesMap =
      await this.appointmentPackageRepository.findServicesByAppointmentIds(
        appointmentIds,
      );

    // Fetch clinic rooms for all appointments
    const appointmentData = appointments.map((apt) => ({
      appointmentId: apt._id,
      doctorShiftHourId: apt.doctorShiftHourId,
      doctorId: apt.doctorId,
      appointmentDate: apt.appointmentDate,
    }));

    const clinicRoomsMap =
      await this.employeeScheduleRepository.findClinicRoomsForMultipleAppointments(
        appointmentData,
      );

    // Transform to response DTOs
    const data = appointments.map((appointment) => {
      const clinicRooms = clinicRoomsMap.get(appointment._id) || [];

      return this.transformToResponseDto(
        appointment,
        servicesMap.get(appointment._id),
        clinicRooms,
      );
    });

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / queryDto.limit);

    return {
      data,
      total,
      page: queryDto.page,
      limit: queryDto.limit,
      totalPages,
    };
  }

  /**
   * Create appointment by staff with services (Transaction)
   *
   * Staff creates appointment for existing patient with selected services.
   * This method performs database operations across 3 tables in a transaction:
   * 1. appointments - Main appointment record
   * 2. appointment_package - Payment package information
   * 3. service_appointments - Services included in the appointment
   *
   * @param staffAccountId - Staff account UUID (for authorization)
   * @param createDto - Appointment creation data with services
   * @returns Created appointment details
   * @throws NotFoundException if staff or patient not found
   * @throws BadRequestException if patient doesn't belong to staff's clinic
   * @throws ConflictException if appointment time conflict exists
   */
  async staffCreateAppointment(
    staffAccountId: string,
    createDto: StaffCreateAppointmentDto,
  ): Promise<AppointmentResponseDto> {
    // Get staff account to verify clinic access
    const staffAccount = await this.accountRepository.findAccountById(staffAccountId);

    if (!staffAccount || staffAccount.role !== AccountRole.CLINIC_STAFF || !staffAccount.parentId) {
      throw new NotFoundException(MESSAGES.failMessage.accountNotFound);
    }

    const clinicId = staffAccount.parentId;

    // Convert date strings to Date objects
    const appointmentDate = new Date(createDto.appointmentDate);
    const appointmentHour = new Date(createDto.appointmentHour);
    const extraHour = createDto.extraHour
      ? new Date(createDto.extraHour)
      : null;

    // Check for time conflicts
    const existingAppointments = await this.appointmentRepository.find({
      clinicId: clinicId,
      appointmentDate: appointmentDate,
      appointmentHour: appointmentHour,
      deletedAt: null,
      status: AppointmentStatus.PENDING,
    });

    if (existingAppointments.length > 0) {
      throw new ConflictException(
        MESSAGES.failMessage.appointmentTimeConflict ||
        'Thời gian hẹn này đã có người đặt. Vui lòng chọn thời gian khác.',
      );
    }

    // Execute transaction to create appointment + package + services
    return await this.dataSource.transaction(async (manager) => {
      // Query service prices to calculate total
      const serviceIds = createDto.services.map((s) => s.clinicServiceId);
      const servicePrices = await manager
        .createQueryBuilder()
        .select('config._id', 'id')
        .addSelect('config.price', 'price')
        .from('clinic_service_config', 'config')
        .where('config._id IN (:...serviceIds)', { serviceIds })
        .andWhere('config.clinic_id = :clinicId', { clinicId })
        .andWhere('config.is_active = :isActive', { isActive: true })
        .andWhere('config.deleted_at IS NULL')
        .getRawMany();

      // Validate all services exist and are active
      if (servicePrices.length !== serviceIds.length) {
        throw new BadRequestException(
          `One or more services not found or inactive for this clinic. Expected ${serviceIds.length} services, found ${servicePrices.length}`,
        );
      }

      // Calculate total amount from services
      const calculatedTotal = servicePrices.reduce(
        (sum, service) => sum + parseFloat(service.price),
        0,
      );

      // Use provided total or calculated total
      const finalTotal = createDto.total ?? calculatedTotal;

      // 1. Create appointment
      const appointment = manager.create(Appointment, {
        patientId: createDto.patientId,
        clinicId: clinicId,
        doctorId: createDto.doctorId || null,
        doctorShiftHourId: createDto.doctorShiftHourId || null,
        appointmentDate: appointmentDate,
        appointmentHour: appointmentHour,
        extraHour: extraHour,
        total: finalTotal,
        patientNote: createDto.patientNote || null,
        status: AppointmentStatus.PENDING,
        rejectReason: null,
      });

      const savedAppointment = await manager.save(Appointment, appointment);

      // 2. Create appointment package (always create to store services)
      // TransactionId can be null and updated later when payment is made
      const appointmentPackage = manager.create(AppointmentPackage, {
        appointmentId: savedAppointment._id,
        transactionId: createDto.transactionId || null,
        amount: finalTotal,
        status: createDto.paymentStatus || null,
        paymentType: createDto.paymentType || null,
      });

      const savedPackage = await manager.save(
        AppointmentPackage,
        appointmentPackage,
      );

      // 3. Create service appointments (always create to store selected services)
      const serviceAppointments = createDto.services.map((service) =>
        manager.create(ServiceAppointment, {
          clinicServiceId: service.clinicServiceId,
          appointmentPackageId: savedPackage._id,
        }),
      );

      await manager.save(ServiceAppointment, serviceAppointments);

      // Fetch complete appointment with relations for response
      const appointmentWithRelations =
        await manager.findOne(Appointment, {
          where: { _id: savedAppointment._id },
          relations: ['patient', 'clinic', 'doctor'],
        });

      return this.transformToResponseDto(appointmentWithRelations!);
    });
  }

  /**
   * Create a new appointment
   *
   * @param createDto - Appointment creation data
   * @returns Created appointment details
   * @throws BadRequestException if appointment time conflict exists
   */
  async createAppointment(
    createDto: CreateAppointmentDto,
  ): Promise<AppointmentResponseDto> {
    // Convert date strings to Date objects
    const appointmentDate = new Date(createDto.appointmentDate);
    const appointmentHour = new Date(createDto.appointmentHour);
    const extraHour = createDto.extraHour ? new Date(createDto.extraHour) : null;

    // Check for time conflicts - same clinic, same date, same hour
    const existingAppointments = await this.appointmentRepository.find({
      clinicId: createDto.clinicId,
      appointmentDate: appointmentDate,
      appointmentHour: appointmentHour,
      deletedAt: null,
      status: AppointmentStatus.PENDING,
    });

    if (existingAppointments.length > 0) {
      throw new ConflictException(
        'Thời gian hẹn này đã có người đặt. Vui lòng chọn thời gian khác.',
      );
    }

    // Create appointment entity
    const appointment = this.appointmentRepository.create({
      patientId: createDto.patientId,
      clinicId: createDto.clinicId,
      doctorId: createDto.doctorId || null,
      doctorShiftHourId: createDto.doctorShiftHourId || null,
      appointmentDate: appointmentDate,
      appointmentHour: appointmentHour,
      extraHour: extraHour,
      total: createDto.total,
      patientNote: createDto.patientNote || null,
      status: AppointmentStatus.PENDING,
      rejectReason: null,
    });

    // Save to database
    const savedAppointment = await this.appointmentRepository.save(appointment);

    // Fetch with relations for response
    const appointmentWithRelations =
      await this.appointmentRepository.findByIdWithRelations(
        savedAppointment._id,
      );

    if (!appointmentWithRelations) {
      throw new NotFoundException('Không thể tải thông tin lịch hẹn vừa tạo.');
    }

    return this.transformToResponseDto(appointmentWithRelations);
  }

  /**
   * Cancel an appointment
   *
   * @param appointmentId - Appointment UUID
   * @param cancelDto - Cancellation data (reject reason)
   * @returns Updated appointment details
   * @throws NotFoundException if appointment not found
   * @throws BadRequestException if appointment cannot be cancelled
   */
  async cancelAppointment(
    appointmentId: string,
    cancelDto: CancelAppointmentDto,
  ): Promise<AppointmentResponseDto> {
    // Find appointment with relations
    const appointment =
      await this.appointmentRepository.findByIdWithRelations(appointmentId);

    if (!appointment || appointment.deletedAt) {
      throw new NotFoundException('Không tìm thấy lịch hẹn.');
    }

    // Check if appointment can be cancelled
    const cancellableStatuses = [
      AppointmentStatus.PENDING,
      AppointmentStatus.CONFIRMED,
      AppointmentStatus.AWAITING_PAYMENT,
    ];

    if (!cancellableStatuses.includes(appointment.status)) {
      throw new BadRequestException(
        `Không thể hủy lịch hẹn với trạng thái "${appointment.status}".`,
      );
    }

    // Update appointment
    appointment.status = AppointmentStatus.CANCELLED;
    appointment.rejectReason = cancelDto.rejectReason;

    // Save changes
    const updatedAppointment =
      await this.appointmentRepository.save(appointment);

    return this.transformToResponseDto(updatedAppointment);
  }

  /**
   * Reschedule an appointment
   *
   * @param appointmentId - Appointment UUID
   * @param rescheduleDto - Reschedule data (new date and shift hour)
   * @returns Updated appointment details
   * @throws NotFoundException if appointment not found
   * @throws BadRequestException if appointment cannot be rescheduled
   * @throws ConflictException if new time slot is already booked
   */
  async rescheduleAppointment(
    appointmentId: string,
    rescheduleDto: RescheduleAppointmentDto,
  ): Promise<AppointmentResponseDto> {
    // Find appointment with relations
    const appointment =
      await this.appointmentRepository.findByIdWithRelations(appointmentId);

    if (!appointment || appointment.deletedAt) {
      throw new NotFoundException('Không tìm thấy lịch hẹn.');
    }

    // Check if appointment can be rescheduled
    const reschedulableStatuses = [
      AppointmentStatus.PENDING,
      AppointmentStatus.CONFIRMED,
    ];

    if (!reschedulableStatuses.includes(appointment.status)) {
      throw new BadRequestException(
        `Không thể đổi lịch hẹn với trạng thái "${appointment.status}".`,
      );
    }

    // Convert new date to Date object
    const newAppointmentDate = new Date(rescheduleDto.appointmentDate);

    // Check for conflicts if rescheduling to a different time
    const dateChanged = newAppointmentDate.getTime() !== appointment.appointmentDate.getTime();
    const shiftChanged = rescheduleDto.doctorShiftHourId !== appointment.doctorShiftHourId;

    if (dateChanged || shiftChanged) {
      // Build conflict check conditions
      const conflictWhere: any = {
        clinicId: appointment.clinicId,
        appointmentDate: newAppointmentDate,
        deletedAt: null,
      };

      // If shift hour is provided, check for that specific shift
      if (rescheduleDto.doctorShiftHourId) {
        conflictWhere.doctorShiftHourId = rescheduleDto.doctorShiftHourId;
      }

      const existingAppointments = await this.appointmentRepository.find(conflictWhere);

      // Filter out the current appointment from conflicts
      const conflicts = existingAppointments.filter(
        (appt) => appt._id !== appointmentId,
      );

      if (conflicts.length > 0) {
        throw new ConflictException(
          'Thời gian mới này đã có người đặt. Vui lòng chọn thời gian khác.',
        );
      }
    }

    // Update appointment with new schedule
    appointment.appointmentDate = newAppointmentDate;

    if (rescheduleDto.doctorShiftHourId !== undefined) {
      appointment.doctorShiftHourId = rescheduleDto.doctorShiftHourId || null;
    }

    // Save changes
    const updatedAppointment =
      await this.appointmentRepository.save(appointment);

    return this.transformToResponseDto(updatedAppointment);
  }

  /**
   * Check in patient for appointment
   *
   * Changes appointment status to CHECKED_IN when patient arrives at clinic
   * Accepts both PENDING and CONFIRMED appointments
   *
   * @param appointmentId - Appointment UUID
   * @param checkInDto - Empty DTO (for future extensibility)
   * @returns Updated appointment details
   * @throws NotFoundException if appointment not found
   * @throws BadRequestException if appointment status is not PENDING or CONFIRMED
   */
  async checkInPatient(
    appointmentId: string,
    checkInDto: CheckInDto,
  ): Promise<AppointmentResponseDto> {
    // Find appointment with relations
    const appointment =
      await this.appointmentRepository.findByIdWithRelations(appointmentId);

    if (!appointment || appointment.deletedAt) {
      throw new NotFoundException('Appointment not found.');
    }

    // Validate current status - only PENDING or CONFIRMED appointments can be checked in
    if (
      appointment.status !== AppointmentStatus.PENDING &&
      appointment.status !== AppointmentStatus.CONFIRMED
    ) {
      throw new BadRequestException(
        `Cannot check in appointment with status "${appointment.status}". Only pending (PENDING) or confirmed (CONFIRMED) appointments can be checked in.`,
      );
    }

    // Update status to CHECKED_IN
    appointment.status = AppointmentStatus.CHECKED_IN;

    // Save changes
    const updatedAppointment =
      await this.appointmentRepository.save(appointment);

    return this.transformToResponseDto(updatedAppointment);
  }

  /**
   * Accept appointment (Staff/Doctor)
   *
   * Allows clinic staff or doctor to accept a pending appointment
   * Changes status from PENDING to CONFIRMED
   *
   * @param appointmentId - Appointment UUID
   * @param userAccountId - User's account UUID (staff or doctor)
   * @param acceptDto - Empty DTO (for future extensibility)
   * @returns Updated appointment details
   * @throws NotFoundException if appointment not found
   * @throws BadRequestException if appointment status is not PENDING
   *
   * @example
   * const appointment = await this.appointmentsService.acceptAppointment(
   *   appointmentId,
   *   userId,
   *   {}
   * );
   */
  async acceptAppointment(
    appointmentId: string,
    userAccountId: string,
    acceptDto: AcceptAppointmentDto,
  ): Promise<AppointmentResponseDto> {
    // Find appointment with relations
    const appointment =
      await this.appointmentRepository.findByIdWithRelations(appointmentId);

    if (!appointment || appointment.deletedAt) {
      throw new NotFoundException(MESSAGES.failMessage.appointmentNotFound);
    }

    // Validate current status - only PENDING appointments can be accepted
    if (appointment.status !== AppointmentStatus.PENDING) {
      throw new BadRequestException(
        MESSAGES.failMessage.appointmentCannotBeAccepted,
      );
    }

    // Update status to CONFIRMED
    appointment.status = AppointmentStatus.CONFIRMED;

    // Save changes
    const updatedAppointment =
      await this.appointmentRepository.save(appointment);

    return this.transformToResponseDto(updatedAppointment);
  }

  /**
   * Decline appointment (Staff/Doctor)
   *
   * Allows clinic staff or doctor to decline a pending appointment
   * Changes status from PENDING to CANCELLED with reject reason
   *
   * @param appointmentId - Appointment UUID
   * @param userAccountId - User's account UUID (staff or doctor)
   * @param declineDto - Reject reason (required)
   * @returns Updated appointment details
   * @throws NotFoundException if appointment not found
   * @throws BadRequestException if appointment status is not PENDING
   *
   * @example
   * const appointment = await this.appointmentsService.declineAppointment(
   *   appointmentId,
   *   userId,
   *   { rejectReason: 'Clinic is fully booked on this date' }
   * );
   */
  async declineAppointment(
    appointmentId: string,
    userAccountId: string,
    declineDto: DeclineAppointmentDto,
  ): Promise<AppointmentResponseDto> {
    // Find appointment with relations
    const appointment =
      await this.appointmentRepository.findByIdWithRelations(appointmentId);

    if (!appointment || appointment.deletedAt) {
      throw new NotFoundException(MESSAGES.failMessage.appointmentNotFound);
    }

    // Validate current status - only PENDING appointments can be declined
    if (appointment.status !== AppointmentStatus.PENDING) {
      throw new BadRequestException(
        MESSAGES.failMessage.appointmentCannotBeDeclined,
      );
    }

    // Update status to CANCELLED with reject reason
    appointment.status = AppointmentStatus.CANCELLED;
    appointment.rejectReason = declineDto.rejectReason;

    // Save changes
    const updatedAppointment =
      await this.appointmentRepository.save(appointment);

    return this.transformToResponseDto(updatedAppointment);
  }

  /**
   * Update appointment status (Generic - Admin/Staff)
   *
   * Allows admin or staff to manually change appointment status to any valid state
   * Validates status transitions and enforces business rules
   *
   * @param appointmentId - Appointment UUID
   * @param updateStatusDto - New status and optional reason
   * @returns Updated appointment details
   * @throws NotFoundException if appointment not found
   * @throws BadRequestException if status transition is invalid or reason is missing
   *
   * @example
   * // Change to CONFIRMED
   * await this.appointmentsService.updateAppointmentStatus(
   *   appointmentId,
   *   { status: AppointmentStatus.CONFIRMED }
   * );
   *
   * // Change to CANCELLED with reason
   * await this.appointmentsService.updateAppointmentStatus(
   *   appointmentId,
   *   { status: AppointmentStatus.CANCELLED, reason: 'Patient requested' }
   * );
   */
  async updateAppointmentStatus(
    appointmentId: string,
    updateStatusDto: UpdateAppointmentStatusDto,
  ): Promise<AppointmentResponseDto> {
    // Find appointment with relations
    const appointment =
      await this.appointmentRepository.findByIdWithRelations(appointmentId);

    if (!appointment || appointment.deletedAt) {
      throw new NotFoundException(MESSAGES.failMessage.appointmentNotFound);
    }

    // Validate status transitions (business rules)
    this.validateStatusTransition(
      appointment.status,
      updateStatusDto.status,
    );

    // Validate reason for certain statuses
    const statusesRequiringReason = [
      AppointmentStatus.CANCELLED,
      AppointmentStatus.PAYMENT_FAILED,
      AppointmentStatus.PAYMENT_CANCELLED,
      AppointmentStatus.ABSENT,
    ];

    if (
      statusesRequiringReason.includes(updateStatusDto.status) &&
      !updateStatusDto.reason
    ) {
      throw new BadRequestException(
        MESSAGES.failMessage.reasonRequiredForStatus,
      );
    }

    // Update appointment status
    appointment.status = updateStatusDto.status;

    // Update reject reason if provided
    if (updateStatusDto.reason) {
      appointment.rejectReason = updateStatusDto.reason;
    }

    // Save changes
    const updatedAppointment =
      await this.appointmentRepository.save(appointment);

    return this.transformToResponseDto(updatedAppointment);
  }

  /**
   * Validate status transition
   *
   * Checks if a status change is allowed based on current status
   * Prevents invalid transitions (e.g., COMPLETED → PENDING)
   *
   * @param currentStatus - Current appointment status
   * @param newStatus - Target status
   * @throws BadRequestException if transition is invalid
   */
  private validateStatusTransition(
    currentStatus: AppointmentStatus,
    newStatus: AppointmentStatus,
  ): void {
    // Same status - no change needed
    if (currentStatus === newStatus) {
      return;
    }

    // Define invalid transitions (terminal states that cannot be changed)
    const terminalStatuses = [
      AppointmentStatus.COMPLETED,
      AppointmentStatus.ABSENT,
    ];

    // Cannot change from terminal statuses
    if (terminalStatuses.includes(currentStatus)) {
      throw new BadRequestException(
        `Cannot change status from ${currentStatus}. This is a terminal state.`,
      );
    }

    // Define valid transitions from each status
    const validTransitions: Record<AppointmentStatus, AppointmentStatus[]> = {
      // Payment lifecycle
      [AppointmentStatus.AWAITING_PAYMENT]: [
        AppointmentStatus.PENDING,
        AppointmentStatus.PAYMENT_FAILED,
        AppointmentStatus.PAYMENT_CANCELLED,
        AppointmentStatus.PAYMENT_EXPIRED,
        AppointmentStatus.CANCELLED,
      ],
      [AppointmentStatus.PAYMENT_FAILED]: [
        AppointmentStatus.AWAITING_PAYMENT,
        AppointmentStatus.CANCELLED,
      ],
      [AppointmentStatus.PAYMENT_CANCELLED]: [
        AppointmentStatus.AWAITING_PAYMENT,
        AppointmentStatus.CANCELLED,
      ],
      [AppointmentStatus.PAYMENT_EXPIRED]: [
        AppointmentStatus.AWAITING_PAYMENT,
        AppointmentStatus.CANCELLED,
      ],

      // Appointment lifecycle
      [AppointmentStatus.PENDING]: [
        AppointmentStatus.CONFIRMED,
        AppointmentStatus.CANCELLED,
      ],
      [AppointmentStatus.CONFIRMED]: [
        AppointmentStatus.CHECKED_IN,
        AppointmentStatus.CANCELLED,
        AppointmentStatus.ABSENT,
        AppointmentStatus.PENDING, // Allow reverting to pending if needed
      ],

      // On-site workflow
      [AppointmentStatus.CHECKED_IN]: [
        AppointmentStatus.IN_PROGRESS,
        AppointmentStatus.CANCELLED,
        AppointmentStatus.ABSENT,
      ],
      [AppointmentStatus.IN_PROGRESS]: [
        AppointmentStatus.COMPLETED,
        AppointmentStatus.CANCELLED,
      ],

      // Terminal states (empty array - no transitions allowed)
      [AppointmentStatus.CANCELLED]: [
        AppointmentStatus.PENDING, // Allow re-opening if needed
        AppointmentStatus.AWAITING_PAYMENT, // Allow retry payment
      ],
      [AppointmentStatus.COMPLETED]: [],
      [AppointmentStatus.ABSENT]: [],
    };

    // Check if transition is valid
    const allowedStatuses = validTransitions[currentStatus] || [];

    if (!allowedStatuses.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot change status from ${currentStatus} to ${newStatus}. ${MESSAGES.failMessage.invalidStatusTransition}`,
      );
    }
  }

  /**
   * Transform Appointment entity to Response DTO
   *
   * @param appointment - Appointment entity with relations
   * @param services - Optional array of services for this appointment
   * @param clinicRooms - Optional array of clinic rooms for this appointment
   * @returns AppointmentResponseDto
   */
  private transformToResponseDto(
    appointment: any,
    services?: any[],
    clinicRooms?: any[],
  ): AppointmentResponseDto {
    // Get patient full name from raw query result or fallback to username
    const patientFullName =
      appointment.patientProfile_full_name ||
      appointment.patient?.username ||
      'N/A';

    // Get doctor full name from raw query result or fallback to username
    const doctorFullName =
      appointment.doctorProfile_full_name ||
      appointment.doctor?.username ||
      null;

    // Get clinic branch name from raw query result or fallback to username
    const clinicName =
      appointment.clinicProfile_clinic_branch_name ||
      appointment.clinic?.username ||
      'N/A';

    return {
      id: appointment._id,
      patientId: appointment.patientId,
      patientFullName,
      patientEmail: appointment.patient?.email,
      patientPhone: appointment.patient?.phone,
      clinicId: appointment.clinicId,
      clinicName,
      doctorId: appointment.doctorId,
      doctorFullName,
      clinicRooms: clinicRooms || [],
      services: services || [],
      appointmentDate: appointment.appointmentDate,
      appointmentHour: appointment.appointmentHour,
      extraHour: appointment.extraHour,
      total: parseFloat(appointment.total),
      status: appointment.status,
      patientNote: appointment.patientNote,
      rejectReason: appointment.rejectReason,
      createdAt: appointment.createdAt,
      updatedAt: appointment.updatedAt,
    };
  }

  /**
   * Get appointment details (Staff access)
   *
   * Retrieves complete appointment information including:
   * - Patient details with profile
   * - Doctor details with profile
   * - Clinic information
   * - Services and payment package
   *
   * @param appointmentId - Appointment UUID
   * @param staffAccountId - Staff account UUID (for authorization check)
   * @returns Complete appointment details
   * @throws NotFoundException if appointment not found or staff not authorized
   */
  async getAppointmentDetail(
    appointmentId: string,
    staffAccountId: string,
  ): Promise<AppointmentDetailResponseDto> {
    // Get staff account to verify clinic access
    const staffAccount =
      await this.accountRepository.findAccountById(staffAccountId);

    if (
      !staffAccount ||
      staffAccount.role !== AccountRole.CLINIC_STAFF ||
      !staffAccount.parentId
    ) {
      throw new NotFoundException(MESSAGES.failMessage.accountNotFound);
    }

    const clinicId = staffAccount.parentId;

    // Fetch appointment with complete details
    const appointment =
      await this.appointmentRepository.findByIdWithCompleteDetails(
        appointmentId,
      );

    if (!appointment || appointment.deletedAt) {
      throw new NotFoundException(MESSAGES.failMessage.appointmentNotFound);
    }

    // Verify appointment belongs to staff's clinic
    if (appointment.clinicId !== clinicId) {
      throw new ForbiddenException(
        'You can only view appointments of your clinic',
      );
    }

    // Fetch appointment package with services
    const appointmentPackage =
      await this.appointmentPackageRepository.findByAppointmentIdWithServices(
        appointmentId,
      );

    // Fetch clinic rooms (if doctor assigned)
    let clinicRooms: any[] = [];
    if (appointment.doctorId && appointment.appointmentDate && appointment.doctorShiftHourId) {
      const roomsMap =
        await this.employeeScheduleRepository.findClinicRoomsForMultipleAppointments([
          {
            appointmentId: appointment._id,
            doctorShiftHourId: appointment.doctorShiftHourId,
            doctorId: appointment.doctorId,
            appointmentDate: appointment.appointmentDate,
          },
        ]);
      clinicRooms = roomsMap.get(appointment._id) || [];
    }

    // Transform to response DTO
    return this.transformToDetailResponseDto(
      appointment,
      appointmentPackage,
      clinicRooms,
    );
  }

  /**
   * Transform Appointment entity to Detail Response DTO
   *
   * @param appointment - Appointment entity with all relations
   * @param appointmentPackage - AppointmentPackage with services
   * @param clinicRooms - Clinic rooms where doctor works
   * @returns AppointmentDetailResponseDto
   */
  private transformToDetailResponseDto(
    appointment: any,
    appointmentPackage: any,
    clinicRooms: any[],
  ): AppointmentDetailResponseDto {
    // Patient details from raw query result
    const patient = {
      id: appointment.patient?._id || appointment.patientId,
      username: appointment.patient?.username || 'N/A',
      email: appointment.patient?.email,
      phone: appointment.patient?.phone,
      fullName: appointment.patientProfile_full_name,
      gender: appointment.patientProfile_gender,
      dob: appointment.patientProfile_dob,
      profilePicture: appointment.patientProfile_profile_picture,
    };

    // Doctor details from raw query result (if assigned)
    let doctor = null;
    if (appointment.doctor) {
      doctor = {
        id: appointment.doctor._id,
        username: appointment.doctor.username,
        email: appointment.doctor.email,
        phone: appointment.doctor.phone,
        fullName: appointment.doctorProfile_full_name,
        gender: appointment.doctorProfile_gender,
        dob: appointment.doctorProfile_dob,
        profilePicture: appointment.doctorProfile_profile_picture,
        academicDegree: appointment.doctorProfile_academic_degree,
        experience: appointment.doctorProfile_experience,
        position: appointment.doctorProfile_position,
      };
    }

    // Shift hour details (if assigned)
    let shiftHour = null;
    if (appointment.doctorShiftHour) {
      shiftHour = {
        id: appointment.doctorShiftHour._id,
        startHour: appointment.doctorShiftHour.startHour,
        endHour: appointment.doctorShiftHour.endHour,
        limit: appointment.doctorShiftHour.limit,
        shiftType: appointment.doctorShiftHour.shift?.shift,
      };
    }

    // Package and services details
    let packageData = null;
    if (appointmentPackage) {
      const services =
        appointmentPackage.clinicService?.map((cs: any) => ({
          id: cs._id,
          serviceName: cs.service?.serviceName || 'N/A',
          description: cs.service?.description,
          price: parseFloat(cs.price || 0),
          duration: cs.duration,
        })) || [];

      packageData = {
        id: appointmentPackage._id,
        transactionId: appointmentPackage.transactionId,
        amount: parseFloat(appointmentPackage.amount || 0),
        status: appointmentPackage.status,
        paymentType: appointmentPackage.paymentType,
        services,
      };
    }

    return {
      id: appointment._id,
      patient,
      doctor,
      clinicId: appointment.clinicId,
      clinicName: appointment.clinic?.username || 'N/A',
      appointmentDate: appointment.appointmentDate,
      appointmentHour: appointment.appointmentHour,
      extraHour: appointment.extraHour,
      shiftHour,
      clinicRooms: clinicRooms.map((room) => ({
        id: room.id,
        roomName: room.roomName,
      })),
      total: parseFloat(appointment.total),
      status: appointment.status,
      isReminder: appointment.isRemider || false,
      patientNote: appointment.patientNote,
      rejectReason: appointment.rejectReason,
      package: packageData,
      createdAt: appointment.createdAt,
      updatedAt: appointment.updatedAt,
    };
  }

  /**
   * Get work history of a doctor
   */
  async getDoctorWorkHistory(
    userAccountId: string,
    doctorId: string,
    queryDto: WorkHistoryQueryDto,
  ): Promise<PaginatedAppointmentResponseDto> {
    const userAccount = await this.accountRepository.findAccountById(userAccountId);
    if (!userAccount) {
      throw new NotFoundException(MESSAGES.failMessage.accountNotFound);
    }

    const query = this.appointmentRepository
      .createQueryBuilder('appointment')
      .leftJoinAndSelect('appointment.patient', 'patient')
      .leftJoinAndSelect('appointment.clinic', 'clinic')
      .where('appointment.doctorId = :doctorId', { doctorId })
      .andWhere('appointment.deletedAt IS NULL');

    // Filter by clinic based on user role (Manager uses parentId too)
    const clinicId = userAccount.parentId || (userAccount.role === AccountRole.CLINIC_MANAGER ? userAccount._id : undefined);
    if (clinicId) {
      query.andWhere('appointment.clinicId = :clinicId', { clinicId });
    }

    if (queryDto.fromDate) {
      query.andWhere('appointment.appointmentDate >= :fromDate', { fromDate: queryDto.fromDate });
    }

    if (queryDto.toDate) {
      query.andWhere('appointment.appointmentDate <= :toDate', { toDate: queryDto.toDate });
    }

    if (queryDto.status) {
      query.andWhere('appointment.status = :status', { status: queryDto.status });
    }

    query.orderBy('appointment.appointmentDate', 'DESC');
    query.addOrderBy('appointment.appointmentHour', 'DESC');

    const total = await query.getCount();

    // pagination
    const page = queryDto.page || 1;
    const limit = queryDto.limit || 10;
    const skip = (page - 1) * limit;

    query.skip(skip).take(limit);

    const appointments = await query.getMany();

    const data = appointments.map((appointment) =>
      this.transformToResponseDto(appointment),
    );

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Export doctor work history to CSV
   */
  async exportDoctorWorkHistoryCSV(
    userAccountId: string,
    doctorId: string,
    queryDto: WorkHistoryQueryDto,
  ): Promise<string> {
    const userAccount = await this.accountRepository.findAccountById(userAccountId);
    if (!userAccount) {
      throw new NotFoundException(MESSAGES.failMessage.accountNotFound);
    }

    const query = this.appointmentRepository
      .createQueryBuilder('appointment')
      .leftJoinAndSelect('appointment.patient', 'patient')
      .leftJoinAndSelect('appointment.clinic', 'clinic')
      .where('appointment.doctorId = :doctorId', { doctorId })
      .andWhere('appointment.deletedAt IS NULL');

    // Filter by clinic based on user role (Manager uses parentId too)
    const clinicId = userAccount.parentId || (userAccount.role === AccountRole.CLINIC_MANAGER ? userAccount._id : undefined);
    if (clinicId) {
      query.andWhere('appointment.clinicId = :clinicId', { clinicId });
    }

    if (queryDto.fromDate) {
      query.andWhere('appointment.appointmentDate >= :fromDate', { fromDate: queryDto.fromDate });
    }

    if (queryDto.toDate) {
      query.andWhere('appointment.appointmentDate <= :toDate', { toDate: queryDto.toDate });
    }

    if (queryDto.status) {
      query.andWhere('appointment.status = :status', { status: queryDto.status });
    }

    query.orderBy('appointment.appointmentDate', 'DESC');
    query.addOrderBy('appointment.appointmentHour', 'DESC');

    const appointments = await query.getMany();

    const headers = ['Mã Ca Khám', 'Bệnh Nhân', 'Phòng Khám', 'Ngày Khám', 'Giờ Khám', 'Trạng Thái', 'Ghi Chú', 'Doanh Thu (VNĐ)'];

    const rows = appointments.map(app => {
      const patientName = app.patient?.username || app.patientId;
      const clinicName = app.clinic?.username || app.clinicId;
      const date = new Date(app.appointmentDate).toISOString().split('T')[0];
      const time = new Date(app.appointmentHour).toLocaleTimeString('vi-VN');
      const note = app.patientNote?.replace(/,/g, ' ') || '';
      const amount = app.total || 0;

      return [
        app._id,
        patientName,
        clinicName,
        date,
        time,
        app.status,
        note,
        amount
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }
}
