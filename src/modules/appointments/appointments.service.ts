import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { DataSource, IsNull } from 'typeorm';
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
  AddServiceDto,
  AddServiceResponseDto,
  WorkHistoryQueryDto,
} from './dto';
import { MESSAGES } from 'src/common/message';
import { Appointment, AppointmentPackage, ServiceAppointment } from './entities';
import { AppointmentStatus, AppointmentPackageStatus, PaymentType } from './enums';
import { ERMRecordType, ERMStatus } from '../prescriptions/enums';
import { ERM } from '../prescriptions/entities/erm.entity';
import { EPrescription } from '../prescriptions/entities/e-prescription.entity';
import { ClinicServiceConfig } from '../service-configs/entities/clinic-service-config.entity';
import { BookingSessionService } from './booking-session.service';

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
    private readonly bookingSessionService: BookingSessionService,
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
      clinicShiftHourId: apt.clinicShiftHourId,
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
        clinicShiftHourId: createDto.clinicShiftHourId || null,
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

      // Fetch services for the created appointment (use manager to ensure transaction visibility)
      const servicesRaw = await manager
        .createQueryBuilder()
        .select([
          'clinicService._id AS id',
          'clinicService.service_name AS serviceName',
          'clinicService.description AS description',
          'clinicServiceConfig.price AS price',
        ])
        .from('service_appointments', 'serviceAppointment')
        .innerJoin(
          'clinic_service_config',
          'clinicServiceConfig',
          'clinicServiceConfig._id = serviceAppointment.clinic_service_id',
        )
        .innerJoin(
          'clinic_services',
          'clinicService',
          'clinicService._id = clinicServiceConfig.service_id',
        )
        .where('serviceAppointment.appointment_package_id = :packageId', {
          packageId: savedPackage._id,
        })
        .andWhere('serviceAppointment.deleted_at IS NULL')
        .getRawMany();

      const services = servicesRaw.map((row) => ({
        id: row.id,
        serviceName: row.servicename,
        description: row.description,
        price: parseFloat(row.price),
      }));

      // Fetch clinic rooms if doctor shift is assigned
      let clinicRooms = [];

      if (savedAppointment.clinicShiftHourId) {
        const appointmentData = [{
          appointmentId: savedAppointment._id,
          clinicShiftHourId: savedAppointment.clinicShiftHourId,
          doctorId: savedAppointment.doctorId,
          appointmentDate: savedAppointment.appointmentDate,
        }];
        const clinicRoomsMap =
          await this.employeeScheduleRepository.findClinicRoomsForMultipleAppointments(
            appointmentData,
          );
        clinicRooms = clinicRoomsMap.get(savedAppointment._id) || [];
      }

      return this.transformToResponseDto(appointmentWithRelations!, services, clinicRooms);
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
      clinicShiftHourId: createDto.clinicShiftHourId || null,
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
    const shiftChanged = rescheduleDto.clinicShiftHourId !== appointment.clinicShiftHourId;

    if (dateChanged || shiftChanged) {
      // Build conflict check conditions
      const conflictWhere: any = {
        clinicId: appointment.clinicId,
        appointmentDate: newAppointmentDate,
        deletedAt: null,
      };

      // If shift hour is provided, check for that specific shift
      if (rescheduleDto.clinicShiftHourId) {
        conflictWhere.clinicShiftHourId = rescheduleDto.clinicShiftHourId;
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

    if (rescheduleDto.clinicShiftHourId !== undefined) {
      appointment.clinicShiftHourId = rescheduleDto.clinicShiftHourId || null;
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
        AppointmentStatus.NEED_FINAL_PAYMENT,
        AppointmentStatus.COMPLETED,
        AppointmentStatus.CANCELLED,
      ],

      // Payment and completion
      [AppointmentStatus.NEED_FINAL_PAYMENT]: [
        AppointmentStatus.COMPLETED, // After payment is settled
      ],

      // Terminal states (empty array - no transitions allowed)
      [AppointmentStatus.CANCELLED]: [
        AppointmentStatus.PENDING, // Allow re-opening if needed
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
    if (appointment.doctorId && appointment.appointmentDate && appointment.clinicShiftHourId) {
      const roomsMap =
        await this.employeeScheduleRepository.findClinicRoomsForMultipleAppointments([
          {
            appointmentId: appointment._id,
            clinicShiftHourId: appointment.clinicShiftHourId,
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
    if (appointment.clinicShiftHour) {
      shiftHour = {
        id: appointment.clinicShiftHour._id,
        startHour: appointment.clinicShiftHour.startHour,
        endHour: appointment.clinicShiftHour.endHour,
        limit: appointment.clinicShiftHour.limit,
        shiftType: appointment.clinicShiftHour.shift?.shift,
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
        clinicShiftHourId: appointment.clinicShiftHourId,
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

    // Determine payment status, appointment status, and next step
    let paymentStatus: 'PAID' | 'UNPAID' | 'PARTIAL';
    let nextStep: 'EXPORT_PRESCRIPTION' | 'PROCEED_TO_PAYMENT';
    let appointmentStatus: AppointmentStatus;

    if (hasPaidOnline && !hasAdditionalServices) {
      // CASE 1: Paid online + No additional services → Fully completed
      paymentStatus = 'PAID';
      nextStep = 'EXPORT_PRESCRIPTION';
      appointmentStatus = AppointmentStatus.COMPLETED;
    } else if (!hasPaidOnline && !hasAdditionalServices) {
      // CASE 2: Not paid online + No additional services → Need full payment
      paymentStatus = 'UNPAID';
      nextStep = 'PROCEED_TO_PAYMENT';
      appointmentStatus = AppointmentStatus.NEED_FINAL_PAYMENT;
    } else if (hasPaidOnline && hasAdditionalServices) {
      // CASE 3: Paid online + Has additional services → Need additional payment
      paymentStatus = 'PARTIAL';
      nextStep = 'PROCEED_TO_PAYMENT';
      appointmentStatus = AppointmentStatus.NEED_FINAL_PAYMENT;
    } else {
      // CASE 4: Not paid online + Has additional services → Need full payment (including additional)
      paymentStatus = 'UNPAID';
      nextStep = 'PROCEED_TO_PAYMENT';
      appointmentStatus = AppointmentStatus.NEED_FINAL_PAYMENT;
    }

    // 9. Update appointment status based on payment logic
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
      appointmentStatus: appointment.status, // COMPLETED or NEED_FINAL_PAYMENT based on payment logic
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
   * Add additional service to appointment during examination
   * 
   * This method allows doctors to add new services (e.g., X-ray, Lab tests) 
   * during the examination process. The service will be marked as "additional" 
   * and will require payment processing by clinic staff.
   * 
   * Business Rules:
   * 1. Only allowed when appointment status = IN_PROGRESS
   * 2. Service must not already exist in the appointment
   * 3. Service must belong to the current clinic
   * 4. Creates new AppointmentPackage with transactionId = null
   * 5. Creates new ServiceAppointment linked to the package
   * 6. Service is identified as additional by comparing createdAt with appointment start time
   * 
   * @param appointmentId - UUID of the appointment
   * @param doctorId - UUID of the doctor adding the service
   * @param clinicServiceId - UUID of the clinic service to add
   * @returns AddServiceResponseDto with created package and service details
   * @throws NotFoundException if appointment or service not found
   * @throws ForbiddenException if doctor not assigned to appointment
   * @throws BadRequestException if validation fails
   */
  async addServiceToAppointment(
    appointmentId: string,
    doctorId: string,
    clinicServiceId: string,
  ): Promise<AddServiceResponseDto> {
    // 1. Find and validate appointment
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

    // 2. Check appointment status must be IN_PROGRESS
    if (appointment.status !== AppointmentStatus.IN_PROGRESS) {
      throw new BadRequestException(
        'Can only add services when appointment status is IN_PROGRESS',
      );
    }

    // 3. Validate clinic service exists and get details with relations
    const clinicService = await this.dataSource
      .getRepository(ClinicServiceConfig)
      .createQueryBuilder('config')
      .leftJoinAndSelect('config.service', 'service')
      .leftJoinAndSelect('service.category', 'category')
      .where('config._id = :clinicServiceId', { clinicServiceId })
      .andWhere('config.deleted_at IS NULL')
      .andWhere('config.is_active = true')
      .getOne();

    if (!clinicService) {
      throw new NotFoundException('Clinic service not found or inactive');
    }

    // 4. Validate service belongs to the same clinic as appointment
    if (clinicService.clinicId !== appointment.clinicId) {
      throw new BadRequestException(
        'Service does not belong to the appointment clinic',
      );
    }

    // 5. Check if service already exists in this appointment
    const existingServices = await this.dataSource
      .getRepository(ServiceAppointment)
      .createQueryBuilder('sa')
      .innerJoin('sa.appointmentPackage', 'pkg')
      .where('pkg.appointment_id = :appointmentId', { appointmentId })
      .andWhere('sa.clinic_service_id = :clinicServiceId', { clinicServiceId })
      .andWhere('sa.deleted_at IS NULL')
      .getOne();

    if (existingServices) {
      throw new BadRequestException(
        'This service already exists in the appointment',
      );
    }

    // 6. Create new AppointmentPackage
    const appointmentPackage = this.dataSource
      .getRepository(AppointmentPackage)
      .create({
        appointmentId: appointment._id,
        amount: clinicService.price,
        transactionId: null, // Will be set by Clinic Staff during payment
        status: null,
        paymentType: null,
      });

    const savedPackage = await this.dataSource
      .getRepository(AppointmentPackage)
      .save(appointmentPackage);

    // 7. Create new ServiceAppointment
    const serviceAppointment = this.dataSource
      .getRepository(ServiceAppointment)
      .create({
        clinicServiceId: clinicServiceId,
        appointmentPackageId: savedPackage._id,
      });

    const savedServiceAppointment = await this.dataSource
      .getRepository(ServiceAppointment)
      .save(serviceAppointment);

    // 8. Get service type from category
    const serviceType = (clinicService.service?.category?.type || 'CONSULTATION') as ERMRecordType;

    // 9. Return response
    return {
      appointmentPackageId: savedPackage._id,
      serviceAppointmentId: savedServiceAppointment._id,
      appointmentId: appointment._id,
      clinicServiceId: clinicServiceId,
      serviceName: clinicService.service?.serviceName || 'Unknown Service',
      serviceType: serviceType,
      price: Number(clinicService.price),
      addedDuringExamination: true, // Always true for this method
      addedBy: doctorId,
      createdAt: savedServiceAppointment.createdAt,
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

    // appointments.clinic_id stores Admin ID
    // - CLINIC_ADMIN: filter by own _id
    // - CLINIC_MANAGER: filter by parentId (= Admin ID)
    let clinicId: string | undefined;
    if (userAccount.role === AccountRole.CLINIC_ADMIN) {
      clinicId = userAccount._id;
    } else if (userAccount.role === AccountRole.CLINIC_MANAGER) {
      clinicId = userAccount.parentId || undefined;
    }

    console.log(`[getDoctorWorkHistory] User details - ID: ${userAccount._id}, Role: ${userAccount.role}, ParentId: ${userAccount.parentId}`);
    console.log(`[getDoctorWorkHistory] Resolved clinicId for filtering: ${clinicId}`);

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

    console.log(`[getDoctorWorkHistory] Query parameters: doctorId=${doctorId}, clinicId=${clinicId}, fromDate=${queryDto.fromDate}, toDate=${queryDto.toDate}, status=${queryDto.status}`);
    console.log(`[getDoctorWorkHistory] Raw SQL Query: `, query.getSql());
    console.log(`[getDoctorWorkHistory] SQL Parameters: `, query.getParameters());

    const total = await query.getCount();
    console.log(`[getDoctorWorkHistory] Total appointments found: ${total}`);

    // pagination
    const page = queryDto.page || 1;
    const limit = queryDto.limit || 10;
    const skip = (page - 1) * limit;

    query.skip(skip).take(limit);

    const appointments = await query.getMany();

    // Get appointment IDs
    const appointmentIds = appointments.map((apt) => apt._id);

    // Fetch services for all appointments
    const servicesMap = appointmentIds.length > 0
      ? await this.appointmentPackageRepository.findServicesByAppointmentIds(appointmentIds)
      : new Map();

    // Fetch clinic rooms for all appointments
    const appointmentData = appointments.map((apt) => ({
      appointmentId: apt._id,
      clinicShiftHourId: apt.clinicShiftHourId,
      doctorId: apt.doctorId,
      appointmentDate: apt.appointmentDate,
    }));

    const clinicRoomsMap = appointmentIds.length > 0
      ? await this.employeeScheduleRepository.findClinicRoomsForMultipleAppointments(appointmentData)
      : new Map();

    // Transform to response DTOs
    const data = appointments.map((appointment) => {
      const clinicRooms = clinicRoomsMap.get(appointment._id) || [];
      return this.transformToResponseDto(
        appointment,
        servicesMap.get(appointment._id),
        clinicRooms,
      );
    });

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
   * Create appointment from Redis booking session (Option 1: Service-first)
   *
   * VERSION 4.0: This method now supports both COD and ONLINE payment methods.
   * 
   * Business Flow:
   * 1. Reading session data from Redis
   * 2. Validating all business rules and session completeness (including paymentMethod)
   * 3. Branching based on payment method:
   *    - COD: Create appointment immediately with transaction
   *    - ONLINE: Create payment request (placeholder - pending gateway integration)
   * 4. For COD: Delete Redis session after success
   * 5. For ONLINE: Keep session for webhook processing
   *
   * @param sessionId - Booking session UUID from Redis
   * @param patientId - Patient account UUID (from JWT)
   * @returns Created appointment details (COD) or payment URL (ONLINE)
   * @throws NotFoundException if session expired or data not found
   * @throws BadRequestException if validation fails or slot full
   * @throws ConflictException if duplicate appointment exists
   */
  async createAppointmentFromSession(
    sessionId: string,
    patientId: string,
  ): Promise<any> {
    // ========================================================================
    // STEP 1: RETRIEVE AND VALIDATE SESSION
    // ========================================================================
    
    const session = await this.bookingSessionService.getSession(sessionId);

    // Verify session ownership
    if (session.patientId !== patientId) {
      throw new ForbiddenException('You do not have permission to access this session');
    }

    // V4.4: Support all 3 booking options (service-first, doctor-first, date-first)
    // Validate session has all required fields regardless of booking option
    // By this step, all options should have collected the same complete data set
    if (!session.clinicServiceConfigId || !session.clinicId || !session.appointmentDate ||
      !session.clinicShiftHourId || !session.doctorId || !session.paymentMethod) {
      throw new BadRequestException(
        'Incomplete booking session. Please complete all steps (including payment method selection) before confirming.',
      );
    }

    // Validate payment method
    if (!['cod', 'online'].includes(session.paymentMethod)) {
      throw new BadRequestException('Invalid payment method. Must be \"cod\" or \"online\"');
    }

    // ========================================================================
    // STEP 2: VALIDATE BUSINESS RULES (COMMON FOR BOTH COD & ONLINE)
    // ========================================================================
    
    // Extract date string (YYYY-MM-DD) directly from session
    let dateString: string;
    const dateInput = session.appointmentDate;
    
    if (typeof dateInput === 'string') {
      // If it's already a string, extract YYYY-MM-DD part
      dateString = dateInput.includes('T') ? dateInput.split('T')[0] : dateInput;
    } else {
      throw new BadRequestException('Invalid appointment date format');
    }
    
    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      throw new BadRequestException('Appointment date must be in YYYY-MM-DD format');
    }
    
    // Parse to Date object for comparison only
    const appointmentDate = new Date(dateString + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Business Rule: Appointment date must be >= today
    if (appointmentDate < today) {
      throw new BadRequestException('Appointment date must be today or in the future');
    }

    // Business Rule: Appointment date must be <= 60 days from now
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 60);
    maxDate.setHours(0, 0, 0, 0);
    if (appointmentDate > maxDate) {
      throw new BadRequestException('Appointment date cannot be more than 60 days in the future');
    }

    // ========================================================================
    // STEP 3: BRANCH BASED ON PAYMENT METHOD
    // ========================================================================
    
    if (session.paymentMethod === 'cod') {
      // ┌─────────────────────────────────────────────────────────────────┐
      // │ NHÁNH A: THANH TOÁN COD (Cash on Delivery)                      │
      // │ Tạo appointment ngay lập tức, thanh toán tại phòng khám         │
      // └─────────────────────────────────────────────────────────────────┘
      return await this.createAppointmentCOD(sessionId, patientId, session, dateString);
    } else {
      // ┌─────────────────────────────────────────────────────────────────┐
      // │ NHÁNH B: THANH TOÁN ONLINE (Payment Gateway)                    │
      // │ PLACEHOLDER - Chưa tích hợp payment gateway thật                │
      // │ Trả về mock payment URL, giữ session để xử lý webhook sau       │
      // └─────────────────────────────────────────────────────────────────┘
      return await this.createPaymentRequestOnline(sessionId, session);
    }
  }

  /**
   * PRIVATE METHOD: Create Appointment with COD Payment
   *
   * Executes full transaction to create appointment in database.
   * Implements pessimistic locking to prevent race conditions.
   *
   * Steps:
   * 1. Lock clinic_shift_hour (SELECT ... FOR UPDATE)
   * 2. Validate slot availability and service config
   * 3. Validate doctor schedule
   * 4. Calculate appointment hour and check duplicates
   * 5. Atomic decrement slot limit
   * 6. Create Appointment entity with status PENDING, payment_type COD
   * 7. Create AppointmentPackage entity
   * 8. Create ServiceAppointment entity
   * 9. Delete Redis session (cleanup)
   * 10. Send email notifications (async, non-blocking)
   * 11. Return appointment data
   *
   * @param sessionId - Session UUID for cleanup
   * @param patientId - Patient UUID
   * @param session - Booking session data from Redis
   * @param dateString - Appointment date in YYYY-MM-DD format
   * @returns Created appointment data
   */
  private async createAppointmentCOD(
    sessionId: string,
    patientId: string,
    session: any,
    dateString: string,
  ): Promise<any> {
    // Execute transaction with SERIALIZABLE isolation level
    // This ensures ACID compliance and prevents race conditions
    const result = await this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      // === STEP 1: Pessimistic Lock on ClinicShiftHour ===
      // SELECT ... FOR UPDATE prevents concurrent bookings
      const shiftHourRepo = manager.getRepository('clinic_shift_hour');
      const shiftHour = await manager
        .createQueryBuilder()
        .select('csh')
        .from('clinic_shift_hour', 'csh')
        .where('csh._id = :id', { id: session.clinicShiftHourId })
        .setLock('pessimistic_write') // Critical: Prevents race conditions
        .getOne();

      if (!shiftHour) {
        throw new NotFoundException('Time slot not found');
      }

      // Business Rule: Check slot availability
      if (shiftHour.limit <= 0) {
        throw new BadRequestException(
          'This time slot is fully booked. Please select another time.',
        );
      }

      // === STEP 2: Validate Service Config ===
      // FIX: Use QueryBuilder to properly check parent service's deletedAt
      const serviceConfigQuery = manager
        .createQueryBuilder(ClinicServiceConfig, 'csc')
        .leftJoinAndSelect('csc.service', 'service')
        .where('csc._id = :configId', { configId: session.clinicServiceConfigId })
        .andWhere('csc.clinic_id = :clinicId', { clinicId: session.clinicId })
        .andWhere('csc.is_active = :isActive', { isActive: true })
        .andWhere('csc.deleted_at IS NULL')
        .andWhere('service.deleted_at IS NULL') // CRITICAL: Check parent service not deleted
        .andWhere('service.is_active = :serviceActive', { serviceActive: true });

      const serviceConfig = await serviceConfigQuery.getOne();

      if (!serviceConfig) {
        // Additional debug: Try to find the service config without constraints
        const anyConfig = await manager.findOne(ClinicServiceConfig, {
          where: {
            _id: session.clinicServiceConfigId,
          },
          relations: ['service'],
        });

        if (anyConfig) {
          // Service exists but belongs to different clinic
          throw new BadRequestException(
            'Service is not available at the selected clinic. Please select a service from this clinic.'
          );
        }

        // Try to find by clinic only
        const configsByClinic = await manager
          .createQueryBuilder(ClinicServiceConfig, 'csc')
          .leftJoinAndSelect('csc.service', 'service')
          .where('csc.clinic_id = :clinicId', { clinicId: session.clinicId })
          .andWhere('csc.is_active = true')
          .andWhere('csc.deleted_at IS NULL')
          .andWhere('service.deleted_at IS NULL')
          .andWhere('service.is_active = true')
          .take(5)
          .getMany();

        throw new BadRequestException('Service is not available');
      }

      // Calculate price (base price - discount)
      const basePrice = parseFloat(serviceConfig.price.toString());
      const discount = serviceConfig.discount ? parseFloat(serviceConfig.discount.toString()) : 0;
      const finalPrice = basePrice - (basePrice * discount / 100);

      // === STEP 3: Validate Doctor Schedule ===
      // Get all valid clinic IDs (clinic itself + all branches)
      const branches = await manager
        .createQueryBuilder()
        .select('_id')
        .from('accounts', 'acc')
        .where('acc.parent_id = :clinicId', { clinicId: session.clinicId })
        .andWhere('acc.role = :role', { role: 'CLINIC_MANAGER' })
        .andWhere('acc.status = :status', { status: 'ACTIVE' })
        .andWhere('acc.deleted_at IS NULL')
        .getRawMany();
      
      const validClinicIds = branches.map((b) => b._id);
      validClinicIds.push(session.clinicId); // Include parent clinic
      
      // Check if doctor has schedule on this date at any of these clinics
      // Use raw SQL for DATE comparison to avoid type casting issues
      // IMPORTANT: Extract date string from timestamptz with Vietnam timezone
      const doctorSchedule = await manager.query(
        `SELECT * FROM employee_schedule 
         WHERE employee_id = $1 
         AND clinic_id = ANY($2::uuid[])
         AND TO_CHAR(work_date AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') = $3
         AND deleted_at IS NULL 
         LIMIT 1`,
        [session.doctorId, validClinicIds, dateString]
      );

      if (!doctorSchedule || doctorSchedule.length === 0) {
        throw new BadRequestException(
          'Doctor is not available on this date at this clinic',
        );
      }

      // === STEP 4: Calculate Appointment Hour ===
      // Combine date + start_hour to create full timestamp
      // Use dateString to ensure proper date parsing without timezone issues
      const [hours, minutes] = shiftHour.startHour.split(':');
      const appointmentHour = new Date(dateString + 'T' + hours + ':' + minutes + ':00');

      // Business Rule: Must book at least 2 hours in advance
      const minBookingTime = new Date();
      minBookingTime.setHours(minBookingTime.getHours() + 2);
      if (appointmentHour <= minBookingTime) {
        throw new BadRequestException(
          'Appointment must be at least 2 hours from now',
        );
      }

      // === STEP 5: Check for Duplicate Appointments ===
      const appointmentRepo = manager.getRepository('appointments');
      const existingAppointment = await manager
        .createQueryBuilder()
        .select('a')
        .from('appointments', 'a')
        .where('a.patient_id = :patientId', { patientId })
        .andWhere('a.appointment_date = :dateString', { dateString })
        .andWhere('a.clinic_shift_hour_id = :shiftHourId', { shiftHourId: session.clinicShiftHourId })
        .andWhere("a.status IN ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS')")
        .andWhere('a.deleted_at IS NULL')
        .getOne();

      if (existingAppointment) {
        throw new ConflictException(
          'You already have an appointment at this time',
        );
      }

      // === STEP 6: Atomic Decrement Slot Limit ===
      await manager
        .createQueryBuilder()
        .update('clinic_shift_hour')
        .set({ limit: () => 'limit - 1' }) // Raw SQL prevents race condition
        .where('_id = :id', { id: session.clinicShiftHourId })
        .execute();

      // === STEP 7: Create Appointment ===
      // V4.0: COD Payment - Status set to PENDING (awaiting clinic confirmation)
      // Create proper Date objects from dateString to avoid timezone issues
      const appointmentDateForDB = new Date(dateString + 'T00:00:00');
      
      const appointment = appointmentRepo.create({
        patientId,
        clinicId: session.clinicId,
        doctorId: session.doctorId,
        clinicShiftHourId: session.clinicShiftHourId,
        appointmentDate: appointmentDateForDB,
        appointmentHour,
        total: finalPrice,
        status: AppointmentStatus.PENDING,
        patientNote: session.patientNote || null,
      });

      const savedAppointment = await appointmentRepo.save(appointment);

      // === STEP 8: Create Appointment Package ===
      // V4.0: COD Payment - Status set to PENDING_PAYMENT, will be paid at clinic
      const packageRepo = manager.getRepository('appointment_package');
      const appointmentPackage = packageRepo.create({
        appointmentId: savedAppointment._id,
        transactionId: null, // COD: No transaction ID until payment at clinic
        amount: Math.round(finalPrice), // Convert to integer (cents/smallest unit)
        status: AppointmentPackageStatus.PENDING_PAYMENT,
        paymentType: PaymentType.COD, // V4.0: Changed from ONLINE to COD
      });

      const savedPackage = await packageRepo.save(appointmentPackage);

      // === STEP 9: Create Service Appointment ===
      const serviceAppointmentRepo = manager.getRepository('service_appointments');
      const serviceAppointment = serviceAppointmentRepo.create({
        clinicServiceId: session.clinicServiceConfigId,
        appointmentPackageId: savedPackage._id,
      });

      await serviceAppointmentRepo.save(serviceAppointment);

      // Return data for response
      return {
        appointment: savedAppointment,
        serviceConfig,
        shiftHour,
      };
    });

    // === STEP 10: Delete Redis Session (Cleanup) ===
    // V4.0: COD flow deletes session immediately after successful creation
    await this.bookingSessionService.deleteSession(sessionId);

    // === STEP 11: Send Email Notifications (Async - Non-blocking) ===
    // Email failures should NOT rollback the appointment
    // TODO: Implement email sending when MailerService is ready
    /*
    try {
      await this.mailerService.sendAppointmentConfirmation({
        patientEmail: patient.email,
        clinicName: clinic.name,
        doctorName: doctor.name,
        appointmentDate: result.appointment.appointmentDate,
        appointmentHour: result.appointment.appointmentHour,
      });
    } catch (emailError) {
      console.error('Failed to send appointment email:', emailError);
      // Continue - appointment was created successfully
    }
    */

    // === STEP 12: Build Response ===
    return {
      appointment_id: result.appointment._id,
      clinic_id: result.appointment.clinicId,
      service_name: result.serviceConfig.service?.serviceName || 'N/A',
      appointment_date: result.appointment.appointmentDate,
      appointment_hour: result.appointment.appointmentHour,
      start_time: result.shiftHour.startHour,
      end_time: result.shiftHour.endHour,
      total: result.appointment.total,
      status: result.appointment.status,
      payment_type: 'cod', // V4.0: COD payment method
      patient_note: result.appointment.patientNote,
    };
  }

  /**
   * PRIVATE METHOD: Create Payment Request for Online Payment
   *
   * PLACEHOLDER IMPLEMENTATION - Payment Gateway Integration Pending
   * 
   * This method will eventually:
   * 1. Generate unique payment_reference_id
   * 2. Calculate total amount from session data
   * 3. Call Payment Gateway API (VNPay/Momo) to create payment
   * 4. Update session with payment_reference_id (DO NOT DELETE SESSION)
   * 5. Return payment_url for frontend redirect
   * 
   * Current implementation returns MOCK data for testing purposes.
   * Session is kept in Redis for webhook processing (after actual payment).
   *
   * @param sessionId - Session UUID
   * @param session - Booking session data from Redis
   * @returns Mock payment response with payment URL
   */
  private async createPaymentRequestOnline(
    sessionId: string,
    session: any,
  ): Promise<any> {
    // ========================================================================
    // PLACEHOLDER LOGIC - TO BE REPLACED WITH REAL PAYMENT GATEWAY
    // ========================================================================
    
    const { v4: uuidv4 } = require('uuid');
    
    // Generate unique payment reference ID
    const paymentReferenceId = uuidv4();
    
    // Calculate total amount (same logic as COD)
    // In real implementation, this should query the actual service price
    // For now, return a placeholder amount
    const totalAmount = 300000; // Placeholder - will be calculated from session data

    // Update session with payment_reference_id
    // This allows webhook to find the session later
    const updatedSession = {
      ...session,
      paymentReferenceId,
      paymentProvider: 'vnpay', // or 'momo'
    };

    // Save updated session back to Redis (keep TTL)
    const key = `booking:session:${sessionId}`;
    const ttl = await this.bookingSessionService['redisClient'].ttl(key);
    await this.bookingSessionService['redisClient'].setex(
      key,
      ttl > 0 ? ttl : 1800,
      JSON.stringify(updatedSession),
    );

    // TODO: Call real Payment Gateway API
    // const paymentGatewayResponse = await this.paymentGatewayService.createPayment({
    //   order_id: paymentReferenceId,
    //   amount: totalAmount,
    //   order_info: `Thanh toan lich kham - ${session.clinicServiceConfigId}`,
    //   return_url: `${process.env.FRONTEND_URL}/booking/payment-result`,
    //   ipn_url: `${process.env.BACKEND_URL}/api/webhooks/payment`,
    //   locale: 'vn',
    //   currency: 'VND',
    // });

    // Return mock payment response
    return {
      message: 'Vui lòng thanh toán để hoàn tất đặt lịch',
      data: {
        payment_url: `https://sandbox.payment-gateway.com/pay?order_id=${paymentReferenceId}`,
        payment_reference_id: paymentReferenceId,
        amount: totalAmount,
        expires_at: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
        // Note: This is MOCK data. Real payment gateway will return actual payment URL
      },
    };
  }

  // ========================================================================
  // PATIENT BOOKING FLOW - GET ENDPOINTS
  // ========================================================================

  /**
   * Get Available Services (Option 1 - Step 1)
   *
   * Business Logic:
   * - Query clinic_service_config with JOINs
   * - Filter by is_active = true
   * - Calculate final_price = price - (price * discount / 100)
   * - Support search, category filter, clinic filter
   * - Pagination
   *
   * @param params - Query parameters for filtering and pagination
   * @returns Paginated list of available services
   */
  async getAvailableServices(params: {
    page: number;
    limit: number;
    search?: string;
    categoryId?: string;
    clinicId?: string;
  }) {
    const { page, limit, search, categoryId, clinicId } = params;
    const offset = (page - 1) * limit;

    // Build query with complex JOINs
    let query = this.dataSource
      .createQueryBuilder()
      .select([
        'csc._id AS clinic_service_config_id',
        'csc.clinic_id AS clinic_id',
        'COALESCE(cai.clinic_name, cmi.clinic_branch_name, clinic.username) AS clinic_name',
        'COALESCE(addr.address, \'\') AS clinic_address',
        'cs._id AS service_id',
        'cs.service_name AS service_name',
        'cat._id AS category_id',
        'cat.category_name AS category_name',
        'csc.price AS price',
        'csc.discount AS discount',
        'CASE WHEN csc.discount IS NULL OR csc.discount = 0 THEN csc.price ELSE (csc.price - (csc.price * csc.discount / 100)) END AS final_price',
        'cs.description AS description',
      ])
      .from('clinic_service_config', 'csc')
      .innerJoin('clinic_services', 'cs', 'cs._id = csc.service_id')
      .innerJoin('accounts', 'clinic', 'clinic._id = csc.clinic_id')
      .leftJoin('clinic_admin_information', 'cai', 'cai.account_id = clinic._id')
      .leftJoin('clinic_manager_information', 'cmi', 'cmi.account_id = clinic._id')
      .leftJoin('addresses', 'addr', 'addr.account_id = clinic._id')
      .leftJoin('clinic_service_category', 'cat', 'cat._id = cs.category_id')
      .where('csc.is_active = :active', { active: true })
      .andWhere('cs.is_active = :active', { active: true })
      .andWhere('clinic.status = :status', { status: 'ACTIVE' })
      .andWhere('csc.deleted_at IS NULL')
      .andWhere('cs.deleted_at IS NULL')
      .andWhere('clinic.deleted_at IS NULL');

    // Apply search filter
    if (search) {
      query = query.andWhere('cs.service_name ILIKE :search', {
        search: `%${search}%`,
      });
    }

    // Apply category filter
    if (categoryId) {
      query = query.andWhere('cs.category_id = :categoryId', { categoryId });
    }

    // Apply clinic filter (supports both CLINIC_ADMIN and CLINIC_MANAGER IDs)
    if (clinicId) {
      // Check if clinicId is a CLINIC_ADMIN (need to get all branches)
      const clinicAccount = await this.dataSource
        .createQueryBuilder()
        .select('role')
        .from('accounts', 'acc')
        .where('acc._id = :clinicId', { clinicId })
        .getRawOne();

      if (clinicAccount?.role === 'CLINIC_ADMIN') {
        // Get all branches for this clinic
        const branches = await this.dataSource
          .createQueryBuilder()
          .select('_id')
          .from('accounts', 'acc')
          .where('acc.parent_id = :clinicId', { clinicId })
          .andWhere('acc.role = :role', { role: 'CLINIC_MANAGER' })
          .andWhere('acc.status = :status', { status: 'ACTIVE' })
          .andWhere('acc.deleted_at IS NULL')
          .getRawMany();

        const branchIds = branches.map((b) => b._id);
        // CRITICAL FIX: Include CLINIC_ADMIN itself in the list
        branchIds.push(clinicId);
        
        query = query.andWhere('csc.clinic_id IN (:...branchIds)', { branchIds });
      } else {
        // clinicId is a CLINIC_MANAGER or direct ID
        query = query.andWhere('csc.clinic_id = :clinicId', { clinicId });
      }
    }

    // Get total count for pagination
    const countQuery = query.clone();
    const totalResults = await countQuery.getRawMany();
    const total = totalResults.length;

    // Apply ordering and pagination
    const results = await query
      .orderBy('cs.service_name', 'ASC')
      .limit(limit)
      .offset(offset)
      .getRawMany();

    return {
      data: results,
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Format date to YYYY-MM-DD string
   *
   * Safely handles both Date objects and string dates
   * Uses Vietnam timezone (Asia/Ho_Chi_Minh) for consistent date formatting
   *
   * @param date - Date object or string
   * @returns Formatted date string (YYYY-MM-DD) in Vietnam timezone
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
        return this.toVietnamDateString(parsedDate);
      }
      return date; // Return as is if can't parse
    }

    // If it's a Date object
    if (date instanceof Date && !isNaN(date.getTime())) {
      return this.toVietnamDateString(date);
    }

    return '';
  }

  /**
   * Convert Date to YYYY-MM-DD string in Vietnam timezone
   * @param date - Date object
   * @returns Date string in YYYY-MM-DD format (Vietnam timezone)
   * @private
   */
  private toVietnamDateString(date: Date): string {
    const options: Intl.DateTimeFormatOptions = {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    };
    const parts = new Intl.DateTimeFormat('en-CA', options).format(date);
    return parts; // en-CA locale returns YYYY-MM-DD format
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

    // appointments.clinic_id stores Admin ID
    // - CLINIC_ADMIN: filter by own _id
    // - CLINIC_MANAGER: filter by parentId (= Admin ID)
    let clinicId: string | undefined;
    if (userAccount.role === AccountRole.CLINIC_ADMIN) {
      clinicId = userAccount._id;
    } else if (userAccount.role === AccountRole.CLINIC_MANAGER) {
      clinicId = userAccount.parentId || undefined;
    }

    console.log(`[exportDoctorWorkHistoryCSV] User details - ID: ${userAccount._id}, Role: ${userAccount.role}, ParentId: ${userAccount.parentId}`);
    console.log(`[exportDoctorWorkHistoryCSV] Resolved clinicId for filtering: ${clinicId}`);

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

    console.log(`[exportDoctorWorkHistoryCSV] Query parameters: doctorId=${doctorId}, clinicId=${clinicId}, fromDate=${queryDto.fromDate}, toDate=${queryDto.toDate}, status=${queryDto.status}`);
    console.log(`[exportDoctorWorkHistoryCSV] Raw SQL Query: `, query.getSql());
    console.log(`[exportDoctorWorkHistoryCSV] SQL Parameters: `, query.getParameters());

    const appointments = await query.getMany();
    console.log(`[exportDoctorWorkHistoryCSV] Total appointments found: ${appointments.length}`);

    const headers = ['Mã Ca Khám', 'Bệnh Nhân', 'Phòng Khám', 'Ngày Khám', 'Giờ Khám', 'Trạng Thái', 'Ghi Chú', 'Doanh Thu (VNĐ)'];

    const rows = appointments.map(app => {
      const patientName = app.patient?.username || app.patientId;
      const clinicName = app.clinic?.username || app.clinicId;
      const date = this.toVietnamDateString(new Date(app.appointmentDate));
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

  /**
   * Get Patient's Appointments (Step 5 - Patient appointment history)
   *
   * Business Logic:
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 60);

    // Get clinic admin info
    const clinicAdmin = await this.dataSource
      .createQueryBuilder()
      .select([
        'clinic._id AS clinic_id',
        'clinic.username AS clinic_username',
        'COALESCE(cai.clinic_name, clinic.username) AS clinic_name',
      ])
      .from('accounts', 'clinic')
      .leftJoin('clinic_admin_information', 'cai', 'cai.account_id = clinic._id')
      .where('clinic._id = :clinicId', { clinicId })
      .getRawOne();

    if (!clinicAdmin) {
      return { data: [] };
    }

    // Get all clinic branches with info
    const branches = await this.dataSource
      .createQueryBuilder()
      .select([
        'branch._id AS branch_id',
        'branch.username AS branch_username',
        'COALESCE(cmi.clinic_branch_name, branch.username) AS branch_name',
        'COALESCE(addr.address, \'\') AS branch_address',
      ])
      .from('accounts', 'branch')
      .leftJoin('clinic_manager_information', 'cmi', 'cmi.account_id = branch._id')
      .leftJoin('addresses', 'addr', 'addr.account_id = branch._id')
      .where('branch.parent_id = :clinicId', { clinicId })
      .andWhere('branch.role = :role', { role: 'CLINIC_MANAGER' })
      .andWhere('branch.status = :status', { status: 'ACTIVE' })
      .andWhere('branch.deleted_at IS NULL')
      .getRawMany();

    if (branches.length === 0) {
      return { data: [] };
    }

    const branchIds = branches.map((b) => b.branch_id);

    // Get all schedules with doctor info grouped by date, branch, shift
    const schedules = await this.dataSource
      .createQueryBuilder()
      .select([
        'es._id AS schedule_id',
        'es.work_date AS work_date',
        'es.week_day AS week_day',
        'es.clinic_id AS branch_id',
        'cs.shift AS shift_type',
        'doctor._id AS doctor_id',
        'COALESCE(di.full_name, doctor.username) AS doctor_name',
        'di.profile_picture AS doctor_avatar',
        'di.academic_degree AS doctor_degree',
        'di.position AS doctor_position',
      ])
      .from('employee_schedule', 'es')
      .innerJoin('accounts', 'doctor', 'doctor._id = es.employee_id')
      .leftJoin('doctor_information', 'di', 'di.account_id = doctor._id')
      .innerJoin('clinic_shift', 'cs', 'cs._id = es.clinic_shift_id')
      .innerJoin('clinic_shift_hour', 'csh', 'csh.shift_id = cs._id')
      .where('es.clinic_id IN (:...branchIds)', { branchIds })
      .andWhere('es.work_date >= :today', { today })
      .andWhere('es.work_date <= :maxDate', { maxDate })
      .andWhere('es.deleted_at IS NULL')
      .andWhere('csh.deleted_at IS NULL')
      .andWhere('csh.limit > 0')
      .andWhere('doctor.role = :doctorRole', { doctorRole: 'DOCTOR' })
      .andWhere('doctor.status = :doctorStatus', { doctorStatus: 'ACTIVE' })
      .orderBy('es.work_date', 'ASC')
      .addOrderBy('cs.shift', 'ASC')
      .getRawMany();

    if (schedules.length === 0) {
      return { data: [] };
    }

    // Group schedules by date
    const dateMap = new Map<string, any>();

    for (const schedule of schedules) {
      const dateKey = this.toVietnamDateString(schedule.work_date);

      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, {
          date: schedule.work_date,
          week_day: schedule.week_day,
          branches: new Map(),
        });
      }

      const dateData = dateMap.get(dateKey);
      const branchId = schedule.branch_id;

      if (!dateData.branches.has(branchId)) {
        const branchInfo = branches.find((b) => b.branch_id === branchId);
        dateData.branches.set(branchId, {
          branch_id: branchId,
          branch_name: branchInfo?.branch_name || 'Unknown Branch',
          branch_address: branchInfo?.branch_address || '',
          shifts: new Map(),
        });
      }

      const branchData = dateData.branches.get(branchId);
      const shiftType = schedule.shift_type;

      if (!branchData.shifts.has(shiftType)) {
        branchData.shifts.set(shiftType, {
          shift: shiftType,
          doctors: [],
        });
      }

      const shiftData = branchData.shifts.get(shiftType);
      
      // Add doctor if not already in list
      if (!shiftData.doctors.find((d: any) => d.doctor_id === schedule.doctor_id)) {
        shiftData.doctors.push({
          doctor_id: schedule.doctor_id,
          doctor_name: schedule.doctor_name,
          doctor_avatar: schedule.doctor_avatar,
          doctor_degree: schedule.doctor_degree,
          doctor_position: schedule.doctor_position,
        });
      }
    }

    // Convert maps to arrays
    const result = Array.from(dateMap.values()).map((dateData: any) => ({
      date: dateData.date,
      week_day: dateData.week_day,
      branches: Array.from(dateData.branches.values()).map((branchData: any) => ({
        branch_id: branchData.branch_id,
        branch_name: branchData.branch_name,
        branch_address: branchData.branch_address,
        shifts: Array.from(branchData.shifts.values()),
      })),
    }));

    return {
      clinic_admin: {
        clinic_id: clinicAdmin.clinic_id,
        clinic_name: clinicAdmin.clinic_name,
      },
      data: result,
    };
  }

  /**
   * Get Available Slots for Service on Date (Option 1 - Step 3)
   *
   * Business Logic:
   * - Validate date (>= today, <= today + 60 days)
   * - Query employee_schedule for given clinic, date
   * - JOIN with doctor accounts
   * - JOIN with clinic_shift_hour to get time slots
   * - Calculate available_slots = limit - COUNT(active appointments)
   * - Only return slots where available_slots > 0
   * - Group by shift (MORNING, AFTERNOON, EVENING)
   * 
   * Note: Returns all available slots for the clinic on the date.
   * Service-specific filtering is not performed as doctors are not mapped to specific services.
   *
   * @param clinicId - Clinic UUID
   * @param serviceConfigId - Service config UUID
   * @param dateString - Appointment date (YYYY-MM-DD)
   * @returns Available slots grouped by shift
   */
  async getAvailableSlots(
    clinicId: string,
    dateString: string,
  ) {
    // Validate date format
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date format. Use YYYY-MM-DD');
    }

    // Business Rule: date >= today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) {
      throw new BadRequestException('Appointment date must be today or in the future');
    }

    // Business Rule: date <= today + 60 days
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 60);
    if (date > maxDate) {
      throw new BadRequestException('Appointment date cannot be more than 60 days in the future');
    }

    // Get all clinic branches (CLINIC_MANAGER) for this clinic (CLINIC_ADMIN)
    const branches = await this.dataSource
      .createQueryBuilder()
      .select('_id')
      .from('accounts', 'acc')
      .where('acc.parent_id = :clinicId', { clinicId })
      .andWhere('acc.role = :role', { role: 'CLINIC_MANAGER' })
      .andWhere('acc.status = :status', { status: 'ACTIVE' })
      .andWhere('acc.deleted_at IS NULL')
      .getRawMany();

    const branchIds = branches.map((b) => b._id);

    if (branchIds.length === 0) {
      throw new BadRequestException('No active branches found for this clinic');
    }

    // Query for all available slots (not filtered by service)
    const slots = await this.dataSource
      .createQueryBuilder()
      .select([
        'csh._id AS clinic_shift_hour_id',
        'doctor._id AS doctor_id',
        'COALESCE(di.full_name, doctor.username) AS doctor_name',
        'di.position AS doctor_specialty',
        'csh.start_hour AS start_time',
        'csh.end_hour AS end_time',
        'csh.limit AS limit',
        'cs.shift AS shift',
        'cr.room_name AS clinic_room',
      ])
      .from('employee_schedule', 'es')
      .innerJoin('accounts', 'doctor', 'doctor._id = es.employee_id')
      .innerJoin('doctor_information', 'di', 'di.account_id = doctor._id')
      .innerJoin('clinic_shift', 'cs', 'cs._id = es.clinic_shift_id')
      .innerJoin('clinic_shift_hour', 'csh', 'csh.shift_id = cs._id')
      .leftJoin('clinic_room_employee_schedule', 'cres', 'cres.employee_schedule_id = es._id')
      .leftJoin('clinic_room', 'cr', 'cr._id = cres.clinic_room_id')
      .where('es.clinic_id IN (:...branchIds)', { branchIds })
      .andWhere('es.work_date = :date', { date: dateString })
      .andWhere('es.deleted_at IS NULL')
      .andWhere('csh.deleted_at IS NULL')
      .andWhere('csh.limit > 0')
      .andWhere('doctor.status = :status', { status: 'ACTIVE' })
      .orderBy('csh.start_hour', 'ASC')
      .getRawMany();

    // Get all available services at this clinic (query early while branchIds in scope)
    // Note: Returns all clinic services rather than filtering by doctor specialty
    const services = await this.dataSource
      .createQueryBuilder()
      .select([
        'csc._id AS clinic_service_config_id',
        'cs._id AS service_id',
        'cs.service_name AS service_name',
        'cat.category_name AS category_name',
        'csc.price AS price',
        'csc.discount AS discount',
        'CASE WHEN csc.discount IS NULL OR csc.discount = 0 THEN csc.price ELSE (csc.price - (csc.price * csc.discount / 100)) END AS final_price',
        'cs.description AS description',
      ])
      .from('clinic_service_config', 'csc')
      .innerJoin('clinic_services', 'cs', 'cs._id = csc.service_id')
      .leftJoin('clinic_service_category', 'cat', 'cat._id = cs.category_id')
      .where('csc.clinic_id IN (:...branchIds)', { branchIds })
      .andWhere('csc.is_active = :active', { active: true })
      .andWhere('cs.is_active = :active', { active: true })
      .andWhere('csc.deleted_at IS NULL')
      .andWhere('cs.deleted_at IS NULL')
      .orderBy('cs.service_name', 'ASC')
      .getRawMany();

    // For each slot, calculate available_slots
    const enrichedSlots = await Promise.all(
      slots.map(async (slot) => {
        // Count active appointments for this slot
        const appointmentCount = await this.dataSource
          .createQueryBuilder()
          .select('COUNT(*)', 'count')
          .from('appointments', 'a')
          .where('a.clinic_shift_hour_id = :shiftHourId', {
            shiftHourId: slot.clinic_shift_hour_id,
          })
          .andWhere('a.appointment_date = :date', { date: dateString })
          .andWhere(
            "a.status IN ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS')",
          )
          .andWhere('a.deleted_at IS NULL')
          .getRawOne();

        const bookedCount = parseInt(appointmentCount?.count || '0');
        const availableSlots = slot.limit - bookedCount;

        return {
          ...slot,
          available_slots: availableSlots,
        };
      }),
    );

    // Filter out fully booked slots
    const availableSlots = enrichedSlots.filter((s) => s.available_slots > 0);

    // Group by shift
    const groupedByShift = {
      MORNING: availableSlots.filter((s) => s.shift === 'MORNING'),
      AFTERNOON: availableSlots.filter((s) => s.shift === 'AFTERNOON'),
      EVENING: availableSlots.filter((s) => s.shift === 'EVENING'),
    };

    return {
      data: [
        {
          shift: 'MORNING',
          slots: groupedByShift.MORNING.map((s) => ({
            clinic_shift_hour_id: s.clinic_shift_hour_id,
            doctor_id: s.doctor_id,
            doctor_name: s.doctor_name,
            doctor_specialty: s.doctor_specialty,
            start_time: s.start_time,
            end_time: s.end_time,
            limit: s.limit,
            available_slots: s.available_slots,
            clinic_room: s.clinic_room,
          })),
        },
        {
          shift: 'AFTERNOON',
          slots: groupedByShift.AFTERNOON.map((s) => ({
            clinic_shift_hour_id: s.clinic_shift_hour_id,
            doctor_id: s.doctor_id,
            doctor_name: s.doctor_name,
            doctor_specialty: s.doctor_specialty,
            start_time: s.start_time,
            end_time: s.end_time,
            limit: s.limit,
            available_slots: s.available_slots,
            clinic_room: s.clinic_room,
          })),
        },
        {
          shift: 'EVENING',
          slots: groupedByShift.EVENING.map((s) => ({
            clinic_shift_hour_id: s.clinic_shift_hour_id,
            doctor_id: s.doctor_id,
            doctor_name: s.doctor_name,
            doctor_specialty: s.doctor_specialty,
            start_time: s.start_time,
            end_time: s.end_time,
            limit: s.limit,
            available_slots: s.available_slots,
            clinic_room: s.clinic_room,
          })),
        },
      ],
    };
  }

  /**
   * Get Patient's Appointments (Step 5 - Patient appointment history)
   *
   * Business Logic:
   * - UPCOMING: status IN [PENDING, CONFIRMED, CHECKED_IN, IN_PROGRESS] AND appointment_date >= today
   * - HISTORY: status IN [COMPLETED, CANCELLED, ABSENT] OR (unfinished status AND appointment_date < today)
   * - Status filter overrides tab filter if provided
   * - Query appointments for patient_id
   * - JOIN with clinic, doctor, appointment_package, service_appointments
   * - Support filtering by status, date, tab
   * - Pagination
   * - Order by appointment_date DESC, appointment_hour DESC
   *
   * Optimization:
   * - Uses bulk loading to avoid N+1 queries
   * - Loads appointments first, then fetches services in a single query
   *
   * @param patientId - Patient account UUID
   * @param params - Query parameters for filtering and pagination
   * @returns Paginated list of patient's appointments
   */
  /**
   * Get My Appointments (Patient) - API List with Pagination
   *
   * Returns paginated list of appointments for the authenticated patient.
   * Includes clinic, doctor, shift hour, payment info, and services.
   *
   * Query Strategy:
   * - Base query with JOINs for clinic, doctor, clinic_shift_hour, appointment_package
   * - Bulk load services separately to avoid N+1 queries
   * - Sort by appointment_date DESC, created_at DESC
   *
   * Security:
   * - Filter by patient_id from JWT token
   *
   * @param patientId - Patient ID from JWT token
   * @param params - Query parameters (page, limit, tab, status, appointmentDate)
   * @returns Paginated list of appointments with meta info
   */
  async getMyAppointments(
    patientId: string,
    params: {
      page: number;
      limit: number;
      tab?: 'UPCOMING' | 'HISTORY';
      status?: string;
      appointmentDate?: string;
    },
  ) {
    const { page, limit, tab, status, appointmentDate } = params;
    const today = this.toVietnamDateString(new Date()); // YYYY-MM-DD format in Vietnam timezone

    // Build base query with all necessary JOINs
    const query = this.dataSource
      .createQueryBuilder()
      .select([
        'a._id AS appointment_id',
        'a.appointment_date AS appointment_date',
        'a.appointment_hour AS appointment_hour',
        'a.status AS status',
        'a.total AS total',
        'a.created_at AS created_at',
        // Clinic info
        '"clinic"._id AS clinic_id',
        'COALESCE("cmi".clinic_branch_name, "clinic".username) AS clinic_name',
        '"addr".address AS clinic_address',
        // Doctor info (nullable)
        '"doctor"._id AS doctor_id',
        'COALESCE("di".full_name, "doctor".username) AS doctor_name',
        '"di".profile_picture AS doctor_profile_picture',
        // Shift hour info (nullable)
        '"csh".start_hour AS start_hour',
        '"csh".end_hour AS end_hour',
        // Payment info
        '"ap".payment_type AS payment_type',
        '"ap".status AS payment_status',
      ])
      .from('appointments', 'a')
      .innerJoin('accounts', 'clinic', 'clinic._id = a.clinic_id')
      .leftJoin('clinic_manager_information', 'cmi', 'cmi.account_id = clinic._id')
      .leftJoin('addresses', 'addr', 'addr.account_id = clinic._id')
      .leftJoin('accounts', 'doctor', 'doctor._id = a.doctor_id')
      .leftJoin('doctor_information', 'di', 'di.account_id = doctor._id')
      .leftJoin('clinic_shift_hour', 'csh', 'csh._id = a.clinic_shift_hour_id')
      .leftJoin('appointment_package', 'ap', 'ap.appointment_id = a._id AND ap.deleted_at IS NULL')
      .where('a.patient_id = :patientId', { patientId })
      .andWhere('a.deleted_at IS NULL');

    // Apply status filter (overrides tab if provided)
    if (status) {
      query.andWhere('a.status = :status', { status });
    } else if (tab) {
      // Apply tab-based filtering
      if (tab === 'UPCOMING') {
        // UPCOMING: Active statuses AND future/today appointments
        query.andWhere(
          `(a.status IN (:...upcomingStatuses) AND a.appointment_date >= :today)`,
          {
            upcomingStatuses: [
              AppointmentStatus.PENDING,
              AppointmentStatus.CONFIRMED,
              AppointmentStatus.CHECKED_IN,
              AppointmentStatus.IN_PROGRESS,
            ],
            today,
          },
        );
      } else if (tab === 'HISTORY') {
        // HISTORY: Completed/Cancelled/Absent OR past appointments with unfinished status
        query.andWhere(
          `(a.status IN (:...completedStatuses) OR 
           (a.status IN (:...unfinishedStatuses) AND a.appointment_date < :today))`,
          {
            completedStatuses: [
              AppointmentStatus.COMPLETED,
              AppointmentStatus.CANCELLED,
              AppointmentStatus.ABSENT,
            ],
            unfinishedStatuses: [
              AppointmentStatus.PENDING,
              AppointmentStatus.CONFIRMED,
              AppointmentStatus.CHECKED_IN,
              AppointmentStatus.IN_PROGRESS,
            ],
            today,
          },
        );
      }
    }

    // Apply date filter
    if (appointmentDate) {
      query.andWhere('a.appointment_date = :appointmentDate', {
        appointmentDate,
      });
    }

    // Get total count before pagination
    const countQuery = query.clone();
    const total = await countQuery.getCount();

    // Get paginated results with ordering
    const appointmentsRaw = await query
      .orderBy('a.appointment_date', 'DESC')
      .addOrderBy('a.created_at', 'DESC')
      .offset((page - 1) * limit)
      .limit(limit)
      .getRawMany();

    // Optimization: Bulk load services to avoid N+1 queries
    let servicesMap: Map<string, any[]> = new Map();
    if (appointmentsRaw.length > 0) {
      const appointmentIds = appointmentsRaw.map((a) => a.appointment_id);

      // Single query to fetch all services for all appointments
      const servicesRaw = await this.dataSource
        .createQueryBuilder()
        .select([
          'ap.appointment_id AS appointment_id',
          'cs._id AS service_id',
          'cs.service_name AS service_name',
          'csc.price AS price',
        ])
        .from('appointment_package', 'ap')
        .innerJoin('service_appointments', 'sa', 'sa.appointment_package_id = ap._id')
        .innerJoin('clinic_service_config', 'csc', 'csc._id = sa.clinic_service_id')
        .innerJoin('clinic_services', 'cs', 'cs._id = csc.service_id')
        .where('ap.appointment_id IN (:...appointmentIds)', { appointmentIds })
        .andWhere('ap.deleted_at IS NULL')
        .andWhere('sa.deleted_at IS NULL')
        .getRawMany();

      // Group services by appointment_id
      servicesRaw.forEach((service) => {
        const aptId = service.appointment_id;
        if (!servicesMap.has(aptId)) {
          servicesMap.set(aptId, []);
        }
        servicesMap.get(aptId)!.push({
          service_id: service.service_id,
          service_name: service.service_name,
          price: parseFloat(service.price || '0'),
        });
      });
    }

    // Map to response DTO structure
    const data = appointmentsRaw.map((apt) => ({
      _id: apt.appointment_id,
      clinic: {
        _id: apt.clinic_id,
        name: apt.clinic_name,
        address: apt.clinic_address,
      },
      doctor: apt.doctor_id
        ? {
            _id: apt.doctor_id,
            name: apt.doctor_name,
            profilePicture: apt.doctor_profile_picture,
          }
        : null,
      appointment_date: apt.appointment_date,
      appointment_hour: apt.appointment_hour,
      start_hour: apt.start_hour,
      end_hour: apt.end_hour,
      status: apt.status,
      total: parseFloat(apt.total || '0'),
      payment_type: apt.payment_type,
      payment_status: apt.payment_status,
      services: servicesMap.get(apt.appointment_id) || [],
    }));

    return {
      data,
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get My Appointment Detail (Patient)
   *
   * Returns comprehensive appointment details including:
   * - Clinic and doctor information
   * - Appointment packages with services
   * - ERM summaries for each service
   * - E-prescription summary (only when status is COMPLETED)
   * - Reject reason (only when status is CANCELLED)
   *
   * Security:
   * - Strict ownership verification (patient_id must match)
   * - Returns 404 if appointment not found or access denied
   *
   * @param patientId - Patient ID from JWT token
   * @param appointmentId - Appointment ID from URL parameter
   * @returns PatientAppointmentDetailResponseDto
   */
  /**
   * Get My Appointment Detail (Patient)
   *
   * Returns comprehensive appointment details including:
   * - Clinic and doctor information (with extra details)
   * - Appointment shift hour (start_hour, end_hour)
   * - Payment information (payment_type, payment_status from appointment_package)
   * - Appointment packages with services array
   * - ERM summaries for each service
   * - E-prescription summary (only when status is COMPLETED)
   * - Reject reason (only when status is CANCELLED)
   *
   * Query Strategy:
   * - Layer 1: Verify appointment ownership with JOINs
   * - Layer 2: Bulk load appointment packages
   * - Layer 3: Bulk load service appointments with ERMs (avoid N+1)
   * - Layer 4: Load doctor details if assigned
   * - Layer 5: Load e-prescription if COMPLETED
   *
   * Security:
   * - Strict ownership verification (patient_id must match)
   * - Returns 404 if appointment not found or access denied
   *
   * @param patientId - Patient ID from JWT token
   * @param appointmentId - Appointment ID from URL parameter
   * @returns PatientAppointmentDetailResponseDto
   */
  async getMyAppointmentDetail(patientId: string, appointmentId: string) {
    // Layer 1: Verify appointment ownership and load base data with JOINs
    const appointmentRaw = await this.dataSource
      .createQueryBuilder()
      .select([
        'a._id AS appointment_id',
        'a.appointment_date AS appointment_date',
        'a.appointment_hour AS appointment_hour',
        'a.status AS status',
        'a.total AS total',
        'a.patient_note AS patient_note',
        'a.reject_reason AS reject_reason',
        'a.created_at AS created_at',
        'a.updated_at AS updated_at',
        // Clinic info
        '"clinic"._id AS clinic_id',
        'COALESCE("cmi".clinic_branch_name, "clinic".username) AS clinic_name',
        '"addr".address AS clinic_address',
        '"clinic".phone AS clinic_phone',
        '"cmi".profile_picture AS clinic_profile_picture',
        // Doctor info (nullable)
        '"doctor"._id AS doctor_id',
        'COALESCE("di".full_name, "doctor".username) AS doctor_name',
        '"di".profile_picture AS doctor_profile_picture',
        // Shift hour info (nullable)
        '"csh".start_hour AS start_hour',
        '"csh".end_hour AS end_hour',
      ])
      .from('appointments', 'a')
      .innerJoin('accounts', 'clinic', 'clinic._id = a.clinic_id')
      .leftJoin('clinic_manager_information', 'cmi', 'cmi.account_id = clinic._id')
      .leftJoin('addresses', 'addr', 'addr.account_id = clinic._id')
      .leftJoin('accounts', 'doctor', 'doctor._id = a.doctor_id')
      .leftJoin('doctor_information', 'di', 'di.account_id = doctor._id')
      .leftJoin('clinic_shift_hour', 'csh', 'csh._id = a.clinic_shift_hour_id')
      .where('a._id = :appointmentId', { appointmentId })
      .andWhere('a.patient_id = :patientId', { patientId })
      .andWhere('a.deleted_at IS NULL')
      .getRawOne();

    if (!appointmentRaw) {
      throw new NotFoundException(
        MESSAGES.failMessage.appointmentNotFound || 'Appointment not found or access denied',
      );
    }

    // Layer 2: Load appointment packages with payment info
    const packages = await this.dataSource
      .createQueryBuilder()
      .select([
        'ap._id AS package_id',
        'ap.amount AS amount',
        'ap.payment_type AS payment_type',
        'ap.status AS payment_status',
      ])
      .from('appointment_package', 'ap')
      .where('ap.appointment_id = :appointmentId', { appointmentId })
      .andWhere('ap.deleted_at IS NULL')
      .getRawMany();

    // Layer 3: Load service appointments with ERM summary (bulk load to avoid N+1)
    let serviceAppointmentsData: any[] = [];
    if (packages.length > 0) {
      const packageIds = packages.map((p) => p.package_id);

      serviceAppointmentsData = await this.dataSource
        .createQueryBuilder()
        .select([
          'sa._id AS sa_id',
          'sa.appointment_package_id AS package_id',
          'csc._id AS service_config_id',
          'cs._id AS service_id',
          'cs.service_name AS service_name',
          'csc.price AS price',
          'e._id AS erm_id',
          'e.record_type AS erm_record_type',
          'e.status AS erm_status',
        ])
        .from('service_appointments', 'sa')
        .innerJoin('clinic_service_config', 'csc', 'csc._id = sa.clinic_service_id')
        .innerJoin('clinic_services', 'cs', 'cs._id = csc.service_id')
        .leftJoin('erms', 'e', 'e.service_appointments_id = sa._id AND e.deleted_at IS NULL')
        .where('sa.appointment_package_id IN (:...packageIds)', { packageIds })
        .andWhere('sa.deleted_at IS NULL')
        .getRawMany();
    }

    // Group service appointments by package
    const servicesByPackage = new Map<string, any[]>();
    serviceAppointmentsData.forEach((sa) => {
      const pkgId = sa.package_id;
      if (!servicesByPackage.has(pkgId)) {
        servicesByPackage.set(pkgId, []);
      }

      servicesByPackage.get(pkgId)!.push({
        _id: sa.sa_id,
        clinic_service: {
          _id: sa.service_id,
          service_name: sa.service_name,
          price: parseFloat(sa.price || '0'),
        },
        erm_summary: sa.erm_id
          ? {
              _id: sa.erm_id,
              record_type: sa.erm_record_type,
              status: sa.erm_status,
            }
          : undefined,
      });
    });

    // Layer 4: Load doctor additional details if doctor is assigned
    let doctorInfo = undefined;
    if (appointmentRaw.doctor_id) {
      const doctorDetails = await this.dataSource
        .createQueryBuilder()
        .select(['di.academic_degree AS academic_degree', 'di.position AS position'])
        .from('doctor_information', 'di')
        .where('di.account_id = :doctorId', { doctorId: appointmentRaw.doctor_id })
        .andWhere('di.deleted_at IS NULL')
        .getRawOne();

      doctorInfo = {
        _id: appointmentRaw.doctor_id,
        name: appointmentRaw.doctor_name,
        profilePicture: appointmentRaw.doctor_profile_picture,
        academicDegree: doctorDetails?.academic_degree,
        position: doctorDetails?.position,
      };
    }

    // Layer 5: Business Rules - E-Prescription Summary (only when COMPLETED)
    let ePrescriptionSummary = undefined;
    if (appointmentRaw.status === AppointmentStatus.COMPLETED) {
      const ePrescription = await this.dataSource
        .createQueryBuilder()
        .select('ep._id', 'id')
        .from('e_prescriptions', 'ep')
        .where('ep.appointment_id = :appointmentId', { appointmentId })
        .andWhere('ep.deleted_at IS NULL')
        .getRawOne();

      if (ePrescription) {
        ePrescriptionSummary = { _id: ePrescription.id };
      }
    }

    // Map to response DTO structure
    return {
      _id: appointmentRaw.appointment_id,
      clinic: {
        _id: appointmentRaw.clinic_id,
        name: appointmentRaw.clinic_name,
        address: appointmentRaw.clinic_address,
        phone: appointmentRaw.clinic_phone,
        profilePicture: appointmentRaw.clinic_profile_picture,
      },
      doctor: doctorInfo,
      appointment_date: appointmentRaw.appointment_date,
      appointment_hour: appointmentRaw.appointment_hour,
      start_hour: appointmentRaw.start_hour,
      end_hour: appointmentRaw.end_hour,
      status: appointmentRaw.status,
      total: parseFloat(appointmentRaw.total || '0'),
      patient_note: appointmentRaw.patient_note,
      reject_reason:
        appointmentRaw.status === AppointmentStatus.CANCELLED
          ? appointmentRaw.reject_reason
          : undefined,
      e_prescription_summary: ePrescriptionSummary,
      appointment_packages: packages.map((pkg) => ({
        _id: pkg.package_id,
        amount: parseFloat(pkg.amount || '0'),
        payment_type: pkg.payment_type,
        payment_status: pkg.payment_status,
        service_appointments: servicesByPackage.get(pkg.package_id) || [],
      })),
      created_at: appointmentRaw.created_at,
      updated_at: appointmentRaw.updated_at,
    };
  }

  // ========================================================================
  // OPTION 2: DOCTOR-FIRST BOOKING FLOW (PATIENT)
  // ========================================================================

  /**
   * Get Available Doctors (Option 2 - Step 1a)
   *
   * Business Logic:
   * - Query accounts WHERE role = 'doctor' AND is_active = true
   * - JOIN with employee_schedule to get clinics where doctor works
   * - Support search by full_name
   * - Support filter by specialization
   * - Support filter by clinic_id
   * - Pagination
   *
   * @param params - Query parameters for filtering and pagination
   * @returns Paginated list of doctors with their clinics
   */
  async getDoctors(params: {
    page: number;
    limit: number;
    search?: string;
    specialization?: string;
    clinic_id?: string;
  }) {
    const { page, limit, search, specialization, clinic_id } = params;
    const offset = (page - 1) * limit;

    // Build base query for doctors
    let doctorQuery = this.dataSource
      .createQueryBuilder()
      .select([
        'doctor._id AS doctor_id',
        'di.full_name AS full_name',
        'cci.work_specialty_at_clinic AS specialization',
      ])
      .from('accounts', 'doctor')
      .innerJoin('doctor_information', 'di', 'di.account_id = doctor._id')
      .leftJoin('contract_package', 'cp', 'cp.employee_id = doctor._id AND cp.deleted_at IS NULL')
      .leftJoin('clinic_contract_information', 'cci', 'cci.contract_id = cp._id AND cci.deleted_at IS NULL')
      .where('doctor.role = :role', { role: AccountRole.DOCTOR })
      .andWhere('doctor.status = :status', { status: 'ACTIVE' })
      .andWhere('doctor.deleted_at IS NULL');

    // Apply search filter
    if (search) {
      doctorQuery = doctorQuery.andWhere('di.full_name ILIKE :search', {
        search: `%${search}%`,
      });
    }

    // Apply specialization filter
    if (specialization) {
      doctorQuery = doctorQuery.andWhere('cci.work_specialty_at_clinic ILIKE :specialization', {
        specialization: `%${specialization}%`,
      });
    }

    // Apply clinic filter (doctor works at this clinic)
    if (clinic_id) {
      doctorQuery = doctorQuery
        .innerJoin('employee_schedule', 'es', 'es.employee_id = doctor._id')
        .andWhere('es.clinic_id = :clinic_id', { clinic_id })
        .andWhere('es.deleted_at IS NULL');
    }

    // Get total count
    const countQuery = doctorQuery.clone();
    const totalResults = await countQuery.getRawMany();
    const total = totalResults.length;

    // Get paginated doctors
    const doctors = await doctorQuery
      .groupBy('doctor._id')
      .addGroupBy('cci.work_specialty_at_clinic')
      .addGroupBy('di.full_name')
      .orderBy('di.full_name', 'ASC')
      .limit(limit)
      .offset(offset)
      .getRawMany();

    // For each doctor, get clinics where they work
    const enrichedDoctors = await Promise.all(
      doctors.map(async (doctor) => {
        const clinics = await this.dataSource
          .createQueryBuilder()
          .select([
            'DISTINCT clinic._id AS clinic_id',
            'cmi.clinic_branch_name AS clinic_name',
            'addr.address AS clinic_address',
          ])
          .from('employee_schedule', 'es')
          .innerJoin('accounts', 'clinic', 'clinic._id = es.clinic_id')
          .innerJoin('clinic_manager_information', 'cmi', 'cmi.account_id = clinic._id')
          .leftJoin('addresses', 'addr', 'addr.account_id = clinic._id')
          .where('es.employee_id = :doctor_id', { doctor_id: doctor.doctor_id })
          .andWhere('es.deleted_at IS NULL')
          .andWhere('clinic.status = :status', { status: 'ACTIVE' })
          .andWhere('clinic.deleted_at IS NULL')
          .getRawMany();

        return {
          doctor_id: doctor.doctor_id,
          full_name: doctor.full_name,
          specialization: doctor.specialization,
          clinics: clinics.map((c) => ({
            clinic_id: c.clinic_id,
            clinic_name: c.clinic_name,
            clinic_address: c.clinic_address,
          })),
        };
      }),
    );

    return {
      data: enrichedDoctors,
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get My Appointment Detail (Patient)
   *
   * Returns comprehensive appointment details including:
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 60);

    // Build query
    let query = this.dataSource
      .createQueryBuilder()
      .select([
        'es.work_date AS date',
        'es.week_day AS week_day',
        'es.clinic_id AS clinic_id',
        'cmi.clinic_branch_name AS clinic_name',
      ])
      .from('employee_schedule', 'es')
      .innerJoin('accounts', 'clinic', 'clinic._id = es.clinic_id')
      .innerJoin('clinic_manager_information', 'cmi', 'cmi.account_id = clinic._id')
      .innerJoin('clinic_shift', 'cs', 'cs._id = es.clinic_shift_id')
      .innerJoin('clinic_shift_hour', 'csh', 'csh.shift_id = cs._id')
      .where('es.employee_id = :doctorId', { doctorId })
      .andWhere('es.work_date >= :today', { today })
      .andWhere('es.work_date <= :maxDate', { maxDate })
      .andWhere('es.deleted_at IS NULL')
      .andWhere('csh.deleted_at IS NULL')
      .andWhere('csh.limit > 0')
      .andWhere('clinic.status = :status', { status: 'ACTIVE' })
      .andWhere('clinic.deleted_at IS NULL');

    // Apply clinic filter if provided
    if (clinicId) {
      query = query.andWhere('es.clinic_id = :clinicId', { clinicId });
    }

    // Execute query
    const results = await query
      .groupBy('es.work_date')
      .addGroupBy('es.week_day')
      .addGroupBy('es.clinic_id')
      .addGroupBy('cmi.clinic_branch_name')
      .orderBy('es.work_date', 'ASC')
      .getRawMany();

    // For each date, calculate total available slots
    const enrichedResults = await Promise.all(
      results.map(async (row) => {
        const slotsQuery = this.dataSource
          .createQueryBuilder()
          .select('SUM(csh.limit)', 'total_slots')
          .from('employee_schedule', 'es')
          .innerJoin('clinic_shift', 'cs', 'cs._id = es.clinic_shift_id')
          .innerJoin('clinic_shift_hour', 'csh', 'csh.shift_id = cs._id')
          .where('es.employee_id = :doctorId', { doctorId })
          .andWhere('es.work_date = :date', { date: row.date })
          .andWhere('es.clinic_id = :clinicId', { clinicId: row.clinic_id })
          .andWhere('es.deleted_at IS NULL')
          .andWhere('csh.deleted_at IS NULL')
          .andWhere('csh.limit > 0');

        const slotResult = await slotsQuery.getRawOne();

        return {
          date: row.date,
          week_day: row.week_day,
          clinic_id: row.clinic_id,
          clinic_name: row.clinic_name,
          available_slots: parseInt(slotResult?.total_slots || '0'),
        };
      }),
    );

    return {
      data: enrichedResults.filter((r) => r.available_slots > 0),
    };
  }

  /**
   * Get clinics by working date (Option 3: Date-first booking - Step 2a)
   *
   * Returns clinics that have available appointments.
   * If working_date is provided, filters by that specific date.
   * If working_date is omitted, returns all clinics with any available slots.
   * Filters by clinics where:
   * - Role is CLINIC_ADMIN (clinic accounts)
   * - Status is ACTIVE
   * - Has at least 1 available slot
   *
   * @param params - Query parameters (working_date, page, limit, search, district)
   * @returns Paginated list of clinics with availability information
   */
  async getClinicsByWorkingDate(params: {
    working_date?: string;
    page: number;
    limit: number;
    search?: string;
    district?: string;
  }): Promise<any> {
    const { working_date, page, limit, search, district } = params;

    // Validate date format and range only if working_date is provided
    if (working_date) {
      const appointmentDate = new Date(working_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (appointmentDate < today) {
        throw new BadRequestException('Working date must be today or in the future');
      }

      const maxDate = new Date();
      maxDate.setDate(maxDate.getDate() + 60);

      if (appointmentDate > maxDate) {
        throw new BadRequestException('Working date cannot be more than 60 days in the future');
      }
    }

    // REFACTOR: Return CLINIC_MANAGER (branches) instead of CLINIC_ADMIN
    // This fixes the service config mismatch issue where clinic_service_config.clinic_id
    // stores CLINIC_MANAGER._id but session was storing CLINIC_ADMIN._id
    const queryBuilder = this.dataSource
      .createQueryBuilder()
      .select([
        'DISTINCT branch._id AS clinic_id',  // CHANGED: Return branch ID
        'cai.clinic_name AS parent_clinic_name',  // FIX: Add to SELECT for ORDER BY
        'cmi.clinic_branch_name AS branch_name',  // FIX: Add to SELECT for ORDER BY
        'CASE WHEN cmi.clinic_branch_name IS NOT NULL AND cmi.clinic_branch_name != \'\' ' +
        'THEN CONCAT(cai.clinic_name, \' - \', cmi.clinic_branch_name) ' +
        'ELSE cai.clinic_name END AS clinic_name',  // CHANGED: Composite name
        'parent._id AS clinic_admin_id',  // ADDED: Parent reference
        'COALESCE(addr.address, \'\') AS clinic_address',
        'addr.district AS district',
      ])
      .from('accounts', 'branch')  // CHANGED: Start from branch
      .innerJoin('accounts', 'parent', 'parent._id = branch.parent_id')  // CHANGED: Join parent
      .innerJoin('clinic_admin_information', 'cai', 'cai.account_id = parent._id')  // CHANGED: Join parent info
      .innerJoin('clinic_manager_information', 'cmi', 'cmi.account_id = branch._id')  // ADDED: Join branch info
      .innerJoin('employee_schedule', 'es', 'es.clinic_id = branch._id')
      .innerJoin('clinic_shift', 'cs', 'cs._id = es.clinic_shift_id')
      .innerJoin('clinic_shift_hour', 'csh', 'csh.shift_id = cs._id')
      .leftJoin('addresses', 'addr', 'addr.account_id = branch._id')  // CHANGED: Get branch address
      .where('branch.role = :branchRole', { branchRole: AccountRole.CLINIC_MANAGER })  // CHANGED: Filter branches
      .andWhere('branch.status = :branchStatus', { branchStatus: 'ACTIVE' })
      .andWhere('parent.role = :parentRole', { parentRole: AccountRole.CLINIC_ADMIN })  // ADDED: Validate parent
      .andWhere('parent.status = :parentStatus', { parentStatus: 'ACTIVE' })
      .andWhere('es.deleted_at IS NULL')
      .andWhere('csh.deleted_at IS NULL')
      .andWhere('csh.limit > 0');

    // Add date filter only if working_date is provided
    if (working_date) {
      queryBuilder.andWhere('es.work_date = :workDate', { workDate: working_date });
    }

    queryBuilder
      .orderBy('parent_clinic_name', 'ASC')  // FIX: Use aliased column
      .addOrderBy('branch_name', 'ASC');  // FIX: Use aliased column

    // Add search filter (search both parent clinic name and branch name)
    if (search) {
      queryBuilder.andWhere(
        '(cai.clinic_name ILIKE :search OR cmi.clinic_branch_name ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    // Add district filter (use branch address)
    if (district) {
      queryBuilder.andWhere('addr.district ILIKE :district', {
        district: `%${district}%`,
      });
    }

    // Get total count before pagination
    const totalResults = await queryBuilder.getRawMany();
    const total = totalResults.length;

    // Apply pagination
    const offset = (page - 1) * limit;
    const clinicsRaw = await queryBuilder
      .limit(limit)
      .offset(offset)
      .getRawMany();

    // For each branch, calculate available slots and doctors
    const clinicsWithStats = await Promise.all(
      clinicsRaw.map(async (clinic) => {
        // Calculate available slots for THIS BRANCH only
        const slotsQueryBuilder = this.dataSource
          .createQueryBuilder()
          .select([
            'SUM(csh.limit) AS total_slots',
            'COUNT(DISTINCT es.employee_id) AS doctor_count',
          ])
          .from('employee_schedule', 'es')
          .innerJoin('clinic_shift', 'cs', 'cs._id = es.clinic_shift_id')
          .innerJoin('clinic_shift_hour', 'csh', 'csh.shift_id = cs._id')
          .where('es.clinic_id = :clinicId', { clinicId: clinic.clinic_id })  // CHANGED: Single branch
          .andWhere('es.deleted_at IS NULL')
          .andWhere('csh.deleted_at IS NULL')
          .andWhere('csh.limit > 0');

        // Add date filter only if working_date is provided
        if (working_date) {
          slotsQueryBuilder.andWhere('es.work_date = :workDate', { workDate: working_date });
        }

        const slotsQuery = await slotsQueryBuilder.getRawOne();

        // Count booked appointments for THIS BRANCH
        const bookedQueryBuilder = this.dataSource
          .createQueryBuilder()
          .select('COUNT(*) AS booked_count')
          .from('appointments', 'apt')
          .where('apt.clinic_id = :clinicId', { clinicId: clinic.clinic_id })  // CHANGED: Direct match
          .andWhere('apt.status IN (:...statuses)', {
            statuses: ['PENDING', 'CONFIRMED', 'CHECKED_IN'],
          })
          .andWhere('apt.deleted_at IS NULL');

        // Add date filter only if working_date is provided
        if (working_date) {
          bookedQueryBuilder.andWhere('apt.appointment_date = :workDate', { workDate: working_date });
        }

        const bookedQuery = await bookedQueryBuilder.getRawOne();

        const totalSlots = parseInt(slotsQuery?.total_slots || '0', 10);
        const bookedCount = parseInt(bookedQuery?.booked_count || '0', 10);
        const availableSlots = totalSlots - bookedCount;

        return {
          clinic_id: clinic.clinic_id,  // CLINIC_MANAGER._id
          clinic_name: clinic.clinic_name,  // "Parent Name - Branch Name"
          clinic_admin_id: clinic.clinic_admin_id,  // CLINIC_ADMIN._id (optional)
          clinic_address: clinic.clinic_address || '',
          district: clinic.district || null,
          available_slots: availableSlots > 0 ? availableSlots : 0,
          available_doctors: parseInt(slotsQuery?.doctor_count || '0', 10),
        };
      }),
    );

    // Filter out clinics with 0 available slots
    const filteredClinics = clinicsWithStats.filter((c) => c.available_slots > 0);

    return {
      data: filteredClinics,
      total: filteredClinics.length,
      page,
      limit,
      total_pages: Math.ceil(filteredClinics.length / limit),
    };
  }

  /**
   * Add extra service to an existing appointment
   *
   * @param appointmentId - Appointment UUID
   * @param clinicServiceConfigId - Clinic service config UUID
   * @returns Created extra package and service link
   */
  async addExtraService(appointmentId: string, clinicServiceConfigId: string) {
    const appointment = await this.appointmentRepository.findOne({
      where: { _id: appointmentId },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    return await this.dataSource.transaction(async (manager) => {
      // 1. Load service config
      // FIX: Use QueryBuilder to properly check parent service's deletedAt
      const serviceConfig = await manager
        .createQueryBuilder(ClinicServiceConfig, 'csc')
        .leftJoinAndSelect('csc.service', 'service')
        .where('csc._id = :configId', { configId: clinicServiceConfigId })
        .andWhere('csc.clinic_id = :clinicId', { clinicId: appointment.clinicId })
        .andWhere('csc.is_active = :isActive', { isActive: true })
        .andWhere('csc.deleted_at IS NULL')
        .andWhere('service.deleted_at IS NULL') // CRITICAL: Check parent service not deleted
        .andWhere('service.is_active = :serviceActive', { serviceActive: true })
        .getOne();

      if (!serviceConfig) {
        throw new BadRequestException('Service is not available');
      }

      // 2. Calculate price
      const basePrice = parseFloat(serviceConfig.price.toString());
      const discount = serviceConfig.discount
        ? parseFloat(serviceConfig.discount.toString())
        : 0;
      const finalPrice = basePrice - (basePrice * discount) / 100;

      // 3. Create new AppointmentPackage
      const packageRepo = manager.getRepository(AppointmentPackage);
      const extraPackage = packageRepo.create({
        appointmentId: appointment._id,
        amount: Math.round(finalPrice),
        status: AppointmentPackageStatus.PENDING_PAYMENT,
        paymentType: PaymentType.ONLINE,
      });
      const savedPackage = await packageRepo.save(extraPackage);

      // 4. Create ServiceAppointment link
      const serviceAppointmentRepo = manager.getRepository(ServiceAppointment);
      const serviceAppointment = serviceAppointmentRepo.create({
        clinicServiceId: clinicServiceConfigId,
        appointmentPackageId: savedPackage._id,
      });
      await serviceAppointmentRepo.save(serviceAppointment);

      // 5. Update Appointment Total
      const newTotal = parseFloat(appointment.total.toString()) + finalPrice;
      await manager.getRepository(Appointment).update(
        { _id: appointmentId },
        { total: newTotal },
      );

      return {
        packageId: savedPackage._id,
        serviceName: serviceConfig.service?.serviceName || 'N/A',
        amount: finalPrice,
        newTotal,
      };
    });
  }

  /**
   * Get Clinic Schedules (VERSION 4.5 - Option 1 & Option 3)
   * 
   * Gộp 2 API cũ (working-days + slots) thành 1 API duy nhất.
   * Returns nested structure: Dates -> Shifts -> Slots with Doctor info.
   * 
   * VERSION 4.5: Thêm tham số working_date (optional)
   * - Nếu có working_date: Trả về lịch của ngày cụ thể (Option 3)
   * - Nếu không có working_date: Trả về lịch 60 ngày tới (Option 1)
   * 
   * Business Logic:
   * - Query employee_schedule for clinic_id
   * - NẾU có working_date: Filter by work_date = working_date
   * - NẾU KHÔNG có working_date: Filter by date range [today, today+60]
   * - JOIN clinic_shift, clinic_shift_hour
   * - Calculate available_slots for each slot
   * - Transform in TypeScript: Group by Date -> Shift -> Slots
   * 
   * @param clinicId - Clinic UUID (CLINIC_ADMIN or CLINIC_MANAGER)
   * @param workingDate - Optional date filter (YYYY-MM-DD)
   * @returns Nested schedule structure: dates -> shifts -> slots
   */
  async getClinicSchedules(clinicId: string, workingDate?: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 60);

    // Validate working_date if provided
    if (workingDate) {
      const date = new Date(workingDate);
      if (isNaN(date.getTime())) {
        throw new BadRequestException('Invalid date format. Use YYYY-MM-DD');
      }
      
      // Validate date is within valid range
      if (date < today) {
        throw new BadRequestException('Date must be today or in the future');
      }
      
      if (date > maxDate) {
        throw new BadRequestException('Date cannot be more than 60 days in the future');
      }
    }

    // Get all clinic branches (CLINIC_MANAGER) for this clinic (CLINIC_ADMIN)
    const branches = await this.dataSource
      .createQueryBuilder()
      .select('_id')
      .from('accounts', 'acc')
      .where('acc.parent_id = :clinicId', { clinicId })
      .andWhere('acc.role = :role', { role: 'CLINIC_MANAGER' })
      .andWhere('acc.status = :status', { status: 'ACTIVE' })
      .andWhere('acc.deleted_at IS NULL')
      .getRawMany();

    const branchIds = branches.map((b) => b._id);

    if (branchIds.length === 0) {
      // If no branches, treat clinicId as a branch itself
      branchIds.push(clinicId);
    }

    // Build query with conditional date filtering
    const queryBuilder = this.dataSource
      .createQueryBuilder()
      .select([
        'es.work_date AS work_date',
        'es.week_day AS week_day',
        'cs.shift AS shift_type',
        'csh._id AS clinic_shift_hour_id',
        'doctor._id AS doctor_id',
        'COALESCE(di.full_name, doctor.username) AS doctor_name',
        'di.position AS doctor_specialty',
        'csh.start_hour AS start_time',
        'csh.end_hour AS end_time',
        'csh.limit AS limit',
        'cr.room_name AS clinic_room',
      ])
      .from('employee_schedule', 'es')
      .innerJoin('accounts', 'doctor', 'doctor._id = es.employee_id')
      .leftJoin('doctor_information', 'di', 'di.account_id = doctor._id')
      .innerJoin('clinic_shift', 'cs', 'cs._id = es.clinic_shift_id')
      .innerJoin('clinic_shift_hour', 'csh', 'csh.shift_id = cs._id')
      .leftJoin('clinic_room_employee_schedule', 'cres', 'cres.employee_schedule_id = es._id')
      .leftJoin('clinic_room', 'cr', 'cr._id = cres.clinic_room_id')
      .where('es.clinic_id IN (:...branchIds)', { branchIds })
      .andWhere('es.deleted_at IS NULL')
      .andWhere('csh.deleted_at IS NULL')
      .andWhere('csh.limit > 0')
      .andWhere('doctor.role = :doctorRole', { doctorRole: 'DOCTOR' })
      .andWhere('doctor.status = :doctorStatus', { doctorStatus: 'ACTIVE' });

    // Conditional date filtering
    if (workingDate) {
      // Option 3: Filter by specific date
      queryBuilder.andWhere('es.work_date = :workingDate', { workingDate });
    } else {
      // Option 1: Filter by date range (today to today+60)
      queryBuilder
        .andWhere('es.work_date >= :today', { today })
        .andWhere('es.work_date <= :maxDate', { maxDate });
    }

    // Query RAW DATA - Get ALL records without grouping in SQL
    const rawSlots = await queryBuilder
      .orderBy('es.work_date', 'ASC')
      .addOrderBy('cs.shift', 'ASC')
      .addOrderBy('csh.start_hour', 'ASC')
      .getRawMany();

    if (rawSlots.length === 0) {
      return { data: [] };
    }

    // Calculate available_slots for each slot
    const enrichedSlots = await Promise.all(
      rawSlots.map(async (slot) => {
        const appointmentCount = await this.dataSource
          .createQueryBuilder()
          .select('COUNT(*)', 'count')
          .from('appointments', 'a')
          .where('a.clinic_shift_hour_id = :shiftHourId', {
            shiftHourId: slot.clinic_shift_hour_id,
          })
          .andWhere('a.appointment_date = :date', { 
            date: this.toVietnamDateString(slot.work_date)
          })
          .andWhere(
            "a.status IN ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS')",
          )
          .andWhere('a.deleted_at IS NULL')
          .getRawOne();

        const bookedCount = parseInt(appointmentCount?.count || '0');
        const availableSlots = slot.limit - bookedCount;

        return {
          ...slot,
          available_slots: availableSlots,
        };
      }),
    );

    // Filter out fully booked slots
    const availableSlots = enrichedSlots.filter((s) => s.available_slots > 0);

    // DATA TRANSFORMATION: Group by Date -> Shift -> Slots
    const dateMap = new Map<string, any>();

    for (const slot of availableSlots) {
      const dateKey = this.toVietnamDateString(slot.work_date);

      // Level 1: Date
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, {
          date: slot.work_date,
          week_day: slot.week_day,
          shifts: new Map<string, any>(),
        });
      }

      const dateData = dateMap.get(dateKey);

      // Level 2: Shift
      const shiftType = slot.shift_type;
      if (!dateData.shifts.has(shiftType)) {
        dateData.shifts.set(shiftType, {
          shift: shiftType,
          slots: [],
        });
      }

      const shiftData = dateData.shifts.get(shiftType);

      // Level 3: Slot
      shiftData.slots.push({
        clinic_shift_hour_id: slot.clinic_shift_hour_id,
        doctor_id: slot.doctor_id,
        doctor_name: slot.doctor_name,
        doctor_specialty: slot.doctor_specialty,
        start_time: slot.start_time,
        end_time: slot.end_time,
        limit: slot.limit,
        available_slots: slot.available_slots,
        clinic_room: slot.clinic_room,
      });
    }

    // Convert Maps to Arrays
    const result = Array.from(dateMap.values()).map((dateData) => ({
      date: this.toVietnamDateString(dateData.date), // Format as YYYY-MM-DD string in VN timezone
      week_day: dateData.week_day,
      shifts: Array.from(dateData.shifts.values()),
    }));

    return { data: result };
  }

  /**
   * Get Doctor Schedules (VERSION 4.4 - Option 2: Doctor-first - Step 2)
   * 
   * TÁCH RỜI LỊCH KHÁM VÀ DỊCH VỤ
   * API này CHỈ trả về lịch khám (dates, shifts, slots).
   * KHÔNG trả về services - services được lấy từ API riêng getDoctorServices.
   * 
   * Business Logic:
   * - Query employee_schedule for doctor_id, date range [today, today+60]
   * - JOIN clinic_shift, clinic_shift_hour
   * - Calculate available_slots for each slot
   * - Transform in TypeScript: Group by Date -> Shift -> Slots
   * 
   * @param doctorId - Doctor UUID
   * @param clinicId - Clinic UUID (REQUIRED)
   * @returns Nested schedule structure only (no services)
   */
  async getDoctorSchedules(doctorId: string, clinicId: string) {
    if (!clinicId) {
      throw new BadRequestException('clinic_id is required');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 60);

    // Build base query for RAW DATA
    const queryBuilder = this.dataSource
      .createQueryBuilder()
      .select([
        'es.work_date AS work_date',
        'es.week_day AS week_day',
        'cs.shift AS shift_type',
        'csh._id AS clinic_shift_hour_id',
        'csh.start_hour AS start_time',
        'csh.end_hour AS end_time',
        'csh.limit AS limit',
        'cr.room_name AS clinic_room',
      ])
      .from('employee_schedule', 'es')
      .innerJoin('accounts', 'clinic', 'clinic._id = es.clinic_id')
      .innerJoin('clinic_shift', 'cs', 'cs._id = es.clinic_shift_id')
      .innerJoin('clinic_shift_hour', 'csh', 'csh.shift_id = cs._id')
      .leftJoin('clinic_room_employee_schedule', 'cres', 'cres.employee_schedule_id = es._id')
      .leftJoin('clinic_room', 'cr', 'cr._id = cres.clinic_room_id')
      .where('es.employee_id = :doctorId', { doctorId })
      .andWhere('es.clinic_id = :clinicId', { clinicId })
      .andWhere('es.work_date >= :today', { today })
      .andWhere('es.work_date <= :maxDate', { maxDate })
      .andWhere('es.deleted_at IS NULL')
      .andWhere('csh.deleted_at IS NULL')
      .andWhere('csh.limit > 0')
      .andWhere('clinic.status = :status', { status: 'ACTIVE' })
      .andWhere('clinic.deleted_at IS NULL');

    const rawSlots = await queryBuilder
      .orderBy('es.work_date', 'ASC')
      .addOrderBy('cs.shift', 'ASC')
      .addOrderBy('csh.start_hour', 'ASC')
      .getRawMany();

    if (rawSlots.length === 0) {
      return { data: [] };
    }

    // Calculate available_slots for each slot
    const enrichedSlots = await Promise.all(
      rawSlots.map(async (slot) => {
        const appointmentCount = await this.dataSource
          .createQueryBuilder()
          .select('COUNT(*)', 'count')
          .from('appointments', 'a')
          .where('a.clinic_shift_hour_id = :shiftHourId', {
            shiftHourId: slot.clinic_shift_hour_id,
          })
          .andWhere('a.appointment_date = :date', { 
            date: this.toVietnamDateString(slot.work_date)
          })
          .andWhere(
            "a.status IN ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS')",
          )
          .andWhere('a.deleted_at IS NULL')
          .getRawOne();

        const bookedCount = parseInt(appointmentCount?.count || '0');
        const availableSlots = slot.limit - bookedCount;

        return {
          ...slot,
          available_slots: availableSlots,
        };
      }),
    );

    // Filter out fully booked slots
    const availableSlots = enrichedSlots.filter((s) => s.available_slots > 0);

    // DATA TRANSFORMATION: Group by Date -> Shift -> Slots
    const dateMap = new Map<string, any>();

    for (const slot of availableSlots) {
      const dateKey = this.toVietnamDateString(slot.work_date);

      // Level 1: Date
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, {
          date: slot.work_date,
          week_day: slot.week_day,
          shifts: new Map<string, any>(),
        });
      }

      const dateData = dateMap.get(dateKey);

      // Level 2: Shift
      const shiftType = slot.shift_type;
      if (!dateData.shifts.has(shiftType)) {
        dateData.shifts.set(shiftType, {
          shift: shiftType,
          slots: [],
        });
      }

      const shiftData = dateData.shifts.get(shiftType);

      // Level 3: Slot
      shiftData.slots.push({
        clinic_shift_hour_id: slot.clinic_shift_hour_id,
        start_time: slot.start_time,
        end_time: slot.end_time,
        limit: slot.limit,
        available_slots: slot.available_slots,
        clinic_room: slot.clinic_room,
      });
    }

    // Convert Maps to Arrays
    const schedules = Array.from(dateMap.values()).map((dateData) => ({
      date: dateData.date,
      week_day: dateData.week_day,
      shifts: Array.from(dateData.shifts.values()),
    }));

    return { data: schedules };
  }
}
