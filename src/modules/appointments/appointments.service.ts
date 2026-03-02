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
  QueryDoctorAppointmentDto,
  DoctorAppointmentListResponseDto,
  DoctorAppointmentItemDto,
  ServiceSummaryDto,
  DoctorAppointmentDetailResponseDto,
  PatientInfoDto,
  PendingServicesResponseDto,
  PendingServiceItemDto,
  CompleteExaminationDto,
  CompleteExaminationResponseDto,
} from './dto';
import { MESSAGES } from 'src/common/message';
import { Appointment, AppointmentPackage, ServiceAppointment } from './entities';
import { AppointmentStatus } from './enums';
import { ERMRecordType, ERMStatus } from '../prescriptions/enums';
import { ERM } from '../prescriptions/entities/erm.entity';
import { EPrescription } from '../prescriptions/entities/e-prescription.entity';

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
  ) {}

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
      throw new NotFoundException('Unable to load appointment information');
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
      throw new NotFoundException('Appointment not found');
    }

    // Check if appointment can be cancelled
    const cancellableStatuses = [
      AppointmentStatus.PENDING,
      AppointmentStatus.CONFIRMED,
      AppointmentStatus.AWAITING_PAYMENT,
    ];

    if (!cancellableStatuses.includes(appointment.status)) {
      throw new BadRequestException(
        `Cannot cancel appointment with status "${appointment.status}"`,
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
      throw new NotFoundException('Appointment not found');
    }

    // Check if appointment can be rescheduled
    const reschedulableStatuses = [
      AppointmentStatus.PENDING,
      AppointmentStatus.CONFIRMED,
    ];

    if (!reschedulableStatuses.includes(appointment.status)) {
      throw new BadRequestException(
        `Cannot reschedule appointment with status "${appointment.status}"`,
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
   * Get list of doctor's appointments (Step 1)
   *
   * Retrieves appointments assigned to the doctor with optional filtering
   * by date and status. Only shows appointments where doctor can take action.
   *
   * @param doctorId - ID of the authenticated doctor
   * @param queryDto - Query parameters (date, status)
   * @returns List of appointments with services and ERM status
   *
   * Business Rules:
   * - Only show appointments assigned to this doctor (doctor_id matches)
   * - Filter by date and status if provided
   * - Show CHECKED_IN and IN_PROGRESS appointments by default
   * - Include all services with ERM status for each appointment
   * - Include transaction_id to determine payment status
   */
  async getDoctorAppointments(
    doctorId: string,
    queryDto: QueryDoctorAppointmentDto,
  ): Promise<DoctorAppointmentListResponseDto> {
    const queryBuilder = this.dataSource
      .getRepository(Appointment)
      .createQueryBuilder('appointment')
      .leftJoinAndSelect('appointment.patient', 'patient')
      .leftJoinAndSelect('patient.generalAccount', 'generalAccount')
      .where('appointment.doctor_id = :doctorId', { doctorId })
      .andWhere('appointment.deleted_at IS NULL');

    // Filter by date if provided
    if (queryDto.date) {
      queryBuilder.andWhere('appointment.appointment_date = :date', {
        date: queryDto.date,
      });
    }

    // Filter by status if provided, otherwise default to CHECKED_IN and IN_PROGRESS
    if (queryDto.status) {
      queryBuilder.andWhere('appointment.status = :status', {
        status: queryDto.status,
      });
    } else {
      queryBuilder.andWhere('appointment.status IN (:...statuses)', {
        statuses: [AppointmentStatus.CHECKED_IN, AppointmentStatus.IN_PROGRESS],
      });
    }

    // Order by appointment hour
    queryBuilder.orderBy('appointment.appointment_hour', 'ASC');

    const appointments = await queryBuilder.getMany();

    // If no appointments found, return empty array
    if (appointments.length === 0) {
      return {
        appointments: [],
      };
    }

    // Get transaction_id for each appointment
    const appointmentIds = appointments.map((apt) => apt._id);
    const appointmentPackages = await this.dataSource
      .getRepository(AppointmentPackage)
      .createQueryBuilder('pkg')
      .where('pkg.appointment_id IN (:...appointmentIds)', { appointmentIds })
      .getMany();

    const transactionMap = new Map<string, string | null>();
    appointmentPackages.forEach((pkg) => {
      transactionMap.set(pkg.appointmentId, pkg.transactionId || null);
    });

    // Get services for each appointment
    const appointmentItems: DoctorAppointmentItemDto[] = [];

    for (const appointment of appointments) {
      const services = await this.getAppointmentServices(appointment._id);

      appointmentItems.push({
        appointmentId: appointment._id,
        patientId: appointment.patientId,
        patientName:
          appointment.patient?.generalAccount?.fullName || 'Unknown Patient',
        appointmentDate: this.formatDate(appointment.appointmentDate),
        appointmentHour: appointment.appointmentHour,
        clinicId: appointment.clinicId,
        doctorShiftHourId: appointment.doctorShiftHourId,
        services,
        status: appointment.status,
        transactionId: transactionMap.get(appointment._id) || null,
      });
    }

    return {
      appointments: appointmentItems,
    };
  }

  /**
   * Get appointment detail for doctor (Step 2)
   *
   * Retrieves complete appointment information including patient details
   * and all services. Automatically updates status from CHECKED_IN to IN_PROGRESS
   * when doctor first accesses the appointment.
   *
   * @param appointmentId - UUID of the appointment
   * @param doctorId - ID of the authenticated doctor
   * @returns Complete appointment details with patient info and services
   * @throws NotFoundException if appointment not found
   * @throws ForbiddenException if appointment not assigned to this doctor
   *
   * Business Rules:
   * - Verify appointment belongs to the authenticated doctor
   * - Auto-update status from CHECKED_IN → IN_PROGRESS when accessed
   * - Load patient information from generalAccount
   * - Load all services with ERM status
   * - Return detailed patient information (including medical history if available)
   */
  async getAppointmentDetailForDoctor(
    appointmentId: string,
    doctorId: string,
  ): Promise<DoctorAppointmentDetailResponseDto> {
    // Find appointment with relations
    const appointment = await this.dataSource
      .getRepository(Appointment)
      .createQueryBuilder('appointment')
      .leftJoinAndSelect('appointment.patient', 'patient')
      .leftJoinAndSelect('patient.generalAccount', 'generalAccount')
      .where('appointment._id = :appointmentId', { appointmentId })
      .andWhere('appointment.deleted_at IS NULL')
      .getOne();

    if (!appointment) {
      throw new NotFoundException(MESSAGES.failMessage.appointmentNotFound);
    }

    // Verify appointment belongs to this doctor
    if (appointment.doctorId !== doctorId) {
      throw new ForbiddenException(
        'You do not have permission to view this appointment',
      );
    }

    // Auto-update status from CHECKED_IN to IN_PROGRESS
    let statusMessage: string | undefined;
    if (appointment.status === AppointmentStatus.CHECKED_IN) {
      appointment.status = AppointmentStatus.IN_PROGRESS;
      await this.dataSource.getRepository(Appointment).save(appointment);
      statusMessage = 'Appointment status updated to IN_PROGRESS';
    }

    // Get services
    const services = await this.getAppointmentServices(appointmentId);

    // Build patient info
    const patientInfo: PatientInfoDto = {
      patientId: appointment.patientId,
      fullName: appointment.patient?.generalAccount?.fullName || 'Unknown',
      dateOfBirth: appointment.patient?.generalAccount?.dob
        ? this.formatDate(appointment.patient.generalAccount.dob)
        : null,
      gender: appointment.patient?.generalAccount?.gender || null,
      phone: appointment.patient?.phone || null,
      email: appointment.patient?.email || 'No email',
      medicalHistory: null, // TODO: Get from medical history if available
    };

    return {
      appointmentId: appointment._id,
      patient: patientInfo,
      appointmentDate: this.formatDate(appointment.appointmentDate),
      appointmentHour: appointment.appointmentHour,
      services,
      patientNote: appointment.patientNote,
      status: appointment.status,
      message: statusMessage,
    };
  }

  /**
   * Get services for an appointment with ERM status
   *
   * Helper method to retrieve all services associated with an appointment
   * and check if each service has an ERM record
   *
   * @param appointmentId - UUID of the appointment
   * @returns Array of service summaries with ERM status
   * @private
   */
  private async getAppointmentServices(
    appointmentId: string,
  ): Promise<ServiceSummaryDto[]> {
    // Get appointment package
    const appointmentPackage = await this.dataSource
      .getRepository(AppointmentPackage)
      .createQueryBuilder('pkg')
      .where('pkg.appointment_id = :appointmentId', { appointmentId })
      .andWhere('pkg.deleted_at IS NULL')
      .getOne();

    if (!appointmentPackage) {
      return [];
    }

    // Get service appointments
    const serviceAppointments = await this.dataSource
      .getRepository(ServiceAppointment)
      .createQueryBuilder('sa')
      .leftJoinAndSelect('sa.clinicService', 'clinicServiceConfig')
      .leftJoinAndSelect('clinicServiceConfig.service', 'clinicService')
      .leftJoinAndSelect('sa.erm', 'erm')
      .where('sa.appointment_package_id = :packageId', {
        packageId: appointmentPackage._id,
      })
      .andWhere('sa.deleted_at IS NULL')
      .getMany();

    // Map to ServiceSummaryDto
    return serviceAppointments.map((sa) => {
      // Determine service type from service_functions
      // Assuming service_functions contains the ERMRecordType
      const serviceFunctions =
        sa.clinicService?.service?.serviceFunctions || [];
      let serviceType: ERMRecordType = ERMRecordType.CONSULTATION; // Default

      // Try to match ERMRecordType from service_functions
      if (serviceFunctions.length > 0) {
        const matchedType = serviceFunctions.find((func) =>
          Object.values(ERMRecordType).includes(func as ERMRecordType),
        );
        if (matchedType) {
          serviceType = matchedType as ERMRecordType;
        }
      }

      return {
        serviceAppointmentId: sa._id,
        clinicServiceId: sa.clinicServiceId,
        serviceName: sa.clinicService?.service?.serviceName || 'Unknown Service',
        serviceType,
        hasErm: !!sa.erm,
        ermId: sa.erm?._id,
      };
    });
  }

  /**
   * Get pending services for an appointment (Step 6)
   *
   * Returns services that:
   * - Do not have ERM yet (pending_services)
   * - Have ERM with IN_PROGRESS status (in_progress_services)
   *
   * @param appointmentId - Appointment UUID
   * @param doctorId - Doctor UUID (for permission check)
   * @returns Pending and in-progress services
   * @throws NotFoundException if appointment not found
   * @throws ForbiddenException if doctor not assigned to appointment
   */
  async getPendingServices(
    appointmentId: string,
    doctorId: string,
  ): Promise<PendingServicesResponseDto> {
    // Find appointment
    const appointment = await this.dataSource
      .getRepository(Appointment)
      .createQueryBuilder('appointment')
      .where('appointment._id = :appointmentId', { appointmentId })
      .andWhere('appointment.deleted_at IS NULL')
      .getOne();

    if (!appointment) {
      throw new NotFoundException(MESSAGES.failMessage.appointmentNotFound);
    }

    // Verify doctor has permission
    if (appointment.doctorId !== doctorId) {
      throw new ForbiddenException('You do not have permission to access this appointment');
    }

    // Get appointment package
    const appointmentPackage = await this.dataSource
      .getRepository(AppointmentPackage)
      .findOne({
        where: {
          appointmentId: appointment._id,
        },
      });

    if (!appointmentPackage) {
      return {
        pendingServices: [],
        inProgressServices: [],
      };
    }

    // Get all service appointments with ERM data
    const serviceAppointments = await this.dataSource
      .getRepository(ServiceAppointment)
      .createQueryBuilder('sa')
      .leftJoinAndSelect('sa.clinicService', 'clinicServiceConfig')
      .leftJoinAndSelect('clinicServiceConfig.service', 'clinicService')
      .leftJoinAndSelect('sa.erm', 'erm')
      .where('sa.appointment_package_id = :packageId', {
        packageId: appointmentPackage._id,
      })
      .andWhere('sa.deleted_at IS NULL')
      .getMany();

    // Classify services
    const pendingServices: PendingServiceItemDto[] = [];
    const inProgressServices: PendingServiceItemDto[] = [];

    for (const sa of serviceAppointments) {
      // Determine service type from service_functions
      const serviceFunctions =
        sa.clinicService?.service?.serviceFunctions || [];
      let serviceType: ERMRecordType = ERMRecordType.CONSULTATION; // Default

      // Try to match ERMRecordType from service_functions
      if (serviceFunctions.length > 0) {
        const matchedType = serviceFunctions.find((func) =>
          Object.values(ERMRecordType).includes(func as ERMRecordType),
        );
        if (matchedType) {
          serviceType = matchedType as ERMRecordType;
        }
      }

      const serviceItem: PendingServiceItemDto = {
        serviceAppointmentId: sa._id,
        serviceName: sa.clinicService?.service?.serviceName || 'Unknown Service',
        serviceType,
        hasErm: !!sa.erm,
        ermId: sa.erm?._id || null,
        ermStatus: sa.erm?.status || null,
      };

      // Classify based on ERM status
      if (!sa.erm) {
        // No ERM -> pending
        pendingServices.push(serviceItem);
      } else if (sa.erm.status === ERMStatus.IN_PROGRESS) {
        // Has ERM with IN_PROGRESS status
        inProgressServices.push(serviceItem);
      }
      // Note: COMPLETED and DRAFT ERMs are not included in either list
    }

    return {
      pendingServices,
      inProgressServices,
    };
  }

  /**
   * Complete examination process
   *
   * Step 8 of ERM workflow - Complete all ERMs, lock prescription, determine appointment status
   *
   * Business Rules:
   * - Validate all service_appointments have ERM with IN_PROGRESS status
   * - Validate e_prescription exists if there's CONSULTATION ERM
   * - Change all ERMs from IN_PROGRESS to COMPLETED (immutable)
   * - Lock e_prescription (immutable)
   * - Determine appointment status based on payment logic
   *
   * @param appointmentId - Appointment ID
   * @param doctorId - Doctor ID from JWT
   * @returns CompleteExaminationResponseDto
   * @throws NotFoundException if appointment not found
   * @throws ForbiddenException if appointment doesn't belong to doctor
   * @throws BadRequestException if validation fails
   */
  async completeExamination(
    appointmentId: string,
    doctorId: string,
  ): Promise<CompleteExaminationResponseDto> {
    // 1. Find appointment and validate ownership
    const appointment = await this.dataSource
      .getRepository(Appointment)
      .createQueryBuilder('appointment')
      .where('appointment._id = :appointmentId', { appointmentId })
      .andWhere('appointment.deleted_at IS NULL')
      .getOne();

    if (!appointment) {
      throw new NotFoundException(MESSAGES.failMessage.appointmentNotFound);
    }

    if (appointment.doctorId !== doctorId) {
      throw new ForbiddenException(MESSAGES.failMessage.appointmentNotAssignedToDoctor);
    }

    // Check appointment status
    if (appointment.status !== AppointmentStatus.IN_PROGRESS) {
      throw new BadRequestException(
        'Can only complete examination when appointment status is IN_PROGRESS',
      );
    }

    // 2. Get appointment packages (to check transactionId and calculate prices)
    const appointmentPackages = await this.dataSource
      .getRepository(AppointmentPackage)
      .createQueryBuilder('pkg')
      .where('pkg.appointment_id = :appointmentId', { appointmentId })
      .andWhere('pkg.deleted_at IS NULL')
      .getMany();

    // 3. Get all service appointments with related data
    const serviceAppointments = await this.dataSource
      .getRepository(ServiceAppointment)
      .createQueryBuilder('sa')
      .leftJoinAndSelect('sa.erm', 'erm')
      .leftJoinAndSelect('sa.clinicService', 'clinicService')
      .innerJoin('sa.appointmentPackage', 'pkg')
      .where('pkg.appointment_id = :appointmentId', { appointmentId })
      .andWhere('sa.deleted_at IS NULL')
      .getMany();

    if (serviceAppointments.length === 0) {
      throw new BadRequestException('Appointment has no services');
    }

    // 4. Validate all service appointments have ERM
    const missingRequirements: string[] = [];

    for (const serviceAppointment of serviceAppointments) {
      if (!serviceAppointment.erm) {
        missingRequirements.push(
          `Service (ID: ${serviceAppointment.clinicServiceId}) does not have ERM`,
        );
      } else if (serviceAppointment.erm.status === ERMStatus.DRAFT) {
        missingRequirements.push(
          `ERM for service (ID: ${serviceAppointment.clinicServiceId}) has not saved data (status = DRAFT)`,
        );
      }
    }

    // 5. Check if there's CONSULTATION ERM, must have e_prescription
    const hasConsultationErm = serviceAppointments.some(
      (sa) => sa.erm?.recordType === ERMRecordType.CONSULTATION,
    );

    if (hasConsultationErm) {
      const ePrescription = await this.dataSource
        .getRepository(EPrescription)
        .createQueryBuilder('ep')
        .where('ep.appointment_id = :appointmentId', { appointmentId })
        .andWhere('ep.deleted_at IS NULL')
        .getOne();

      if (!ePrescription) {
        missingRequirements.push('E-prescription not created (required when there is consultation ERM)');
      }
    }

    // If there are missing requirements, throw error
    if (missingRequirements.length > 0) {
      throw new BadRequestException({
        message: 'Cannot complete examination',
        missingRequirements,
      });
    }

    // 6. Update all ERMs from IN_PROGRESS to COMPLETED
    const ermIds = serviceAppointments
      .filter((sa) => sa.erm && sa.erm.status === ERMStatus.IN_PROGRESS)
      .map((sa) => sa.erm._id);

    if (ermIds.length > 0) {
      await this.dataSource
        .getRepository(ERM)
        .createQueryBuilder()
        .update(ERM)
        .set({
          status: ERMStatus.COMPLETED,
          signedAt: new Date(),
          updatedAt: new Date(),
        })
        .where('_id IN (:...ermIds)', { ermIds })
        .execute();
    }

    // 7. Lock e_prescription (already immutable by virtue of appointment status change)
    // No specific action needed as we'll check appointment status when modifying prescription

    // 8. Determine payment logic and appointment status
    const appointmentStartTime = new Date(appointment.appointmentHour);

    // Identify additional services (created after appointment start time)
    const additionalServices = serviceAppointments.filter((sa) => {
      return new Date(sa.createdAt) > appointmentStartTime;
    });

    const hasAdditionalServices = additionalServices.length > 0;

    // Calculate additional amount
    let additionalAmount = 0;
    if (hasAdditionalServices) {
      for (const service of additionalServices) {
        const price = service.clinicService?.price || 0;
        additionalAmount += Number(price);
      }
    }

    // Determine if paid online (check if any package has transactionId)
    const hasPaidOnline = appointmentPackages.some((pkg) => pkg.transactionId !== null);

    // Determine appointment status and payment status
    let appointmentStatus: AppointmentStatus;
    let paymentStatus: 'PAID' | 'UNPAID' | 'PARTIAL';
    let nextStep: 'EXPORT_PRESCRIPTION' | 'PROCEED_TO_PAYMENT';

    if (hasPaidOnline && !hasAdditionalServices) {
      // CASE 1: Paid online + No additional services
      appointmentStatus = AppointmentStatus.COMPLETED;
      paymentStatus = 'PAID';
      nextStep = 'EXPORT_PRESCRIPTION';
    } else if (!hasPaidOnline && !hasAdditionalServices) {
      // CASE 2: Not paid online + No additional services
      appointmentStatus = AppointmentStatus.AWAITING_PAYMENT;
      paymentStatus = 'UNPAID';
      nextStep = 'PROCEED_TO_PAYMENT';
    } else {
      // CASE 3: Paid online + Has additional services
      appointmentStatus = AppointmentStatus.AWAITING_PAYMENT;
      paymentStatus = hasPaidOnline ? 'PARTIAL' : 'UNPAID';
      nextStep = 'PROCEED_TO_PAYMENT';
    }

    // 9. Update appointment status
    appointment.status = appointmentStatus;

    await this.dataSource.getRepository(Appointment).save(appointment);

    // 10. Get prescription info
    const ePrescription = await this.dataSource
      .getRepository(EPrescription)
      .createQueryBuilder('ep')
      .where('ep.appointment_id = :appointmentId', { appointmentId })
      .andWhere('ep.deleted_at IS NULL')
      .getOne();

    // 11. Build ERMs summary
    const ermsSummary = serviceAppointments
      .filter((sa) => sa.erm)
      .map((sa) => ({
        serviceName: `Service (${sa.clinicServiceId})`,
        ermId: sa.erm._id,
        status: 'COMPLETED',
      }));

    // 12. Return response
    return {
      appointmentId: appointment._id,
      appointmentStatus,
      paymentStatus,
      completedAt: new Date(), // Current timestamp as completion time
      ermsSummary,
      hasPrescription: !!ePrescription,
      ePrescriptionId: ePrescription?._id,
      hasAdditionalServices,
      additionalAmount,
      nextStep,
    };
  }

  /**
   * Format date to YYYY-MM-DD string
   *
   * Safely handles both Date objects and string dates
   *
   * @param date - Date object or string
   * @returns Formatted date string (YYYY-MM-DD)
   * @private
   */
  private formatDate(date: Date | string | null | undefined): string {
    if (!date) {
      return '';
    }

    // If already a string, check if it's in ISO format
    if (typeof date === 'string') {
      // If it's already in YYYY-MM-DD format, return as is
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return date;
      }
      // Otherwise, try to parse and format
      const parsedDate = new Date(date);
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate.toISOString().split('T')[0];
      }
      return date; // Return as is if can't parse
    }

    // If it's a Date object
    if (date instanceof Date && !isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }

    return '';
  }
}
