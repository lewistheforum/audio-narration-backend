import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { DataSource, IsNull } from 'typeorm';
import {
  getCurrentVietnamTime,
  addToVietnamTime,
  getStartOfDay,
  getDateString,
  formatToVietnamTime,
  isInPast,
} from 'src/common/utils/date.util';
import {
  AppointmentRepository,
  AppointmentPackageRepository,
} from './repositories';
import {
  ClinicStaffInformationRepository,
  AccountRepository,
} from '../accounts/repositories';
import { AccountRole } from '../accounts/enums';
import { EmployeeScheduleRepository } from '../schedules/repositories/employee-schedule.repository';
import {
  QueryAppointmentDto,
  AppointmentResponseDto,
  PaginatedAppointmentResponseDto,
  CreateAppointmentDto,
  StaffCreateAppointmentDto,
  CancelAppointmentDto,
  StaffCancelAppointmentDto,
  PatientCancelAppointmentDto,
  RescheduleAppointmentDto,
  StaffRescheduleAppointmentDto,
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
  DoctorPatientHistoryQueryDto,
  DoctorPatientHistoryResponseDto,
  DoctorPatientAppointmentsQueryDto,
  DoctorPatientDetailResponseDto,
  DoctorAppointmentHistoryDetailResponseDto,
  PatientVisitStatisticsDto,
  PatientAppointmentHistoryItemDto,
  AppointmentServiceSummaryDto,
  DoctorViewPatientDetailDto,
  AppointmentPatientInfoDto,
  AppointmentDoctorInfoDto,
  AppointmentClinicInfoDto,
  AppointmentShiftHourInfoDto,
  AppointmentServiceDetailDto,
  AppointmentERMSummaryDto,
  AppointmentPrescriptionDto,
  PrescriptionMedicineDto,
  PaymentPackageDto,
  PatientAddressDto,
} from './dto';
import { MESSAGES } from 'src/common/message';
import {
  Appointment,
  AppointmentPackage,
  ServiceAppointment,
} from './entities';
import {
  AppointmentStatus,
  AppointmentPackageStatus,
  PaymentType,
} from './enums';
import { ERMRecordType, ERMStatus } from '../prescriptions/enums';
import { ERM } from '../prescriptions/entities/erm.entity';
import { EPrescription } from '../prescriptions/entities/e-prescription.entity';
import { ClinicServiceConfig } from '../service-configs/entities/clinic-service-config.entity';
import { BookingSessionService } from './booking-session.service';
import {
  MailerService,
  AppointmentReminderContext,
} from '../mailer/mailer.service';
import { SendReminderResponseDto, SendReminderBulkResponseDto } from './dto';
import { AiCreateAppointmentDto } from './dto/ai-create-appointment.dto';

/**
 * Appointments Service
 *
 * Handles business logic for appointment management
 *
 * Features:
 * - Staff viewing clinic appointments
 * - Filtering by status and date
 * - Pagination support
 * - Doctor accepting appointments (PENDING ΓåÆ CONFIRMED)
 * - Doctor declining appointments (PENDING ΓåÆ CANCELLED)
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
    private readonly mailerService: MailerService,
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
    const staffAccount =
      await this.accountRepository.findAccountById(staffAccountId);

    if (
      !staffAccount ||
      staffAccount.role !== AccountRole.CLINIC_STAFF ||
      !staffAccount.parentId
    ) {
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
   * Get all appointments with extra_hour for staff's clinic
   *
   * Allows clinic staff to view appointments that have extra_hour
   * with optional filtering by status and date, plus pagination
   *
   * @param staffAccountId - Staff account UUID
   * @param queryDto - Query parameters (filters, pagination)
   * @returns Paginated list of appointments with extra_hour
   * @throws NotFoundException if staff information not found
   */
  async getAppointmentsWithExtraHourForStaff(
    staffAccountId: string,
    queryDto: QueryAppointmentDto,
  ): Promise<PaginatedAppointmentResponseDto> {
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

    // Get clinic ID from staff's parent account (clinic manager)
    const clinicId = staffAccount.parentId;

    // Prepare filters
    const filters = {
      status: queryDto.status,
      appointmentDate: queryDto.appointmentDate,
    };

    // Query appointments with extra_hour and pagination
    const [appointments, total] =
      await this.appointmentRepository.findByClinicWithExtraHourPagination(
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

    // Convert date strings to Date objects
    const appointmentDate = new Date(createDto.appointmentDate);
    const appointmentHour = new Date(createDto.appointmentHour);
    const extraHour = createDto.extraHour
      ? new Date(createDto.extraHour)
      : null;

    // Validate slot capacity for shift-hour bookings.
    // A slot is full only when appointment count reaches clinic_shift_hour.limit.
    if (createDto.clinicShiftHourId) {
      await this.validateShiftHourCapacity(
        clinicId,
        createDto.clinicShiftHourId,
        appointmentDate,
      );
    } else {
      // For non-shift-hour bookings, keep exact hour conflict check.
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
            'Thß╗¥i gian hß║╣n n├áy ─æ├ú c├│ ng╞░ß╗¥i ─æß║╖t. Vui l├▓ng chß╗ìn thß╗¥i gian kh├íc.',
        );
        if (existingAppointments.length > 0) {
          throw new ConflictException(
            'This time slot is already booked. Please choose another time.',
          );
        }
      }

      // Execute transaction to create appointment + package + services
      return await this.dataSource.transaction(async (manager) => {
        // Query service prices and discounts from clinic_service_config
        const serviceIds = createDto.services.map((s) => s.clinicServiceId);
        const serviceConfigs = await manager
          .createQueryBuilder()
          .select('config._id', 'id')
          .addSelect('config.price', 'price')
          .addSelect('config.discount', 'discount')
          .from('clinic_service_config', 'config')
          .where('config._id IN (:...serviceIds)', { serviceIds })
          .andWhere('config.clinic_id = :clinicId', { clinicId })
          .andWhere('config.is_active = :isActive', { isActive: true })
          .andWhere('config.deleted_at IS NULL')
          .getRawMany();

        // Validate all services exist and are active
        if (serviceConfigs.length !== serviceIds.length) {
          throw new BadRequestException(
            `One or more services not found or inactive for this clinic. Expected ${serviceIds.length} services, found ${serviceConfigs.length}`,
          );
        }

        // Create Map: clinicServiceId -> { price, discount }
        const serviceConfigMap = new Map(
          serviceConfigs.map((config) => [
            config.id,
            {
              price: parseFloat(config.price),
              discount: parseFloat(config.discount || 0),
            },
          ]),
        );

        // Calculate package amount from services (price - discount)
        const packageAmount = serviceConfigs.reduce((sum, config) => {
          const price = parseFloat(config.price);
          const discount = parseFloat(config.discount || 0);
          const finalPrice = (price * (100 - discount)) / 100;
          return sum + finalPrice;
        }, 0);

        // 1. Create appointment (total will be calculated from all packages)
        // In this API, there's only one package, so total = packageAmount
        const appointment = manager.create(Appointment, {
          patientId: createDto.patientId,
          clinicId: clinicId,
          doctorId: createDto.doctorId || null,
          clinicShiftHourId: createDto.clinicShiftHourId || null,
          appointmentDate: appointmentDate,
          appointmentHour: appointmentHour,
          extraHour: extraHour,
          total: packageAmount,
          patientNote: createDto.patientNote || null,
          status: AppointmentStatus.PENDING,
          rejectReason: null,
        });

        const savedAppointment = await manager.save(Appointment, appointment);

        // 2. Create appointment package with calculated amount
        // paymentStatus defaults to PENDING_PAYMENT and paymentType to COD
        const appointmentPackage = manager.create(AppointmentPackage, {
          appointmentId: savedAppointment._id,
          transactionId: null, // Will be updated when payment is processed
          amount: packageAmount,
          status: AppointmentPackageStatus.PENDING_PAYMENT,
          paymentType: PaymentType.COD,
        });

        const savedPackage = await manager.save(
          AppointmentPackage,
          appointmentPackage,
        );

        // 3. Create service appointments with price and discount snapshots
        const serviceAppointments = createDto.services.map((service) => {
          const config = serviceConfigMap.get(service.clinicServiceId);
          return manager.create(ServiceAppointment, {
            clinicServiceId: service.clinicServiceId,
            appointmentPackageId: savedPackage._id,
            price: config?.price || 0,
            discount: config?.discount || 0,
          });
        });

        await manager.save(ServiceAppointment, serviceAppointments);

        // Fetch complete appointment with relations for response
        const appointmentWithRelations = await manager.findOne(Appointment, {
          where: { _id: savedAppointment._id },
          relations: [
            'patient',
            'patient.generalAccount',
            'patient.addresses',
            'clinic',
            'clinic.clinicManagerInformation',
            'doctor',
            'doctor.doctorInformation',
          ],
        });

        // Fetch services for the created appointment (use manager to ensure transaction visibility)
        const servicesRaw = await manager
          .createQueryBuilder()
          .select([
            'clinicService._id AS id',
            'clinicService.service_name AS serviceName',
            'clinicService.description AS description',
            'serviceAppointment.price AS price',
            'serviceAppointment.discount AS discount',
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
          discount: row.discount ? parseFloat(row.discount) : 0,
        }));

        // Fetch clinic rooms if doctor shift is assigned
        let clinicRooms = [];

        if (savedAppointment.clinicShiftHourId && savedAppointment.doctorId) {
          // Query clinic rooms directly without needing appointment_id
          const roomsResult = await manager
            .createQueryBuilder()
            .select('cr._id', 'roomId')
            .addSelect('cr.room_name', 'roomName')
            .from('clinic_shift_hour', 'csh')
            .innerJoin('clinic_shift', 'cs', 'cs._id = csh.shift_id')
            .innerJoin('employee_schedule', 'es', 'es.clinic_shift_id = cs._id')
            .innerJoin(
              'clinic_room_employee_schedule',
              'cres',
              'cres.employee_schedule_id = es._id',
            )
            .innerJoin('clinic_room', 'cr', 'cr._id = cres.clinic_room_id')
            .where('csh._id = :clinicShiftHourId', {
              clinicShiftHourId: savedAppointment.clinicShiftHourId,
            })
            .andWhere('es.employee_id = :doctorId', {
              doctorId: savedAppointment.doctorId,
            })
            .andWhere('es.work_date = :appointmentDate', {
              appointmentDate: savedAppointment.appointmentDate,
            })
            .andWhere('es.deleted_at IS NULL')
            .andWhere('cr.deleted_at IS NULL')
            .getRawMany();

          clinicRooms = roomsResult.map((row) => ({
            id: row.roomId,
            roomName: row.roomName,
          }));
        }

        return this.transformToResponseDto(
          appointmentWithRelations!,
          services,
          clinicRooms,
        );
      });
    }
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
    const extraHour = createDto.extraHour
      ? new Date(createDto.extraHour)
      : null;

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
        'Thß╗¥i gian hß║╣n n├áy ─æ├ú c├│ ng╞░ß╗¥i ─æß║╖t. Vui l├▓ng chß╗ìn thß╗¥i gian kh├íc.',
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
    const dateChanged =
      newAppointmentDate.getTime() !== appointment.appointmentDate.getTime();
    const shiftChanged =
      rescheduleDto.clinicShiftHourId !== appointment.clinicShiftHourId;

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

      const existingAppointments =
        await this.appointmentRepository.find(conflictWhere);

      // Filter out the current appointment from conflicts
      const conflicts = existingAppointments.filter(
        (appt) => appt._id !== appointmentId,
      );

      if (conflicts.length > 0) {
        throw new ConflictException(
          'Thß╗¥i gian mß╗¢i n├áy ─æ├ú c├│ ng╞░ß╗¥i ─æß║╖t. Vui l├▓ng chß╗ìn thß╗¥i gian kh├íc.',
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
   * Staff cancel appointment
   *
   * Allows staff to cancel appointments with optional patient note
   *
   * @param appointmentId - Appointment UUID
   * @param cancelDto - Cancellation data (optional patient note)
   * @returns Updated appointment details
   * @throws NotFoundException if appointment not found
   * @throws BadRequestException if appointment cannot be cancelled
   */
  async staffCancelAppointment(
    appointmentId: string,
    cancelDto: StaffCancelAppointmentDto,
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

    // Store cancellation note in patientNote if provided
    if (cancelDto.patientNote) {
      appointment.patientNote = cancelDto.patientNote;
    }

    // Save changes
    const updatedAppointment =
      await this.appointmentRepository.save(appointment);

    // Load services and clinic rooms
    const { services, clinicRooms } =
      await this.loadAppointmentServicesAndRooms(updatedAppointment);

    return this.transformToResponseDto(
      updatedAppointment,
      services,
      clinicRooms,
    );
  }

  /**
   * Patient cancel their own appointment
   *
   * Allows patients to cancel their own appointments with optional note
   *
   * @param appointmentId - Appointment UUID
   * @param patientId - Patient account ID (from authenticated user)
   * @param cancelDto - Cancellation data (optional patient note)
   * @returns Updated appointment details
   * @throws NotFoundException if appointment not found
   * @throws ForbiddenException if user is not the patient of this appointment
   * @throws BadRequestException if appointment cannot be cancelled
   */
  async patientCancelAppointment(
    appointmentId: string,
    patientId: string,
    cancelDto: PatientCancelAppointmentDto,
  ): Promise<AppointmentResponseDto> {
    // Find appointment with relations
    const appointment =
      await this.appointmentRepository.findByIdWithRelations(appointmentId);

    if (!appointment || appointment.deletedAt) {
      throw new NotFoundException('Appointment not found');
    }

    // Verify patient owns this appointment
    if (appointment.patientId !== patientId) {
      throw new ForbiddenException('You can only cancel your own appointments');
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

    // Store cancellation note in patientNote if provided
    if (cancelDto.patientNote) {
      appointment.patientNote = cancelDto.patientNote;
    }

    // Save changes
    const updatedAppointment =
      await this.appointmentRepository.save(appointment);

    // Load services and clinic rooms
    const { services, clinicRooms } =
      await this.loadAppointmentServicesAndRooms(updatedAppointment);

    return this.transformToResponseDto(
      updatedAppointment,
      services,
      clinicRooms,
    );
  }

  /**
   * Staff reschedule appointment
   *
   * Allows staff to reschedule appointments to a new date, shift hour, extra hour, or extra room
   * All fields are optional. If clinicShiftHourId is provided, appointment date will be auto-updated.
   *
   * @param appointmentId - Appointment UUID
   * @param rescheduleDto - Reschedule data (new date, shift hour, extra hour, or extra room - all optional)
   * @returns Updated appointment details
   * @throws NotFoundException if appointment or shift hour not found
   * @throws BadRequestException if appointment cannot be rescheduled or no fields provided
   * @throws ConflictException if new time slot is already booked
   */
  async staffRescheduleAppointment(
    appointmentId: string,
    rescheduleDto: StaffRescheduleAppointmentDto,
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

    // Validate at least one field is provided
    if (
      !rescheduleDto.appointmentDate &&
      !rescheduleDto.clinicShiftHourId &&
      rescheduleDto.extraHour === undefined &&
      rescheduleDto.extraRoomId === undefined
    ) {
      throw new BadRequestException(
        'At least one field (appointmentDate, clinicShiftHourId, extraHour, or extraRoomId) must be provided',
      );
    }

    let newAppointmentDate = new Date(appointment.appointmentDate);
    let newClinicShiftHourId = appointment.clinicShiftHourId;
    let newExtraHour = appointment.extraHour;
    let newExtraRoomId = appointment.extraRoomId;
    let newAppointmentHour = new Date(appointment.appointmentHour);

    // Handle updates to standard shift or date
    if (rescheduleDto.clinicShiftHourId || rescheduleDto.appointmentDate) {
      const targetShiftHourId =
        rescheduleDto.clinicShiftHourId || appointment.clinicShiftHourId;

      // Ensure we have a valid shift hour ID to work with
      if (!targetShiftHourId) {
        throw new BadRequestException(
          'Appointment does not have a shift hour and none was provided',
        );
      }

      let targetDate: Date;
      if (rescheduleDto.appointmentDate) {
        targetDate = new Date(rescheduleDto.appointmentDate);
      } else {
        targetDate = new Date(appointment.appointmentDate);
      }
      targetDate.setHours(0, 0, 0, 0);

      // Check if doctor has schedule for this specific shift and date
      const specificSchedule = await this.dataSource
        .createQueryBuilder()
        .select('csh._id', 'shiftHourId')
        .addSelect('csh.start_hour', 'startHour')
        .addSelect('es.work_date', 'workDate')
        .from('clinic_shift_hour', 'csh')
        .innerJoin('clinic_shift', 'cs', 'cs._id = csh.shift_id')
        .innerJoin('employee_schedule', 'es', 'es.clinic_shift_id = cs._id')
        .where('csh._id = :shiftHourId', { shiftHourId: targetShiftHourId })
        .andWhere('es.employee_id = :doctorId', {
          doctorId: appointment.doctorId,
        })
        .andWhere('es.work_date = :workDate', { workDate: targetDate })
        .andWhere('csh.deleted_at IS NULL')
        .andWhere('es.deleted_at IS NULL')
        .getRawOne();

      if (specificSchedule) {
        newClinicShiftHourId = targetShiftHourId;
        newAppointmentDate = targetDate;

        // Update appointmentHour from shift startHour
        if (specificSchedule.startHour) {
          const [h, m] = specificSchedule.startHour.split(':');
          newAppointmentHour = new Date(targetDate);
          newAppointmentHour.setHours(parseInt(h), parseInt(m), 0, 0);
        }
      } else {
        // If date was explicitly provided, it MUST be valid
        if (rescheduleDto.appointmentDate) {
          throw new BadRequestException(
            'Doctor does not have a schedule for this shift on the selected date',
          );
        }

        // If only shift was provided, fallback to finding the first available date for that shift
        const alternativeSchedule = await this.dataSource
          .createQueryBuilder()
          .select('es.work_date', 'workDate')
          .addSelect('csh.start_hour', 'startHour')
          .from('clinic_shift_hour', 'csh')
          .innerJoin('clinic_shift', 'cs', 'cs._id = csh.shift_id')
          .innerJoin('employee_schedule', 'es', 'es.clinic_shift_id = cs._id')
          .where('csh._id = :shiftHourId', { shiftHourId: targetShiftHourId })
          .andWhere('es.employee_id = :doctorId', {
            doctorId: appointment.doctorId,
          })
          .andWhere('es.work_date >= :today', {
            today: getDateString(),
          })
          .andWhere('csh.deleted_at IS NULL')
          .andWhere('es.deleted_at IS NULL')
          .orderBy('es.work_date', 'ASC')
          .limit(1)
          .getRawOne();

        if (!alternativeSchedule) {
          throw new NotFoundException(
            'Doctor does not have any future schedule for the requested shift',
          );
        }

        newClinicShiftHourId = targetShiftHourId;
        newAppointmentDate = new Date(alternativeSchedule.workDate);

        // Update appointmentHour from shift startHour
        if (alternativeSchedule.startHour) {
          const [h, m] = alternativeSchedule.startHour.split(':');
          newAppointmentHour = new Date(newAppointmentDate);
          newAppointmentHour.setHours(parseInt(h), parseInt(m), 0, 0);
        }
      }
    }

    // If extraHour is provided, update it
    if (rescheduleDto.extraHour !== undefined) {
      newExtraHour = rescheduleDto.extraHour
        ? new Date(rescheduleDto.extraHour)
        : null;
      if (newExtraHour) {
        newAppointmentHour = new Date(newExtraHour);
      }
    }

    // If extraRoomId is provided, update it
    if (rescheduleDto.extraRoomId !== undefined) {
      newExtraRoomId = rescheduleDto.extraRoomId || null;
    }

    // Check for conflicts if date or shift changed
    const dateChanged =
      newAppointmentDate.getTime() !==
        new Date(appointment.appointmentDate).getTime() ||
      newAppointmentHour.getTime() !==
        new Date(appointment.appointmentHour).getTime();
    const shiftChanged = newClinicShiftHourId !== appointment.clinicShiftHourId;

    if (dateChanged || shiftChanged) {
      if (newClinicShiftHourId) {
        await this.validateShiftHourCapacity(
          appointment.clinicId,
          newClinicShiftHourId,
          newAppointmentDate,
          appointmentId,
        );
      } else {
        // For non-shift-hour bookings, keep exact hour conflict check.
        const existingAppointments = await this.appointmentRepository.find({
          clinicId: appointment.clinicId,
          appointmentDate: newAppointmentDate,
          appointmentHour: appointment.appointmentHour,
          deletedAt: null,
          status: AppointmentStatus.PENDING,
        });

        const conflicts = existingAppointments.filter(
          (appt) => appt._id !== appointmentId,
        );

        if (conflicts.length > 0) {
          throw new ConflictException(
            'The new time slot is already booked. Please choose a different time.',
          );
        }
      }
    }

    // Update appointment fields
    appointment.appointmentDate = newAppointmentDate;
    appointment.appointmentHour = newAppointmentHour;
    appointment.clinicShiftHourId = newClinicShiftHourId;
    appointment.extraHour = newExtraHour;
    appointment.extraRoomId = newExtraRoomId;

    // Save changes
    const updatedAppointment =
      await this.appointmentRepository.save(appointment);

    // Load services and clinic rooms
    const { services, clinicRooms } =
      await this.loadAppointmentServicesAndRooms(updatedAppointment);

    return this.transformToResponseDto(
      updatedAppointment,
      services,
      clinicRooms,
    );
  }

  /**
   * Staff assign appointment to doctor (PENDING → PENDING_DOCTOR)
   *
   * Moves pending appointments with extra_hour to PENDING_DOCTOR status
   * This is for out-of-hours appointment requests that need doctor approval
   *
   * @param appointmentId - Appointment UUID
   * @returns Updated appointment details
   * @throws NotFoundException if appointment not found
   * @throws BadRequestException if appointment status is not PENDING or has no extra_hour
   */
  async staffAssignToDoctor(
    appointmentId: string,
  ): Promise<AppointmentResponseDto> {
    // Find appointment with relations
    const appointment =
      await this.appointmentRepository.findByIdWithRelations(appointmentId);

    if (!appointment || appointment.deletedAt) {
      throw new NotFoundException('Appointment not found');
    }

    // Validate current status - must be PENDING
    if (appointment.status !== AppointmentStatus.PENDING) {
      throw new BadRequestException(
        `Cannot assign appointment to doctor. Current status is "${appointment.status}", expected "PENDING"`,
      );
    }

    // Validate appointment has extra_hour (required for this workflow)
    if (!appointment.extraHour) {
      throw new BadRequestException(
        'Cannot assign to doctor: appointment does not have extra_hour (out-of-hours request)',
      );
    }

    // Update status to PENDING_DOCTOR
    appointment.status = AppointmentStatus.PENDING_DOCTOR;

    // Save changes
    const updatedAppointment =
      await this.appointmentRepository.save(appointment);

    // Load services and clinic rooms
    const { services, clinicRooms } =
      await this.loadAppointmentServicesAndRooms(updatedAppointment);

    return this.transformToResponseDto(
      updatedAppointment,
      services,
      clinicRooms,
    );
  }

  /**
   * Check in patient for appointment
   *
   * Changes appointment status to CHECKED_IN when patient arrives at clinic
   * Accepts both PENDING and CONFIRMED appointments
   *
   * @param appointmentId - Appointment UUID
   * @returns Updated appointment details
   * @throws NotFoundException if appointment not found
   * @throws BadRequestException if appointment status is not PENDING or CONFIRMED
   */
  async checkInPatient(appointmentId: string): Promise<AppointmentResponseDto> {
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

    // Load services and clinic rooms
    const { services, clinicRooms } =
      await this.loadAppointmentServicesAndRooms(updatedAppointment);

    return this.transformToResponseDto(
      updatedAppointment,
      services,
      clinicRooms,
    );
  }

  /**
   * Accept extra-hour appointment (Doctor only)
   *
   * Allows doctor to accept an extra-hour appointment.
   * Changes status from PENDING_DOCTOR to CONFIRMED.
   *
   * @param appointmentId - Appointment UUID
   * @param doctorId - Doctor's account UUID from JWT
   * @param acceptDto - Empty DTO (for future extensibility)
   * @returns Updated appointment details
   * @throws NotFoundException if appointment not found
   * @throws ForbiddenException if appointment not assigned to this doctor
   * @throws BadRequestException if appointment has no extra_hour or status is not PENDING_DOCTOR
   *
   * Business Rules:
   * - Only appointments with extra_hour can be accepted
   * - Only the assigned doctor can accept
   * - Status must be PENDING_DOCTOR
   * - After accept, status changes to CONFIRMED
   */
  async acceptAppointment(
    appointmentId: string,
    doctorId: string,
    acceptDto: AcceptAppointmentDto,
  ): Promise<AppointmentResponseDto> {
    // Find appointment with relations
    const appointment =
      await this.appointmentRepository.findByIdWithRelations(appointmentId);

    if (!appointment || appointment.deletedAt) {
      throw new NotFoundException(MESSAGES.failMessage.appointmentNotFound);
    }

    // Validate extra_hour exists
    if (!appointment.extraHour) {
      throw new BadRequestException(
        'This appointment has no extra hour and cannot be accepted through this endpoint',
      );
    }

    // Validate doctor ownership
    if (appointment.doctorId !== doctorId) {
      throw new ForbiddenException(
        'You do not have permission to accept this appointment',
      );
    }

    // Validate current status - only PENDING_DOCTOR appointments can be accepted
    if (appointment.status !== AppointmentStatus.PENDING_DOCTOR) {
      throw new BadRequestException(
        `Cannot accept appointment. Current status is ${appointment.status}, expected PENDING_DOCTOR`,
      );
    }

    // Update status to CONFIRMED
    appointment.status = AppointmentStatus.CONFIRMED;

    // Save changes
    const updatedAppointment =
      await this.appointmentRepository.save(appointment);

    // Load services and clinic rooms
    const { services, clinicRooms } =
      await this.loadAppointmentServicesAndRooms(updatedAppointment);

    return this.transformToResponseDto(
      updatedAppointment,
      services,
      clinicRooms,
    );
  }

  /**
   * Decline extra-hour appointment (Doctor only)
   *
   * Allows doctor to decline an extra-hour appointment.
   * Changes status to CANCELLED with reject reason.
   *
   * @param appointmentId - Appointment UUID
   * @param doctorId - Doctor's account UUID from JWT
   * @param declineDto - Reject reason (required)
   * @returns Updated appointment details
   * @throws NotFoundException if appointment not found
   * @throws ForbiddenException if appointment not assigned to this doctor
   * @throws BadRequestException if appointment has no extra_hour or status is not PENDING_DOCTOR
   *
   * Business Rules:
   * - Only appointments with extra_hour can be declined
   * - Only the assigned doctor can decline
   * - Status must be PENDING_DOCTOR
   * - After decline, status changes to CANCELLED
   * - Reject reason is required
   */
  async declineAppointment(
    appointmentId: string,
    doctorId: string,
    declineDto: DeclineAppointmentDto,
  ): Promise<AppointmentResponseDto> {
    // Find appointment with relations
    const appointment =
      await this.appointmentRepository.findByIdWithRelations(appointmentId);

    if (!appointment || appointment.deletedAt) {
      throw new NotFoundException(MESSAGES.failMessage.appointmentNotFound);
    }

    // Validate extra_hour exists
    if (!appointment.extraHour) {
      throw new BadRequestException(
        'This appointment has no extra hour and cannot be declined through this endpoint',
      );
    }

    // Validate doctor ownership
    if (appointment.doctorId !== doctorId) {
      throw new ForbiddenException(
        'You do not have permission to decline this appointment',
      );
    }

    // Validate current status - only PENDING_DOCTOR appointments can be declined
    if (appointment.status !== AppointmentStatus.PENDING_DOCTOR) {
      throw new BadRequestException(
        `Cannot decline appointment. Current status is ${appointment.status}, expected PENDING_DOCTOR`,
      );
    }

    // Update status to CANCELLED with reject reason
    appointment.status = AppointmentStatus.CANCELLED;
    appointment.rejectReason = declineDto.rejectReason;

    // Save changes
    const updatedAppointment =
      await this.appointmentRepository.save(appointment);

    // Load services and clinic rooms
    const { services, clinicRooms } =
      await this.loadAppointmentServicesAndRooms(updatedAppointment);

    return this.transformToResponseDto(
      updatedAppointment,
      services,
      clinicRooms,
    );
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
    this.validateStatusTransition(appointment.status, updateStatusDto.status);

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
   * Prevents invalid transitions (e.g., COMPLETED ΓåÆ PENDING)
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
        AppointmentStatus.PENDING_DOCTOR,
        AppointmentStatus.CONFIRMED,
        AppointmentStatus.CANCELLED,
      ],
      [AppointmentStatus.PENDING_DOCTOR]: [
        AppointmentStatus.CONFIRMED,
        AppointmentStatus.CANCELLED,
        AppointmentStatus.PENDING, // Allow reverting to pending if needed
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
   * Validate whether a clinic shift hour still has capacity on a specific date.
   * A slot is considered full only when booked count >= clinic_shift_hour.limit.
   */
  private async validateShiftHourCapacity(
    clinicId: string,
    clinicShiftHourId: string,
    appointmentDate: Date,
    excludeAppointmentId?: string,
  ): Promise<void> {
    const shiftHour = await this.dataSource
      .createQueryBuilder()
      .select('csh._id', 'id')
      .addSelect('csh.limit', 'limit')
      .from('clinic_shift_hour', 'csh')
      .innerJoin('clinic_shift', 'cs', 'cs._id = csh.shift_id')
      .where('csh._id = :clinicShiftHourId', { clinicShiftHourId })
      .andWhere('cs.clinic_id = :clinicId', { clinicId })
      .andWhere('csh.deleted_at IS NULL')
      .andWhere('cs.deleted_at IS NULL')
      .getRawOne();

    if (!shiftHour) {
      throw new NotFoundException(
        'Clinic shift hour not found for this clinic',
      );
    }

    const bookingCountQuery = this.dataSource
      .createQueryBuilder()
      .select('COUNT(app._id)', 'count')
      .from('appointments', 'app')
      .where('app.clinic_id = :clinicId', { clinicId })
      .andWhere('app.clinic_shift_hour_id = :clinicShiftHourId', {
        clinicShiftHourId,
      })
      .andWhere('app.appointment_date = :appointmentDate', { appointmentDate })
      .andWhere('app.deleted_at IS NULL')
      .andWhere('app.status != :cancelledStatus', {
        cancelledStatus: AppointmentStatus.CANCELLED,
      });

    if (excludeAppointmentId) {
      bookingCountQuery.andWhere('app._id != :excludeAppointmentId', {
        excludeAppointmentId,
      });
    }

    const countResult = await bookingCountQuery.getRawOne();
    const currentCount = Number(countResult?.count || 0);
    const slotLimit = Number(shiftHour.limit || 0);

    if (currentCount >= slotLimit) {
      throw new ConflictException(
        'Clinic shift hour is full. Please choose another slot.',
      );
    }
  }

  /**
   * Load services and clinic rooms for an appointment
   *
   * Helper method to fetch services and clinic rooms data for response DTOs
   *
   * @param appointment - Appointment entity
   * @returns Object with services and clinicRooms arrays
   */
  private async loadAppointmentServicesAndRooms(
    appointment: any,
  ): Promise<{ services: any[]; clinicRooms: any[] }> {
    // Load services
    const servicesMap =
      await this.appointmentPackageRepository.findServicesByAppointmentIds([
        appointment._id,
      ]);
    const services = servicesMap.get(appointment._id) || [];

    // Load clinic rooms if doctor shift is assigned
    let clinicRooms = [];

    if (appointment.clinicShiftHourId && appointment.doctorId) {
      const roomsResult = await this.dataSource
        .createQueryBuilder()
        .select('cr._id', 'roomId')
        .addSelect('cr.room_name', 'roomName')
        .from('clinic_shift_hour', 'csh')
        .innerJoin('clinic_shift', 'cs', 'cs._id = csh.shift_id')
        .innerJoin('employee_schedule', 'es', 'es.clinic_shift_id = cs._id')
        .innerJoin(
          'clinic_room_employee_schedule',
          'cres',
          'cres.employee_schedule_id = es._id',
        )
        .innerJoin('clinic_room', 'cr', 'cr._id = cres.clinic_room_id')
        .where('csh._id = :clinicShiftHourId', {
          clinicShiftHourId: appointment.clinicShiftHourId,
        })
        .andWhere('es.employee_id = :doctorId', {
          doctorId: appointment.doctorId,
        })
        .andWhere('es.work_date = :appointmentDate', {
          appointmentDate: appointment.appointmentDate,
        })
        .andWhere('es.deleted_at IS NULL')
        .andWhere('cr.deleted_at IS NULL')
        .getRawMany();

      clinicRooms = roomsResult.map((row) => ({
        id: row.roomId,
        roomName: row.roomName,
      }));
    }

    return { services, clinicRooms };
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
    // Get patient info - support both raw query and relation-based query
    const patientGeneral = appointment.patient?.generalAccount;
    const patientFullName =
      appointment.patientProfile_full_name ||
      patientGeneral?.fullName ||
      appointment.patient?.username ||
      'N/A';
    const patientProfileImage = patientGeneral?.profilePicture || null;

    // Get patient addresses
    const patientAddresses = appointment.patient?.addresses || [];

    // Get doctor info - support both raw query and relation-based query
    const doctorInfo = appointment.doctor?.doctorInformation;
    const doctorFullName =
      appointment.doctorProfile_full_name ||
      doctorInfo?.fullName ||
      appointment.doctor?.username ||
      null;
    const doctorProfileImage = doctorInfo?.profilePicture || null;

    // Get clinic info
    const clinicInfo = appointment.clinic?.clinicManagerInformation;
    const clinicName =
      appointment.clinicProfile_clinic_branch_name ||
      clinicInfo?.clinicBranchName ||
      appointment.clinic?.username ||
      'N/A';

    return {
      id: appointment._id,
      patientId: appointment.patientId,
      patientFullName,
      patientEmail: appointment.patient?.email,
      patientPhone: appointment.patient?.phone,
      patientProfileImage,
      patientAddresses: patientAddresses.map((addr: any) => ({
        id: addr._id,
        address: addr.address,
        ward: addr.ward,
        wardName: addr.wardName,
        district: addr.district,
        districtName: addr.districtName,
        province: addr.province,
        provinceName: addr.provinceName,
      })),
      clinicId: appointment.clinicId,
      clinicName,
      doctorId: appointment.doctorId,
      doctorFullName,
      doctorProfileImage,
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
    if (
      appointment.doctorId &&
      appointment.appointmentDate &&
      appointment.clinicShiftHourId
    ) {
      const roomsMap =
        await this.employeeScheduleRepository.findClinicRoomsForMultipleAppointments(
          [
            {
              appointmentId: appointment._id,
              clinicShiftHourId: appointment.clinicShiftHourId,
              doctorId: appointment.doctorId,
              appointmentDate: appointment.appointmentDate,
            },
          ],
        );
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
    const patientAddresses = appointment.patient?.addresses || [];
    const patientProfile = appointment.patient?.generalAccount;
    const patient = {
      id: appointment.patient?._id || appointment.patientId,
      username: appointment.patient?.username || 'N/A',
      email: appointment.patient?.email,
      phone: appointment.patient?.phone,
      fullName: patientProfile?.fullName,
      gender: patientProfile?.gender,
      dob: patientProfile?.dob,
      profilePicture: patientProfile?.profilePicture,
      addresses: patientAddresses.map((addr: any) => ({
        id: addr._id,
        address: addr.address,
        ward: addr.ward,
        wardName: addr.wardName,
        district: addr.district,
        districtName: addr.districtName,
        province: addr.province,
        provinceName: addr.provinceName,
      })),
    };

    // Doctor details from raw query result (if assigned)
    let doctor = null;
    if (appointment.doctor) {
      const doctorProfile = appointment.doctor?.doctorInformation;
      doctor = {
        id: appointment.doctor._id,
        username: appointment.doctor.username,
        email: appointment.doctor.email,
        phone: appointment.doctor.phone,
        fullName: doctorProfile?.fullName,
        gender: doctorProfile?.gender,
        dob: doctorProfile?.dob,
        profilePicture: doctorProfile?.profilePicture,
        academicDegree: doctorProfile?.academicDegree,
        experience: doctorProfile?.experience,
        position: doctorProfile?.position,
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
        appointmentPackage.services?.map((svc: any) => ({
          id: svc.serviceAppointmentId,
          serviceName: svc.serviceName || 'N/A',
          description: svc.description,
          price: svc.price || 0,
          discount: svc.discount,
          duration: svc.duration,
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
   * by date and status. Returns full appointment details like Staff API.
   *
   * @param doctorId - ID of the authenticated doctor
   * @param queryDto - Query parameters (date, status)
   * @returns List of appointments with complete details
   *
   * Business Rules:
   * - Only show appointments assigned to this doctor (doctor_id matches)
   * - Filter by date and status if provided
   * - Show CHECKED_IN and IN_PROGRESS appointments by default
   * - Include patient details, addresses, profile images
   * - Include doctor details and profile image
   * - Include services and clinic rooms
   */
  async getDoctorAppointments(
    doctorId: string,
    queryDto: QueryDoctorAppointmentDto,
  ): Promise<{ appointments: AppointmentResponseDto[] }> {
    const queryBuilder = this.dataSource
      .getRepository(Appointment)
      .createQueryBuilder('appointment')
      .leftJoinAndSelect('appointment.patient', 'patient')
      .leftJoinAndSelect('patient.generalAccount', 'generalAccount')
      .leftJoinAndSelect('patient.addresses', 'patientAddresses')
      .leftJoinAndSelect('appointment.doctor', 'doctor')
      .leftJoinAndSelect('doctor.doctorInformation', 'doctorInformation')
      .leftJoinAndSelect('appointment.clinic', 'clinic')
      .leftJoinAndSelect('clinic.clinicManagerInformation', 'clinicManagerInfo')
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
    const appointmentItems = appointments.map((appointment) => {
      const clinicRooms = clinicRoomsMap.get(appointment._id) || [];
      const services = servicesMap.get(appointment._id) || [];

      return this.transformToResponseDto(appointment, services, clinicRooms);
    });

    return {
      appointments: appointmentItems,
    };
  }

  /**
   * Get appointments with extra hour pending doctor confirmation
   *
   * Retrieves list of appointments that:
   * - Have extra_hour (not null)
   * - Are in PENDING_DOCTOR or CONFIRMED status
   * - Belong to the authenticated doctor
   *
   * @param doctorId - ID of the authenticated doctor
   * @returns List of appointments with extra hour in pending or confirmed status
   *
   * Business Rules:
   * - Only show appointments with extra_hour set
   * - Show both PENDING_DOCTOR and CONFIRMED statuses
   * - Include patient details, services, and clinic rooms
   * - Order by appointment date and hour
   */
  async getPendingExtraHourAppointments(
    doctorId: string,
  ): Promise<{ appointments: AppointmentResponseDto[] }> {
    const queryBuilder = this.dataSource
      .getRepository(Appointment)
      .createQueryBuilder('appointment')
      .leftJoinAndSelect('appointment.patient', 'patient')
      .leftJoinAndSelect('patient.generalAccount', 'generalAccount')
      .leftJoinAndSelect('patient.addresses', 'patientAddresses')
      .leftJoinAndSelect('appointment.doctor', 'doctor')
      .leftJoinAndSelect('doctor.doctorInformation', 'doctorInformation')
      .leftJoinAndSelect('appointment.clinic', 'clinic')
      .leftJoinAndSelect('clinic.clinicManagerInformation', 'clinicManagerInfo')
      .where('appointment.doctor_id = :doctorId', { doctorId })
      .andWhere('appointment.extra_hour IS NOT NULL')
      .andWhere('appointment.status IN (:...statuses)', {
        statuses: [
          AppointmentStatus.PENDING_DOCTOR,
          AppointmentStatus.CONFIRMED,
        ],
      })
      .andWhere('appointment.deleted_at IS NULL')
      .orderBy('appointment.appointment_date', 'ASC')
      .addOrderBy('appointment.appointment_hour', 'ASC');

    const appointments = await queryBuilder.getMany();

    // If no appointments found, return empty array
    if (appointments.length === 0) {
      return {
        appointments: [],
      };
    }

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
    const appointmentItems = appointments.map((appointment) => {
      const clinicRooms = clinicRoomsMap.get(appointment._id) || [];
      const services = servicesMap.get(appointment._id) || [];

      return this.transformToResponseDto(appointment, services, clinicRooms);
    });

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
  ): Promise<AppointmentResponseDto> {
    // Find appointment with all relations
    const appointment = await this.dataSource
      .getRepository(Appointment)
      .createQueryBuilder('appointment')
      .leftJoinAndSelect('appointment.patient', 'patient')
      .leftJoinAndSelect('patient.generalAccount', 'generalAccount')
      .leftJoinAndSelect('patient.addresses', 'patientAddresses')
      .leftJoinAndSelect('appointment.doctor', 'doctor')
      .leftJoinAndSelect('doctor.doctorInformation', 'doctorInformation')
      .leftJoinAndSelect('appointment.clinic', 'clinic')
      .leftJoinAndSelect('clinic.clinicManagerInformation', 'clinicManagerInfo')
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
    if (appointment.status === AppointmentStatus.CHECKED_IN) {
      appointment.status = AppointmentStatus.IN_PROGRESS;
      await this.dataSource.getRepository(Appointment).save(appointment);
    }

    // Load services and clinic rooms
    const { services, clinicRooms } =
      await this.loadAppointmentServicesAndRooms(appointment);

    return this.transformToResponseDto(appointment, services, clinicRooms);
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
        serviceName:
          sa.clinicService?.service?.serviceName || 'Unknown Service',
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
      throw new ForbiddenException(
        'You do not have permission to access this appointment',
      );
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
        serviceName:
          sa.clinicService?.service?.serviceName || 'Unknown Service',
        serviceType,
        hasErm: !!sa.erm,
        ermId: sa.erm?._id || null,
        ermStatus: sa.erm?.status || null,
        price: sa.price,
        discount: sa.discount || undefined,
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
      throw new ForbiddenException(
        MESSAGES.failMessage.appointmentNotAssignedToDoctor,
      );
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
        missingRequirements.push(
          'E-prescription not created (required when there is consultation ERM)',
        );
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
          signedAt: getCurrentVietnamTime(),
          updatedAt: getCurrentVietnamTime(),
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
    const hasPaidOnline = appointmentPackages.some(
      (pkg) => pkg.transactionId !== null,
    );

    // Determine payment status, appointment status, and next step
    let paymentStatus: 'PAID' | 'UNPAID' | 'PARTIAL';
    let nextStep: 'EXPORT_PRESCRIPTION' | 'PROCEED_TO_PAYMENT';
    let appointmentStatus: AppointmentStatus;

    if (hasPaidOnline && !hasAdditionalServices) {
      // CASE 1: Paid online + No additional services ΓåÆ Fully completed
      paymentStatus = 'PAID';
      nextStep = 'EXPORT_PRESCRIPTION';
      appointmentStatus = AppointmentStatus.COMPLETED;
    } else if (!hasPaidOnline && !hasAdditionalServices) {
      // CASE 2: Not paid online + No additional services ΓåÆ Need full payment
      paymentStatus = 'UNPAID';
      nextStep = 'PROCEED_TO_PAYMENT';
      appointmentStatus = AppointmentStatus.NEED_FINAL_PAYMENT;
    } else if (hasPaidOnline && hasAdditionalServices) {
      // CASE 3: Paid online + Has additional services ΓåÆ Need additional payment
      paymentStatus = 'PARTIAL';
      nextStep = 'PROCEED_TO_PAYMENT';
      appointmentStatus = AppointmentStatus.NEED_FINAL_PAYMENT;
    } else {
      // CASE 4: Not paid online + Has additional services ΓåÆ Need full payment (including additional)
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
      completedAt: getCurrentVietnamTime(), // Current timestamp as completion time
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
      throw new ForbiddenException(
        MESSAGES.failMessage.appointmentNotAssignedToDoctor,
      );
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

    // 6. Get price and discount from clinic service config
    const price = parseFloat(clinicService.price.toString());
    const discount = parseFloat((clinicService.discount || 0).toString());

    // Calculate package amount: price * (100 - discount%) / 100
    const finalPrice = (price * (100 - discount)) / 100;
    const amount = Math.round(finalPrice);

    // 7. Create new AppointmentPackage
    const appointmentPackage = this.dataSource
      .getRepository(AppointmentPackage)
      .create({
        appointmentId: appointment._id,
        amount: amount,
        transactionId: null, // Will be set by Clinic Staff during payment
        paymentType: PaymentType.COD,
        status: AppointmentPackageStatus.PENDING_PAYMENT,
      });

    const savedPackage = await this.dataSource
      .getRepository(AppointmentPackage)
      .save(appointmentPackage);

    // 8. Create new ServiceAppointment with price and discount snapshots
    const serviceAppointment = this.dataSource
      .getRepository(ServiceAppointment)
      .create({
        clinicServiceId: clinicServiceId,
        appointmentPackageId: savedPackage._id,
        price: price,
        discount: discount,
      });

    const savedServiceAppointment = await this.dataSource
      .getRepository(ServiceAppointment)
      .save(serviceAppointment);

    // 9. Get service type from category
    const serviceType = (clinicService.service?.category?.type ||
      'CONSULTATION') as ERMRecordType;

    // 10. Return response
    return {
      appointmentPackageId: savedPackage._id,
      serviceAppointmentId: savedServiceAppointment._id,
      appointmentId: appointment._id,
      clinicServiceId: clinicServiceId,
      serviceName: clinicService.service?.serviceName || 'Unknown Service',
      serviceType: serviceType,
      price: price,
      discount: discount,
      amount: amount,
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
    const userAccount =
      await this.accountRepository.findAccountById(userAccountId);
    if (!userAccount) {
      throw new NotFoundException(MESSAGES.failMessage.accountNotFound);
    }

    const query = this.appointmentRepository
      .createQueryBuilder('appointment')
      .leftJoinAndSelect('appointment.patient', 'patient')
      .leftJoinAndSelect('appointment.clinic', 'clinic')
      .where('appointment.doctorId = :doctorId', { doctorId })
      .andWhere('appointment.deletedAt IS NULL');

    // appointments.clinic_id stores CLINIC_MANAGER ID (= clinic branch)
    // - CLINIC_MANAGER: filter by own _id (= branch)
    // - CLINIC_ADMIN: filter by all manager IDs under this admin
    if (userAccount.role === AccountRole.CLINIC_MANAGER) {
      query.andWhere('appointment.clinicId = :clinicId', {
        clinicId: userAccount._id,
      });
    } else if (userAccount.role === AccountRole.CLINIC_ADMIN) {
      const managers = await this.accountRepository.findByParentIdAndRole(
        userAccount._id,
        AccountRole.CLINIC_MANAGER,
      );
      const managerIds = managers.map((m) => m._id);
      if (managerIds.length > 0) {
        query.andWhere('appointment.clinicId IN (:...managerIds)', {
          managerIds,
        });
      } else {
        // No managers ΓåÆ no results
        query.andWhere('1 = 0');
      }
    }

    if (queryDto.fromDate) {
      query.andWhere('appointment.appointmentDate >= :fromDate', {
        fromDate: queryDto.fromDate,
      });
    }

    if (queryDto.toDate) {
      query.andWhere('appointment.appointmentDate <= :toDate', {
        toDate: queryDto.toDate,
      });
    }

    if (queryDto.status) {
      query.andWhere('appointment.status = :status', {
        status: queryDto.status,
      });
    }

    query.orderBy('appointment.appointmentDate', 'DESC');
    query.addOrderBy('appointment.appointmentHour', 'DESC');

    console.log(
      `[getDoctorWorkHistory] Query parameters: doctorId=${doctorId}, role=${userAccount.role}, fromDate=${queryDto.fromDate}, toDate=${queryDto.toDate}, status=${queryDto.status}`,
    );
    console.log(`[getDoctorWorkHistory] Raw SQL Query: `, query.getSql());
    console.log(
      `[getDoctorWorkHistory] SQL Parameters: `,
      query.getParameters(),
    );

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
    const servicesMap =
      appointmentIds.length > 0
        ? await this.appointmentPackageRepository.findServicesByAppointmentIds(
            appointmentIds,
          )
        : new Map();

    // Fetch clinic rooms for all appointments
    const appointmentData = appointments.map((apt) => ({
      appointmentId: apt._id,
      clinicShiftHourId: apt.clinicShiftHourId,
      doctorId: apt.doctorId,
      appointmentDate: apt.appointmentDate,
    }));

    const clinicRoomsMap =
      appointmentIds.length > 0
        ? await this.employeeScheduleRepository.findClinicRoomsForMultipleAppointments(
            appointmentData,
          )
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
      throw new ForbiddenException(
        'You do not have permission to access this session',
      );
    }

    // ========================================================================
    // V4.5: VALIDATE BOOKING OPTION & REQUIRED FIELDS
    // ========================================================================

    // Detect booking option (default to option 1/2/3 if not specified)
    const bookingOption = session.bookingOption || 'service_first';

    if (bookingOption === 'out_of_hours') {
      // ΓöîΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÉ
      // Γöé OPTION 4: KH├üM NGO├ÇI GIß╗£ (Out of Hours)                         Γöé
      // Γöé - Bß║«T BUß╗ÿC: extraHour (ISO datetime string)                     Γöé
      // Γöé - KH├öNG Y├èU Cß║ªU: clinicShiftHourId                              Γöé
      // ΓööΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÿ
      if (
        !session.clinicServiceConfigId ||
        !session.clinicId ||
        !session.doctorId ||
        !session.paymentMethod ||
        !session.extraHour
      ) {
        throw new BadRequestException(
          'Incomplete out-of-hours booking session. Required: clinicServiceConfigId, clinicId, doctorId, paymentMethod, extraHour.',
        );
      }

      // Validate extraHour format (must be ISO datetime string)
      if (
        typeof session.extraHour !== 'string' ||
        !session.extraHour.includes('T')
      ) {
        throw new BadRequestException(
          'extraHour must be a valid ISO datetime string (e.g., 2026-03-15T19:30:00)',
        );
      }

      // Parse extraHour to Date object
      const extraHourDate = new Date(session.extraHour);
      if (isNaN(extraHourDate.getTime())) {
        throw new BadRequestException(
          'Invalid extraHour format. Must be a valid ISO datetime.',
        );
      }

      // Validate extraHour is in the future (use Vietnam timezone)
      if (isInPast(extraHourDate)) {
        throw new BadRequestException('extraHour must be in the future');
      }
    } else {
      // ΓöîΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÉ
      // Γöé OPTIONS 1/2/3: STANDARD BOOKING (Service/Doctor/Date First)     Γöé
      // Γöé - Y├èU Cß║ªU: clinicShiftHourId, appointmentDate                   Γöé
      // ΓööΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÿ
      if (
        !session.clinicServiceConfigId ||
        !session.clinicId ||
        !session.appointmentDate ||
        !session.clinicShiftHourId ||
        !session.doctorId ||
        !session.paymentMethod
      ) {
        throw new BadRequestException(
          'Incomplete booking session. Please complete all steps (including payment method selection) before confirming.',
        );
      }
    }

    // Validate payment method (common for all options)
    if (!['cod', 'online'].includes(session.paymentMethod)) {
      throw new BadRequestException(
        'Invalid payment method. Must be \"cod\" or \"online\"',
      );
    }

    // ========================================================================
    // STEP 2: VALIDATE BUSINESS RULES (FOR OPTIONS 1/2/3 ONLY)
    // ========================================================================

    // Skip date validation for out_of_hours (handled in STEP 1)
    let dateString: string | null = null;

    if (bookingOption !== 'out_of_hours') {
      // Extract date string (YYYY-MM-DD) directly from session
      const dateInput = session.appointmentDate;

      if (typeof dateInput === 'string') {
        // If it's already a string, extract YYYY-MM-DD part
        dateString = dateInput.includes('T')
          ? dateInput.split('T')[0]
          : dateInput;
      } else {
        throw new BadRequestException('Invalid appointment date format');
      }

      // Validate date format (YYYY-MM-DD)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        throw new BadRequestException(
          'Appointment date must be in YYYY-MM-DD format',
        );
      }

      // Parse to Date object for comparison only
      const appointmentDate = new Date(dateString + 'T00:00:00');
      const todayStart = getStartOfDay();

      // Business Rule: Appointment date must be >= today
      if (appointmentDate < todayStart) {
        throw new BadRequestException(
          'Appointment date must be today or in the future',
        );
      }

      // Business Rule: Appointment date must be <= 60 days from now
      const maxDate = addToVietnamTime(60, 'day');
      if (appointmentDate > maxDate) {
        throw new BadRequestException(
          'Appointment date cannot be more than 60 days in the future',
        );
      }
    }

    // ========================================================================
    // STEP 3: BRANCH BASED ON BOOKING OPTION & PAYMENT METHOD
    // ========================================================================

    // OPTION 4: Out of Hours Booking
    if (bookingOption === 'out_of_hours') {
      if (session.paymentMethod === 'cod') {
        return await this.createAppointmentOutOfHours(
          sessionId,
          patientId,
          session,
        );
      } else {
        // TODO: Implement online payment for out_of_hours
        throw new BadRequestException(
          'Online payment for out-of-hours appointments is not yet supported',
        );
      }
    }

    // OPTIONS 1/2/3: Standard Booking with Shift Hours
    if (session.paymentMethod === 'cod') {
      // ΓöîΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÉ
      // Γöé NH├üNH A: THANH TO├üN COD (Cash on Delivery)                      Γöé
      // Γöé Tß║ío appointment ngay lß║¡p tß╗⌐c, thanh to├ín tß║íi ph├▓ng kh├ím         Γöé
      // ΓööΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÿ
      return await this.createAppointmentCOD(
        sessionId,
        patientId,
        session,
        dateString!,
      );
    } else {
      // ΓöîΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÉ
      // Γöé NH├üNH B: THANH TO├üN ONLINE (Payment Gateway)                    Γöé
      // Γöé PLACEHOLDER - Ch╞░a t├¡ch hß╗úp payment gateway thß║¡t                Γöé
      // Γöé Trß║ú vß╗ü mock payment URL, giß╗» session ─æß╗â xß╗¡ l├╜ webhook sau       Γöé
      // ΓööΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÿ
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
    const result = await this.dataSource.transaction(
      'SERIALIZABLE',
      async (manager) => {
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
          .where('csc._id = :configId', {
            configId: session.clinicServiceConfigId,
          })
          .andWhere('csc.clinic_id = :clinicId', { clinicId: session.clinicId })
          .andWhere('csc.is_active = :isActive', { isActive: true })
          .andWhere('csc.deleted_at IS NULL')
          .andWhere('service.deleted_at IS NULL') // CRITICAL: Check parent service not deleted
          .andWhere('service.is_active = :serviceActive', {
            serviceActive: true,
          });

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
              'Service is not available at the selected clinic. Please select a service from this clinic.',
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
        const discount = serviceConfig.discount
          ? parseFloat(serviceConfig.discount.toString())
          : 0;
        const finalPrice = basePrice - (basePrice * discount) / 100;

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
          [session.doctorId, validClinicIds, dateString],
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
        const appointmentHour = new Date(
          dateString + 'T' + hours + ':' + minutes + ':00',
        );

        // Business Rule: Must book at least 2 hours in advance (use Vietnam timezone)
        const minBookingTime = addToVietnamTime(2, 'hour');
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
          .andWhere('a.clinic_shift_hour_id = :shiftHourId', {
            shiftHourId: session.clinicShiftHourId,
          })
          .andWhere(
            "a.status IN ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS')",
          )
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

        // === STEP 9: Create Service Appointment (with Price Snapshot) ===
        // V4.5: Snapshot price & discount from clinic_service_config at booking time
        // This ensures historical pricing remains accurate even if clinic changes prices later
        const serviceAppointmentRepo = manager.getRepository(
          'service_appointments',
        );
        const serviceAppointment = serviceAppointmentRepo.create({
          clinicServiceId: session.clinicServiceConfigId,
          appointmentPackageId: savedPackage._id,
          price: basePrice, // Snapshot: Original service price
          discount, // Snapshot: Discount percentage at time of booking
        });

        await serviceAppointmentRepo.save(serviceAppointment);

        // Return data for response
        return {
          appointment: savedAppointment,
          serviceConfig,
          shiftHour,
        };
      },
    );

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
      message: 'Vui l├▓ng thanh to├ín ─æß╗â ho├án tß║Ñt ─æß║╖t lß╗ïch',
      data: {
        payment_url: `https://sandbox.payment-gateway.com/pay?order_id=${paymentReferenceId}`,
        payment_reference_id: paymentReferenceId,
        amount: totalAmount,
        expires_at: addToVietnamTime(15, 'minute'), // 15 minutes
        // Note: This is MOCK data. Real payment gateway will return actual payment URL
      },
    };
  }

  /**
   * PRIVATE METHOD: Create Appointment for Out-of-Hours Booking (Option 4)
   *
   * Handles appointments booked outside regular shift hours (e.g., evenings, weekends).
   * Key differences from standard booking:
   * - NO clinic_shift_hour_id (null)
   * - NO slot limit check (out-of-hours don't use slots)
   * - Uses extraHour as both appointment_hour and extra_hour
   * - Still validates doctor schedule and prevents double booking
   *
   * Steps:
   * 1. Parse extraHour to Date object
   * 2. Validate service config
   * 3. Validate doctor schedule (CRITICAL: must work on that date)
   * 4. Check double booking (doctor can't have 2 appointments at same time)
   * 5. Create Appointment with clinic_shift_hour_id = NULL
   * 6. Create AppointmentPackage and ServiceAppointment
   * 7. Delete Redis session
   * 8. Send email notifications
   *
   * @param sessionId - Session UUID for cleanup
   * @param patientId - Patient UUID
   * @param session - Booking session data from Redis
   * @returns Created appointment data
   */
  private async createAppointmentOutOfHours(
    sessionId: string,
    patientId: string,
    session: any,
  ): Promise<any> {
    // === STEP 1: Parse extraHour ===
    const extraHourDate = new Date(session.extraHour);

    // Double-check validity (should already be validated in main function)
    if (isNaN(extraHourDate.getTime())) {
      throw new BadRequestException('Invalid extraHour format');
    }

    // Extract date string for schedule validation
    const year = extraHourDate.getFullYear();
    const month = String(extraHourDate.getMonth() + 1).padStart(2, '0');
    const day = String(extraHourDate.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;

    // Execute transaction with SERIALIZABLE isolation level
    const result = await this.dataSource.transaction(
      'SERIALIZABLE',
      async (manager) => {
        // === STEP 2: Validate Service Config ===
        // Same validation as standard booking
        const serviceConfigQuery = manager
          .createQueryBuilder(ClinicServiceConfig, 'csc')
          .leftJoinAndSelect('csc.service', 'service')
          .where('csc._id = :configId', {
            configId: session.clinicServiceConfigId,
          })
          .andWhere('csc.clinic_id = :clinicId', { clinicId: session.clinicId })
          .andWhere('csc.is_active = :isActive', { isActive: true })
          .andWhere('csc.deleted_at IS NULL')
          .andWhere('service.deleted_at IS NULL')
          .andWhere('service.is_active = :serviceActive', {
            serviceActive: true,
          });

        const serviceConfig = await serviceConfigQuery.getOne();

        if (!serviceConfig) {
          throw new BadRequestException('Service is not available');
        }

        // Calculate price (base price - discount)
        const basePrice = parseFloat(serviceConfig.price.toString());
        const discount = serviceConfig.discount
          ? parseFloat(serviceConfig.discount.toString())
          : 0;
        const finalPrice = basePrice - (basePrice * discount) / 100;

        // === STEP 3: Validate Doctor Schedule ===
        // Doctor must have a schedule on this date (even for out-of-hours)
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
        validClinicIds.push(session.clinicId);

        // Check if doctor has schedule on this date
        const doctorSchedule = await manager.query(
          `SELECT * FROM employee_schedule 
         WHERE employee_id = $1 
         AND clinic_id = ANY($2::uuid[])
         AND TO_CHAR(work_date AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') = $3
         AND deleted_at IS NULL 
         LIMIT 1`,
          [session.doctorId, validClinicIds, dateString],
        );

        if (!doctorSchedule || doctorSchedule.length === 0) {
          throw new BadRequestException(
            'Doctor is not available on this date at this clinic',
          );
        }

        // === STEP 4: CHß╗ÉNG DOUBLE BOOKING ===
        // CRITICAL: Check if doctor already has an appointment at this extraHour
        // Query both appointment_hour AND extra_hour columns to prevent conflicts
        const appointmentRepo = manager.getRepository('appointments');

        const existingAppointment = await manager
          .createQueryBuilder()
          .select('a')
          .from('appointments', 'a')
          .where('a.doctor_id = :doctorId', { doctorId: session.doctorId })
          .andWhere(
            '(a.appointment_hour = :extraHour OR a.extra_hour = :extraHour)',
            { extraHour: extraHourDate },
          )
          .andWhere(
            "a.status IN ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS')",
          )
          .andWhere('a.deleted_at IS NULL')
          .getOne();

        if (existingAppointment) {
          throw new ConflictException(
            'Doctor already has an appointment at this time. Please select a different time.',
          );
        }

        // === STEP 5: Create Appointment (OUT-OF-HOURS) ===
        // KEY DIFFERENCES:
        // - clinic_shift_hour_id = NULL (not using regular slots)
        // - extra_hour = extraHourDate (the custom time requested)
        // - appointment_hour = extraHourDate (same as extra_hour)
        // - appointment_date = date part of extraHour
        const appointmentDateForDB = new Date(dateString + 'T00:00:00');

        const appointment = appointmentRepo.create({
          patientId,
          clinicId: session.clinicId,
          doctorId: session.doctorId,
          clinicShiftHourId: null, // Bß║«T BUß╗ÿC NULL cho out-of-hours
          appointmentDate: appointmentDateForDB,
          appointmentHour: extraHourDate, // Giß╗¥ kh├ím = extraHour
          extraHour: extraHourDate, // L╞░u v├áo cß╗Öt extra_hour
          total: finalPrice,
          status: AppointmentStatus.PENDING,
          patientNote: session.patientNote || null,
        });

        const savedAppointment = await appointmentRepo.save(appointment);

        // === STEP 6: Create Appointment Package ===
        const packageRepo = manager.getRepository('appointment_package');
        const appointmentPackage = packageRepo.create({
          appointmentId: savedAppointment._id,
          transactionId: null, // COD: No transaction ID until payment at clinic
          amount: Math.round(finalPrice),
          status: AppointmentPackageStatus.PENDING_PAYMENT,
          paymentType: PaymentType.COD,
        });

        const savedPackage = await packageRepo.save(appointmentPackage);

        // === STEP 7: Create Service Appointment (with Price Snapshot) ===
        // V4.5: Snapshot price & discount from clinic_service_config at booking time
        const serviceAppointmentRepo = manager.getRepository(
          'service_appointments',
        );
        const serviceAppointment = serviceAppointmentRepo.create({
          clinicServiceId: session.clinicServiceConfigId,
          appointmentPackageId: savedPackage._id,
          price: basePrice, // Snapshot: Original service price
          discount, // Snapshot: Discount percentage at time of booking
        });

        await serviceAppointmentRepo.save(serviceAppointment);

        // Return data for response
        return {
          appointment: savedAppointment,
          serviceConfig,
        };
      },
    );

    // === STEP 8: Delete Redis Session (Cleanup) ===
    await this.bookingSessionService.deleteSession(sessionId);

    // === STEP 9: Send Email Notifications (Async - Non-blocking) ===
    // TODO: Implement email sending when ready
    /*
    try {
      await this.mailerService.sendAppointmentConfirmation({...});
    } catch (emailError) {
      console.error('Failed to send appointment email:', emailError);
    }
    */

    // === STEP 10: Build Response ===
    return {
      appointment_id: result.appointment._id,
      clinic_id: result.appointment.clinicId,
      service_name: result.serviceConfig.service?.serviceName || 'N/A',
      appointment_date: result.appointment.appointmentDate,
      appointment_hour: result.appointment.appointmentHour,
      extra_hour: result.appointment.extraHour, // Trß║ú vß╗ü extraHour cho client
      start_time: null, // Kh├┤ng c├│ shift hour
      end_time: null, // Kh├┤ng c├│ shift hour
      total: result.appointment.total,
      status: result.appointment.status,
      payment_type: 'cod',
      patient_note: result.appointment.patientNote,
      is_out_of_hours: true, // Flag ─æß╗â frontend biß║┐t ─æ├óy l├á out-of-hours
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
        "COALESCE(addr.address, '') AS clinic_address",
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
      .leftJoin(
        'clinic_admin_information',
        'cai',
        'cai.account_id = clinic._id',
      )
      .leftJoin(
        'clinic_manager_information',
        'cmi',
        'cmi.account_id = clinic._id',
      )
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

        query = query.andWhere('csc.clinic_id IN (:...branchIds)', {
          branchIds,
        });
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
    const userAccount =
      await this.accountRepository.findAccountById(userAccountId);
    if (!userAccount) {
      throw new NotFoundException(MESSAGES.failMessage.accountNotFound);
    }

    const query = this.appointmentRepository
      .createQueryBuilder('appointment')
      .leftJoinAndSelect('appointment.patient', 'patient')
      .leftJoinAndSelect('appointment.clinic', 'clinic')
      .where('appointment.doctorId = :doctorId', { doctorId })
      .andWhere('appointment.deletedAt IS NULL');

    // appointments.clinic_id stores CLINIC_MANAGER ID (= clinic branch)
    // - CLINIC_MANAGER: filter by own _id (= branch)
    // - CLINIC_ADMIN: filter by all manager IDs under this admin
    if (userAccount.role === AccountRole.CLINIC_MANAGER) {
      query.andWhere('appointment.clinicId = :clinicId', {
        clinicId: userAccount._id,
      });
    } else if (userAccount.role === AccountRole.CLINIC_ADMIN) {
      const managers = await this.accountRepository.findByParentIdAndRole(
        userAccount._id,
        AccountRole.CLINIC_MANAGER,
      );
      const managerIds = managers.map((m) => m._id);
      if (managerIds.length > 0) {
        query.andWhere('appointment.clinicId IN (:...managerIds)', {
          managerIds,
        });
      } else {
        query.andWhere('1 = 0');
      }
    }

    if (queryDto.fromDate) {
      query.andWhere('appointment.appointmentDate >= :fromDate', {
        fromDate: queryDto.fromDate,
      });
    }

    if (queryDto.toDate) {
      query.andWhere('appointment.appointmentDate <= :toDate', {
        toDate: queryDto.toDate,
      });
    }

    if (queryDto.status) {
      query.andWhere('appointment.status = :status', {
        status: queryDto.status,
      });
    }

    query.orderBy('appointment.appointmentDate', 'DESC');
    query.addOrderBy('appointment.appointmentHour', 'DESC');

    console.log(
      `[exportDoctorWorkHistoryCSV] Query parameters: doctorId=${doctorId}, role=${userAccount.role}, fromDate=${queryDto.fromDate}, toDate=${queryDto.toDate}, status=${queryDto.status}`,
    );
    console.log(`[exportDoctorWorkHistoryCSV] Raw SQL Query: `, query.getSql());
    console.log(
      `[exportDoctorWorkHistoryCSV] SQL Parameters: `,
      query.getParameters(),
    );

    const appointments = await query.getMany();
    console.log(
      `[exportDoctorWorkHistoryCSV] Total appointments found: ${appointments.length}`,
    );

    const headers = [
      'M├ú Ca Kh├ím',
      'Bß╗çnh Nh├ón',
      'Ph├▓ng Kh├ím',
      'Ng├áy Kh├ím',
      'Giß╗¥ Kh├ím',
      'Trß║íng Th├íi',
      'Ghi Ch├║',
      'Doanh Thu (VN─É)',
    ];

    const rows = appointments.map((app) => {
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
        amount,
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Get Patient's Appointments (Step 5 - Patient appointment history)
   *
   * Business Logic:
    const today = getStartOfDay();
    const maxDate = addToVietnamTime(60, 'day');

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
  async getAvailableSlots(clinicId: string, dateString: string) {
    // Validate date format
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date format. Use YYYY-MM-DD');
    }

    // Business Rule: date >= today (use Vietnam timezone)
    const todayStart = getStartOfDay();
    if (date < todayStart) {
      throw new BadRequestException(
        'Appointment date must be today or in the future',
      );
    }

    // Business Rule: date <= today + 60 days
    const maxDate = addToVietnamTime(60, 'day');
    if (date > maxDate) {
      throw new BadRequestException(
        'Appointment date cannot be more than 60 days in the future',
      );
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
      .leftJoin(
        'clinic_room_employee_schedule',
        'cres',
        'cres.employee_schedule_id = es._id',
      )
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
    const today = getDateString(); // YYYY-MM-DD format in Vietnam timezone

    // Build base query with all necessary JOINs
    const query = this.dataSource
      .createQueryBuilder()
      .select([
        'a._id AS appointment_id',
        'a.appointment_date AS appointment_date',
        'a.appointment_hour AS appointment_hour',
        'a.extra_hour AS extra_hour',
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
        // Clinic room info (V4.5: COALESCE for out-of-hours support)
        // Priority: regular schedule room -> manual extra_room (for Option 4)
        'COALESCE("cr".room_name, "extra_room".room_name) AS clinic_room',
      ])
      .from('appointments', 'a')
      .innerJoin('accounts', 'clinic', 'clinic._id = a.clinic_id')
      .leftJoin(
        'clinic_manager_information',
        'cmi',
        'cmi.account_id = clinic._id',
      )
      .leftJoin('addresses', 'addr', 'addr.account_id = clinic._id')
      .leftJoin('accounts', 'doctor', 'doctor._id = a.doctor_id')
      .leftJoin('doctor_information', 'di', 'di.account_id = doctor._id')
      .leftJoin('clinic_shift_hour', 'csh', 'csh._id = a.clinic_shift_hour_id')
      .leftJoin(
        'clinic_shift',
        'cs',
        'cs._id = csh.shift_id AND cs.deleted_at IS NULL',
      )
      .leftJoin(
        'employee_schedule',
        'es',
        'es.clinic_shift_id = cs._id AND es.employee_id = a.doctor_id AND es.work_date = a.appointment_date AND es.deleted_at IS NULL',
      )
      .leftJoin(
        'clinic_room_employee_schedule',
        'cres',
        'cres.employee_schedule_id = es._id',
      )
      .leftJoin(
        'clinic_room',
        'cr',
        'cr._id = cres.clinic_room_id AND cr.deleted_at IS NULL',
      )
      .leftJoin(
        'clinic_room',
        'extra_room',
        'extra_room._id = a.extra_room_id AND extra_room.deleted_at IS NULL',
      )
      .leftJoin(
        'appointment_package',
        'ap',
        'ap.appointment_id = a._id AND ap.deleted_at IS NULL',
      )
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

    // Get total count before pagination (count unique appointments, not duplicate rows)
    const countResult = await query
      .clone()
      .select('COUNT(DISTINCT a._id)', 'count')
      .getRawOne();
    const total = parseInt(countResult?.count || '0', 10);

    // DEBUG: Print SQL query
    console.log('≡ƒöì SQL Query for clinic_room:');
    console.log(query.getSql());
    console.log('\n≡ƒôï Query Parameters:', query.getParameters());

    // Get paginated results with ordering
    const appointmentsRaw = await query
      .orderBy('a.appointment_date', 'DESC')
      .addOrderBy('a.created_at', 'DESC')
      .offset((page - 1) * limit)
      .limit(limit)
      .getRawMany();

    // DEBUG: Print raw data
    console.log('\n≡ƒôè Raw appointments data (first 2):');
    console.log(JSON.stringify(appointmentsRaw.slice(0, 2), null, 2));

    // CRITICAL FIX: Deduplicate appointments (M-N join can return multiple rows per appointment)
    // Keep only the first room if multiple rooms are assigned to the same schedule
    const uniqueAppointmentsMap = new Map<string, any>();
    appointmentsRaw.forEach((apt) => {
      if (!uniqueAppointmentsMap.has(apt.appointment_id)) {
        uniqueAppointmentsMap.set(apt.appointment_id, apt);
      }
    });
    const appointmentsRawUnique = Array.from(uniqueAppointmentsMap.values());

    console.log(
      `\nΓ£à Deduplication: ${appointmentsRaw.length} rows -> ${appointmentsRawUnique.length} unique appointments`,
    );

    // Optimization: Bulk load services to avoid N+1 queries
    let servicesMap: Map<string, any[]> = new Map();
    let ermsMap: Map<string, any[]> = new Map();
    let ePrescriptionMap: Map<string, any> = new Map();
    if (appointmentsRawUnique.length > 0) {
      const appointmentIds = appointmentsRawUnique.map((a) => a.appointment_id);

      // Single query to fetch all services for all appointments
      // V4.5: Fetch price & discount from service_appointments (snapshot history)
      const servicesRaw = await this.dataSource
        .createQueryBuilder()
        .select([
          'ap.appointment_id AS appointment_id',
          'cs._id AS service_id',
          'cs.service_name AS service_name',
          'sa.price AS price', // V4.5: Snapshot price from service_appointments
          'sa.discount AS discount', // V4.5: Snapshot discount from service_appointments
          'e._id AS erm_id',
          'e.record_type AS erm_type',
          'e.created_at AS erm_created_at',
        ])
        .from('appointment_package', 'ap')
        .innerJoin(
          'service_appointments',
          'sa',
          'sa.appointment_package_id = ap._id',
        )
        .innerJoin(
          'clinic_service_config',
          'csc',
          'csc._id = sa.clinic_service_id',
        )
        .innerJoin('clinic_services', 'cs', 'cs._id = csc.service_id')
        .leftJoin(
          'erms',
          'e',
          'e.service_appointments_id = sa._id AND e.deleted_at IS NULL',
        )
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
          discount: parseFloat(service.discount || '0'),
        });

        if (service.erm_id) {
          if (!ermsMap.has(aptId)) {
            ermsMap.set(aptId, []);
          }
          ermsMap.get(aptId)!.push({
            id: service.erm_id,
            type: service.erm_type,
            created_at: service.erm_created_at,
          });
        }
      });

      // Fetch E-Prescription summaries
      const ePrescriptionsRaw = await this.dataSource
        .createQueryBuilder()
        .select([
          'ep.appointment_id AS appointment_id',
          'ep._id AS ep_id',
          'ep.reference_id AS ep_code',
          'ep.created_at AS ep_created_at',
        ])
        .from('e_prescriptions', 'ep')
        .where('ep.appointment_id IN (:...appointmentIds)', { appointmentIds })
        .andWhere('ep.deleted_at IS NULL')
        .getRawMany();

      ePrescriptionsRaw.forEach((ep) => {
        ePrescriptionMap.set(ep.appointment_id, {
          id: ep.ep_id,
          code: ep.ep_code,
          created_at: ep.ep_created_at,
        });
      });
    }

    // Map to response DTO structure
    const data = appointmentsRawUnique.map((apt) => ({
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
      appointment_hour: apt.appointment_hour || apt.extra_hour,
      start_hour: apt.start_hour,
      end_hour: apt.end_hour,
      clinic_room: apt.clinic_room || null,
      status: apt.status,
      total: parseFloat(apt.total || '0'),
      payment_type: apt.payment_type,
      payment_status: apt.payment_status,
      services: servicesMap.get(apt.appointment_id) || [],
      erms: ermsMap.get(apt.appointment_id) || [],
      e_prescription_summary: ePrescriptionMap.get(apt.appointment_id) || null,
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
        'a.extra_hour AS extra_hour',
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
        // Clinic room info (V4.5: COALESCE for out-of-hours support)
        'COALESCE("cr".room_name, "extra_room".room_name) AS clinic_room',
      ])
      .from('appointments', 'a')
      .innerJoin('accounts', 'clinic', 'clinic._id = a.clinic_id')
      .leftJoin(
        'clinic_manager_information',
        'cmi',
        'cmi.account_id = clinic._id',
      )
      .leftJoin('addresses', 'addr', 'addr.account_id = clinic._id')
      .leftJoin('accounts', 'doctor', 'doctor._id = a.doctor_id')
      .leftJoin('doctor_information', 'di', 'di.account_id = doctor._id')
      .leftJoin('clinic_shift_hour', 'csh', 'csh._id = a.clinic_shift_hour_id')
      .leftJoin(
        'clinic_shift',
        'cs',
        'cs._id = csh.shift_id AND cs.deleted_at IS NULL',
      )
      .leftJoin(
        'employee_schedule',
        'es',
        'es.clinic_shift_id = cs._id AND es.employee_id = a.doctor_id AND es.work_date = a.appointment_date AND es.deleted_at IS NULL',
      )
      .leftJoin(
        'clinic_room_employee_schedule',
        'cres',
        'cres.employee_schedule_id = es._id',
      )
      .leftJoin(
        'clinic_room',
        'cr',
        'cr._id = cres.clinic_room_id AND cr.deleted_at IS NULL',
      )
      .leftJoin(
        'clinic_room',
        'extra_room',
        'extra_room._id = a.extra_room_id AND extra_room.deleted_at IS NULL',
      )
      .where('a._id = :appointmentId', { appointmentId })
      .andWhere('a.patient_id = :patientId', { patientId })
      .andWhere('a.deleted_at IS NULL')
      .getRawOne();

    if (!appointmentRaw) {
      throw new NotFoundException(
        MESSAGES.failMessage.appointmentNotFound ||
          'Appointment not found or access denied',
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
          'sa.price AS price', // V4.5: Snapshot price from service_appointments
          'sa.discount AS discount', // V4.5: Snapshot discount from service_appointments
          'e._id AS erm_id',
          'e.record_type AS erm_record_type',
          'e.status AS erm_status',
          'e.service_code AS erm_service_code',
          'e.signed_at AS erm_signed_at',
          'e.created_at AS erm_created_at',
          'ec._id AS ec_id',
          'ec.created_at AS ec_created_at',
          'erd._id AS erd_id',
          'erd.created_at AS erd_created_at',
          'el._id AS el_id',
          'el.created_at AS el_created_at',
          'ex._id AS ex_id',
          'ex.created_at AS ex_created_at',
          'eu._id AS eu_id',
          'eu.created_at AS eu_created_at',
        ])
        .from('service_appointments', 'sa')
        .innerJoin(
          'clinic_service_config',
          'csc',
          'csc._id = sa.clinic_service_id',
        )
        .innerJoin('clinic_services', 'cs', 'cs._id = csc.service_id')
        .leftJoin(
          'erms',
          'e',
          'e.service_appointments_id = sa._id AND e.deleted_at IS NULL',
        )
        .leftJoin(
          'erm_consultations',
          'ec',
          'ec.erm_id = e._id AND ec.deleted_at IS NULL',
        )
        .leftJoin(
          'erm_procedures',
          'erd',
          'erd.erm_id = e._id AND erd.deleted_at IS NULL',
        )
        .leftJoin(
          'erm_labs',
          'el',
          'el.erm_id = e._id AND el.deleted_at IS NULL',
        )
        .leftJoin(
          'erm_xrays',
          'ex',
          'ex.erm_id = e._id AND ex.deleted_at IS NULL',
        )
        .leftJoin(
          'erm_ultrasounds',
          'eu',
          'eu.erm_id = e._id AND eu.deleted_at IS NULL',
        )
        .where('sa.appointment_package_id IN (:...packageIds)', { packageIds })
        .andWhere('sa.deleted_at IS NULL')
        .getRawMany();
    }

    // Group service appointments by package
    const servicesByPackage = new Map<string, any[]>();
    const ermsList: any[] = [];
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
          discount: parseFloat(sa.discount || '0'), // V4.5: Include snapshot discount
        },
      });

      if (sa.erm_id) {
        ermsList.push({
          _id: sa.erm_id,
          record_type: sa.erm_record_type,
          status: sa.erm_status,
          service_code: sa.erm_service_code,
          created_at: sa.erm_created_at,
          signed_at: sa.erm_signed_at,
          special_erm: sa.ec_id
            ? { id: sa.ec_id, created_at: sa.ec_created_at }
            : sa.erd_id
              ? { id: sa.erd_id, created_at: sa.erd_created_at }
              : sa.el_id
                ? { id: sa.el_id, created_at: sa.el_created_at }
                : sa.ex_id
                  ? { id: sa.ex_id, created_at: sa.ex_created_at }
                  : sa.eu_id
                    ? { id: sa.eu_id, created_at: sa.eu_created_at }
                    : null,
        });
      }
    });

    // Layer 4: Load doctor additional details if doctor is assigned
    let doctorInfo = undefined;
    if (appointmentRaw.doctor_id) {
      const doctorDetails = await this.dataSource
        .createQueryBuilder()
        .select([
          'di.academic_degree AS academic_degree',
          'di.position AS position',
        ])
        .from('doctor_information', 'di')
        .where('di.account_id = :doctorId', {
          doctorId: appointmentRaw.doctor_id,
        })
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

    // Layer 5: Business Rules - E-Prescription Detail (only when COMPLETED)
    let ePrescriptionDetails = undefined;
    if (appointmentRaw.status === AppointmentStatus.COMPLETED) {
      const ePrescriptionsRow = await this.dataSource
        .createQueryBuilder()
        .select([
          'ep._id AS id',
          'ep.reference_id AS reference_id',
          'ep.doctor_note AS doctor_note',
          'ep.created_at AS created_at',
          'ep.updated_at AS updated_at',
          'dp._id AS detail_id',
          'dp.quantity AS detail_quantity',
          'dp.note AS detail_note',
          'm.id AS medicine_id',
          'm.name AS medicine_name',
        ])
        .from('e_prescriptions', 'ep')
        .leftJoin(
          'detail_e_prescriptions',
          'dp',
          'dp.e_prescription_id = ep._id AND dp.deleted_at IS NULL',
        )
        .leftJoin(
          'medicines',
          'm',
          'm.id = dp.medicine_id AND m.deleted_at IS NULL',
        )
        .where('ep.appointment_id = :appointmentId', { appointmentId })
        .andWhere('ep.deleted_at IS NULL')
        .getRawMany();

      if (ePrescriptionsRow && ePrescriptionsRow.length > 0) {
        const ep = ePrescriptionsRow[0];
        ePrescriptionDetails = {
          _id: ep.id,
          reference_id: ep.reference_id,
          doctor_note: ep.doctor_note,
          created_at: ep.created_at,
          updated_at: ep.updated_at,
          details: ePrescriptionsRow
            .filter((r) => r.detail_id)
            .map((r) => ({
              _id: r.detail_id,
              quantity: r.detail_quantity,
              note: r.detail_note,
              medicine_id: r.medicine_id,
              medicine_name: r.medicine_name,
            })),
        };
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
      appointment_hour:
        appointmentRaw.appointment_hour || appointmentRaw.extra_hour,
      start_hour: appointmentRaw.start_hour,
      end_hour: appointmentRaw.end_hour,
      clinic_room: appointmentRaw.clinic_room || null,
      status: appointmentRaw.status,
      total: parseFloat(appointmentRaw.total || '0'),
      patient_note: appointmentRaw.patient_note,
      reject_reason:
        appointmentRaw.status === AppointmentStatus.CANCELLED
          ? appointmentRaw.reject_reason
          : undefined,
      e_prescription: ePrescriptionDetails,
      erms: ermsList,
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
      .leftJoin(
        'contract_package',
        'cp',
        'cp.employee_id = doctor._id AND cp.deleted_at IS NULL',
      )
      .leftJoin(
        'clinic_contract_information',
        'cci',
        'cci.contract_id = cp._id AND cci.deleted_at IS NULL',
      )
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
      doctorQuery = doctorQuery.andWhere(
        'cci.work_specialty_at_clinic ILIKE :specialization',
        {
          specialization: `%${specialization}%`,
        },
      );
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
          .innerJoin(
            'clinic_manager_information',
            'cmi',
            'cmi.account_id = clinic._id',
          )
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
    const today = getStartOfDay();
    const maxDate = addToVietnamTime(60, 'day');

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
      const today = getStartOfDay();

      if (appointmentDate < today) {
        throw new BadRequestException(
          'Working date must be today or in the future',
        );
      }

      const maxDate = addToVietnamTime(60, 'day');

      if (appointmentDate > maxDate) {
        throw new BadRequestException(
          'Working date cannot be more than 60 days in the future',
        );
      }
    }

    // REFACTOR: Query to get branches with parent admin information
    // Return nested structure: CLINIC_ADMIN -> branches (CLINIC_MANAGER)
    const queryBuilder = this.dataSource
      .createQueryBuilder()
      .select([
        'DISTINCT branch._id AS clinic_id', // Branch ID for booking
        'parent._id AS clinic_admin_id', // Admin ID for grouping
        'cai.clinic_name AS system_name', // Admin clinic name
        'cai.profile_picture AS logo', // Admin profile picture as logo
        'cai.description AS description', // Admin description
        'cmi.clinic_branch_name AS branch_name', // Branch name only
        "CASE WHEN cmi.clinic_branch_name IS NOT NULL AND cmi.clinic_branch_name != '' " +
          "THEN CONCAT(cai.clinic_name, ' - ', cmi.clinic_branch_name) " +
          'ELSE cai.clinic_name END AS full_branch_name', // Full branch name for display
        "COALESCE(addr.address, '') AS clinic_address",
        'addr.district AS district',
      ])
      .from('accounts', 'branch') // Start from branch (CLINIC_MANAGER)
      .innerJoin('accounts', 'parent', 'parent._id = branch.parent_id') // Join parent (CLINIC_ADMIN)
      .innerJoin(
        'clinic_admin_information',
        'cai',
        'cai.account_id = parent._id',
      ) // Join parent info
      .innerJoin(
        'clinic_manager_information',
        'cmi',
        'cmi.account_id = branch._id',
      ) // Join branch info
      .innerJoin('employee_schedule', 'es', 'es.clinic_id = branch._id')
      .innerJoin('clinic_shift', 'cs', 'cs._id = es.clinic_shift_id')
      .innerJoin('clinic_shift_hour', 'csh', 'csh.shift_id = cs._id')
      .leftJoin('addresses', 'addr', 'addr.account_id = branch._id') // Get branch address
      .where('branch.role = :branchRole', {
        branchRole: AccountRole.CLINIC_MANAGER,
      })
      .andWhere('branch.status = :branchStatus', { branchStatus: 'ACTIVE' })
      .andWhere('parent.role = :parentRole', {
        parentRole: AccountRole.CLINIC_ADMIN,
      })
      .andWhere('parent.status = :parentStatus', { parentStatus: 'ACTIVE' })
      .andWhere('es.deleted_at IS NULL')
      .andWhere('csh.deleted_at IS NULL')
      .andWhere('csh.limit > 0');

    // Add date filter only if working_date is provided
    if (working_date) {
      queryBuilder.andWhere('es.work_date = :workDate', {
        workDate: working_date,
      });
    }

    // Add search filter (search both parent clinic name and branch name)
    if (search) {
      queryBuilder.andWhere(
        '(cai.clinic_name ILIKE :search OR cmi.clinic_branch_name ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    // Add district filter (use branch address)
    if (district) {
      queryBuilder.andWhere('addr.district ILIKE :district', {
        district: `%${district}%`,
      });
    }

    queryBuilder.orderBy('system_name', 'ASC').addOrderBy('branch_name', 'ASC');

    // Get all matching branches (before pagination on grouped level)
    const branchesRaw = await queryBuilder.getRawMany();

    // For each branch, calculate available slots and doctors
    const branchesWithStats = await Promise.all(
      branchesRaw.map(async (branch) => {
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
          .where('es.clinic_id = :clinicId', { clinicId: branch.clinic_id })
          .andWhere('es.deleted_at IS NULL')
          .andWhere('csh.deleted_at IS NULL')
          .andWhere('csh.limit > 0');

        // Add date filter only if working_date is provided
        if (working_date) {
          slotsQueryBuilder.andWhere('es.work_date = :workDate', {
            workDate: working_date,
          });
        }

        const slotsQuery = await slotsQueryBuilder.getRawOne();

        // Count booked appointments for THIS BRANCH
        const bookedQueryBuilder = this.dataSource
          .createQueryBuilder()
          .select('COUNT(*) AS booked_count')
          .from('appointments', 'apt')
          .where('apt.clinic_id = :clinicId', { clinicId: branch.clinic_id })
          .andWhere('apt.status IN (:...statuses)', {
            statuses: ['PENDING', 'CONFIRMED', 'CHECKED_IN'],
          })
          .andWhere('apt.deleted_at IS NULL');

        // Add date filter only if working_date is provided
        if (working_date) {
          bookedQueryBuilder.andWhere('apt.appointment_date = :workDate', {
            workDate: working_date,
          });
        }

        const bookedQuery = await bookedQueryBuilder.getRawOne();

        const totalSlots = parseInt(slotsQuery?.total_slots || '0', 10);
        const bookedCount = parseInt(bookedQuery?.booked_count || '0', 10);
        const availableSlots = totalSlots - bookedCount;

        return {
          clinic_id: branch.clinic_id, // CLINIC_MANAGER._id for booking
          clinic_admin_id: branch.clinic_admin_id, // CLINIC_ADMIN._id for grouping
          system_name: branch.system_name,
          logo: branch.logo || null,
          description: branch.description || null,
          full_branch_name: branch.full_branch_name,
          clinic_address: branch.clinic_address || '',
          district: branch.district || null,
          available_slots: availableSlots > 0 ? availableSlots : 0,
          available_doctors: parseInt(slotsQuery?.doctor_count || '0', 10),
        };
      }),
    );

    // Filter out branches with 0 available slots
    const filteredBranches = branchesWithStats.filter(
      (b) => b.available_slots > 0,
    );

    // GROUP BY clinic_admin_id: Group branches by their parent admin
    const groupedByAdmin = filteredBranches.reduce(
      (acc, branch) => {
        const adminId = branch.clinic_admin_id;

        if (!acc[adminId]) {
          acc[adminId] = {
            admin_id: adminId,
            system_name: branch.system_name,
            logo: branch.logo,
            description: branch.description,
            branches: [],
          };
        }

        acc[adminId].branches.push({
          clinic_id: branch.clinic_id,
          branch_name: branch.full_branch_name,
          address: branch.clinic_address,
          district: branch.district,
          available_slots: branch.available_slots,
          available_doctors: branch.available_doctors,
        });

        return acc;
      },
      {} as Record<string, any>,
    );

    // Convert grouped object to array
    const clinicSystems = Object.values(groupedByAdmin);

    // Apply pagination on clinic systems level
    const totalSystems = clinicSystems.length;
    const totalBranches = filteredBranches.length;
    const offset = (page - 1) * limit;
    const paginatedSystems = clinicSystems.slice(offset, offset + limit);

    return {
      data: paginatedSystems,
      meta: {
        total_systems: totalSystems,
        total_branches: totalBranches,
        page,
        limit,
        total_pages: Math.ceil(totalSystems / limit),
      },
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
        .andWhere('csc.clinic_id = :clinicId', {
          clinicId: appointment.clinicId,
        })
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
      await manager
        .getRepository(Appointment)
        .update({ _id: appointmentId }, { total: newTotal });

      return {
        packageId: savedPackage._id,
        serviceName: serviceConfig.service?.serviceName || 'N/A',
        amount: finalPrice,
        newTotal,
      };
    });
  }

  /**
   * Send email reminder for a single appointment
   *
   * @param appointmentId - Appointment UUID
   * @param staffAccountId - Staff account UUID (for authorization)
   * @returns Send reminder response
   */
  async sendAppointmentReminder(
    appointmentId: string,
    staffAccountId: string,
  ): Promise<SendReminderResponseDto> {
    // 1. Validate staff authorization - Get account directly
    const staffAccount =
      await this.accountRepository.findAccountById(staffAccountId);

    if (
      !staffAccount ||
      staffAccount.role !== AccountRole.CLINIC_STAFF ||
      !staffAccount.parentId
    ) {
      throw new ForbiddenException(
        'Staff not authorized or not linked to a clinic',
      );
    }

    const clinicId = staffAccount.parentId;

    // 2. Find appointment with all relations
    const appointment = await this.appointmentRepository.findOne({
      where: { _id: appointmentId, clinicId },
      relations: [
        'patient',
        'patient.generalAccount',
        'clinic',
        'clinic.clinicManagerInformation',
        'clinic.addresses',
        'doctor',
        'doctor.doctorInformation',
      ],
    });

    if (!appointment) {
      throw new NotFoundException(
        'Appointment not found or not in your clinic',
      );
    }

    // 3. Validate appointment status and time (use Vietnam timezone)
    if (!['PENDING', 'CONFIRMED'].includes(appointment.status)) {
      throw new BadRequestException(
        'Appointment must be PENDING or CONFIRMED to send reminder',
      );
    }

    if (isInPast(appointment.appointmentHour)) {
      throw new BadRequestException(
        'Cannot send reminder for past appointments',
      );
    }

    // 4. Validate patient email
    const patientEmail = appointment.patient?.email;
    if (!patientEmail) {
      throw new BadRequestException('Patient does not have email address');
    }

    // 5. Get services for this appointment
    const services = await this.dataSource.query(
      `
      SELECT cs.service_name, cat.type as service_type
      FROM service_appointments sa
      INNER JOIN appointment_package ap ON sa.appointment_package_id = ap._id
      INNER JOIN clinic_service_config csc ON sa.clinic_service_id = csc._id
      INNER JOIN clinic_services cs ON csc.service_id = cs._id
      INNER JOIN clinic_service_category cat ON cs.category_id = cat._id
      WHERE ap.appointment_id = $1
      AND sa.deleted_at IS NULL
      `,
      [appointmentId],
    );

    // 6. Prepare email context
    const clinicAddress = appointment.clinic?.addresses?.[0];
    const doctorInfo = appointment.doctor?.doctorInformation;
    const patientInfo = appointment.patient?.generalAccount;

    // Get clinic name from clinicManagerInformation
    let clinicName = 'Ph├▓ng kh├ím';
    if (appointment.clinic?.clinicManagerInformation) {
      clinicName = appointment.clinic.clinicManagerInformation.clinicBranchName;
    }

    const context: AppointmentReminderContext = {
      patientName: patientInfo?.fullName || 'Bß╗çnh nh├ón',
      clinicName: clinicName,
      clinicAddress: clinicAddress
        ? `${clinicAddress.address}, ${clinicAddress.wardName}, ${clinicAddress.districtName}, ${clinicAddress.provinceName}`
        : 'Ch╞░a c├│ ─æß╗ïa chß╗ë',
      clinicPhone: appointment.clinic?.phone || 'Ch╞░a c├│ S─ÉT',
      appointmentDate: new Date(appointment.appointmentDate).toLocaleDateString(
        'vi-VN',
      ),
      appointmentHour: new Date(appointment.appointmentHour).toLocaleTimeString(
        'vi-VN',
        {
          hour: '2-digit',
          minute: '2-digit',
        },
      ),
      doctorName: doctorInfo?.fullName || 'B├íc s─⌐',
      doctorSpecialization: undefined,
      services: services.map((s: any) => ({
        serviceName: s.service_name,
        serviceType: s.service_type,
      })),
    };

    // 7. Send email (use Vietnam timezone for sentAt)
    const sentAt = getCurrentVietnamTime();
    try {
      await this.mailerService.sendAppointmentReminderEmail(
        patientEmail,
        context,
      );

      // 8. Update isReminder flag
      await this.dataSource
        .getRepository(Appointment)
        .update({ _id: appointmentId }, { isRemider: true });

      return {
        success: true,
        appointment_id: appointmentId,
        patient_email: patientEmail,
        sent_at: formatToVietnamTime(sentAt),
        message: 'Email nhß║»c nhß╗ƒ ─æ├ú ─æ╞░ß╗úc gß╗¡i th├ánh c├┤ng',
      };
    } catch (error) {
      console.error('Failed to send reminder email:', error);
      throw new BadRequestException(
        'Kh├┤ng thß╗â gß╗¡i email. Vui l├▓ng thß╗¡ lß║íi sau.',
      );
    }
  }

  /**
   * Send email reminder for multiple appointments (bulk)
   *
   * @param appointmentIds - Array of appointment UUIDs
   * @param staffAccountId - Staff account UUID (for authorization)
   * @returns Bulk send summary
   */
  async sendAppointmentReminderBulk(
    appointmentIds: string[],
    staffAccountId: string,
  ): Promise<SendReminderBulkResponseDto> {
    const sentAt = getCurrentVietnamTime();

    // 1. Validate staff authorization once (optimization)
    const staffAccount =
      await this.accountRepository.findAccountById(staffAccountId);

    if (
      !staffAccount ||
      staffAccount.role !== AccountRole.CLINIC_STAFF ||
      !staffAccount.parentId
    ) {
      throw new ForbiddenException(
        'Staff not authorized or not linked to a clinic',
      );
    }

    const clinicId = staffAccount.parentId;

    // 2. Initialize counters
    let totalSent = 0;
    let totalFailed = 0;
    let totalSkipped = 0;

    // 3. Process appointments in batches (rate limiting)
    const batchSize = 50;
    for (let i = 0; i < appointmentIds.length; i += batchSize) {
      const batch = appointmentIds.slice(i, i + batchSize);

      await Promise.allSettled(
        batch.map(async (appointmentId) => {
          try {
            // Find appointment and validate
            const appointment = await this.appointmentRepository.findOne({
              where: { _id: appointmentId, clinicId },
              relations: [
                'patient',
                'patient.generalAccount',
                'clinic',
                'clinic.clinicManagerInformation',
                'clinic.addresses',
                'doctor',
                'doctor.doctorInformation',
              ],
            });

            // Skip if not found or not in clinic
            if (!appointment) {
              totalSkipped++;
              return;
            }

            // Skip if status not valid
            if (
              !['PENDING', 'CONFIRMED', 'RESCHEDULED'].includes(
                appointment.status,
              )
            ) {
              totalSkipped++;
              return;
            }

            // Skip if past appointment (use Vietnam timezone)
            if (isInPast(appointment.appointmentHour)) {
              totalSkipped++;
              return;
            }

            // Skip if no patient email
            const patientEmail = appointment.patient?.email;
            if (!patientEmail) {
              totalSkipped++;
              return;
            }

            // Get services
            const services = await this.dataSource.query(
              `
              SELECT cs.service_name, cat.type as service_type
              FROM service_appointments sa
              INNER JOIN appointment_package ap ON sa.appointment_package_id = ap._id
              INNER JOIN clinic_service_config csc ON sa.clinic_service_id = csc._id
              INNER JOIN clinic_services cs ON csc.service_id = cs._id
              INNER JOIN clinic_service_category cat ON cs.category_id = cat._id
              WHERE ap.appointment_id = $1
              AND sa.deleted_at IS NULL
              `,
              [appointmentId],
            );

            // Prepare email context
            const clinicAddress = appointment.clinic?.addresses?.[0];
            const doctorInfo = appointment.doctor?.doctorInformation;
            const patientInfo = appointment.patient?.generalAccount;

            let clinicName = 'Ph├▓ng kh├ím';
            if (appointment.clinic?.clinicManagerInformation) {
              clinicName =
                appointment.clinic.clinicManagerInformation.clinicBranchName;
            }

            const context: AppointmentReminderContext = {
              patientName: patientInfo?.fullName || 'Bß╗çnh nh├ón',
              clinicName: clinicName,
              clinicAddress: clinicAddress
                ? `${clinicAddress.address}, ${clinicAddress.wardName}, ${clinicAddress.districtName}, ${clinicAddress.provinceName}`
                : 'Ch╞░a c├│ ─æß╗ïa chß╗ë',
              clinicPhone: appointment.clinic?.phone || 'Ch╞░a c├│ S─ÉT',
              appointmentDate: new Date(
                appointment.appointmentDate,
              ).toLocaleDateString('vi-VN'),
              appointmentHour: new Date(
                appointment.appointmentHour,
              ).toLocaleTimeString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
              }),
              doctorName: doctorInfo?.fullName || 'B├íc s─⌐',
              doctorSpecialization: undefined,
              services: services.map((s: any) => ({
                serviceName: s.service_name,
                serviceType: s.service_type,
              })),
            };

            // Send email
            await this.mailerService.sendAppointmentReminderEmail(
              patientEmail,
              context,
            );

            // Update reminder flag
            await this.dataSource
              .getRepository(Appointment)
              .update({ _id: appointmentId }, { isRemider: true });

            totalSent++;
          } catch (error) {
            // Log error but continue processing
            console.error(
              `Failed to send reminder for appointment ${appointmentId}:`,
              error.message,
            );
            totalFailed++;
          }
        }),
      );

      // Delay between batches to avoid rate limiting
      if (i + batchSize < appointmentIds.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // 4. Log summary
    console.log(
      `Bulk send completed: ${totalSent} sent, ${totalFailed} failed, ${totalSkipped} skipped out of ${appointmentIds.length} total`,
    );

    return {
      total_requested: appointmentIds.length,
      total_sent: totalSent,
      total_failed: totalFailed,
      total_skipped: totalSkipped,
      sent_at: formatToVietnamTime(sentAt),
      message: `─É├ú gß╗¡i ${totalSent}/${appointmentIds.length} email th├ánh c├┤ng`,
    };
  }

  /**
   * Get all packages of an appointment with payment status
   *
   * Returns all payment packages for a specific appointment, including:
   * - Package details (ID, amount, status, payment type)
   * - Services included in each package
   * - Payment summary (total packages, total amount, paid amount, pending amount)
   *
   * @param appointmentId - Appointment UUID
   * @param staffAccountId - Staff account UUID (for authorization)
   * @returns Packages list with summary
   * @throws NotFoundException if appointment not found or staff has no access
   */
  async getAppointmentPackages(
    appointmentId: string,
    staffAccountId: string,
  ): Promise<any> {
    // 1. Verify staff has access to this appointment
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

    // 2. Verify appointment belongs to staff's clinic
    const appointment = await this.appointmentRepository.findOne({
      where: { _id: appointmentId },
    });

    if (!appointment) {
      throw new NotFoundException('Kh├┤ng t├¼m thß║Ñy lß╗ïch hß║╣n');
    }

    if (appointment.clinicId !== clinicId) {
      throw new ForbiddenException(
        'Bß║ín kh├┤ng c├│ quyß╗ün truy cß║¡p lß╗ïch hß║╣n n├áy',
      );
    }

    // 3. Get all packages with services (raw data)
    const rawPackages =
      await this.appointmentPackageRepository.findAllByAppointmentIdWithServices(
        appointmentId,
      );

    if (rawPackages.length === 0) {
      throw new NotFoundException(
        'Kh├┤ng t├¼m thß║Ñy g├│i thanh to├ín n├áo cho lß╗ïch hß║╣n n├áy',
      );
    }

    // 4. Transform raw data to DTOs
    const packages = rawPackages.map((pkg) => ({
      packageId: pkg.package_id,
      appointmentId: pkg.appointment_id,
      paymentTransactionId: pkg.transaction_id,
      amount: Number(pkg.amount),
      status: pkg.status,
      paymentType: pkg.payment_type,
      services: (pkg.services || []).map((svc: any) => ({
        serviceAppointmentId: svc.service_appointment_id,
        clinicServiceId: svc.clinic_service_id,
        serviceName: svc.service_name,
        servicePrice: Number(svc.service_price),
        serviceDiscount: svc.service_discount
          ? Number(svc.service_discount)
          : undefined,
      })),
    }));

    // 5. Calculate summary
    let totalAmount = 0;
    let paidAmount = 0;
    let pendingAmount = 0;
    let paidPackages = 0;
    let pendingPackages = 0;

    packages.forEach((pkg) => {
      totalAmount += pkg.amount;

      if (pkg.status === AppointmentPackageStatus.PAID) {
        paidAmount += pkg.amount;
        paidPackages++;
      } else if (pkg.status === AppointmentPackageStatus.PENDING_PAYMENT) {
        pendingAmount += pkg.amount;
        pendingPackages++;
      }
    });

    // 6. Return response
    return {
      appointmentId,
      packages,
      summary: {
        totalPackages: packages.length,
        totalAmount,
        paidAmount,
        pendingAmount,
        paidPackages,
        pendingPackages,
      },
    };
  }

  /**
   * Confirm cash payment for a specific package
   *
   * Staff confirms that they have received cash payment from patient for a specific package.
   * This method:
   * 1. Updates the package status to "paid" with payment_type = "cod"
   * 2. Sets transaction_id to NULL (cash doesn't have transaction)
   * 3. Checks if all packages are now paid
   * 4. If all paid, updates appointment status to COMPLETED
   *
   * IMPORTANT: This targets a SPECIFIC packageId to avoid updating wrong packages
   * when 1 appointment has multiple packages with different payment statuses.
   *
   * @param appointmentId - Appointment UUID
   * @param packageId - Specific package UUID to confirm payment for
   * @param staffAccountId - Staff account UUID (for authorization)
   * @returns Confirmation details with updated package info
   * @throws NotFoundException if appointment or package not found
   * @throws ForbiddenException if staff has no access
   * @throws BadRequestException if package is not pending or doesn't belong to appointment
   */
  async confirmCashPayment(
    appointmentId: string,
    packageId: string,
    staffAccountId: string,
  ): Promise<any> {
    // 1. Verify staff has access to this appointment
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

    // 2. Verify appointment belongs to staff's clinic
    const appointment = await this.appointmentRepository.findOne({
      where: { _id: appointmentId },
    });

    if (!appointment) {
      throw new NotFoundException('Kh├┤ng t├¼m thß║Ñy lß╗ïch hß║╣n');
    }

    if (appointment.clinicId !== clinicId) {
      throw new ForbiddenException(
        'Bß║ín kh├┤ng c├│ quyß╗ün truy cß║¡p lß╗ïch hß║╣n n├áy',
      );
    }

    // 3. Verify package exists and belongs to this appointment
    const packageData =
      await this.appointmentPackageRepository.findByIdForUpdate(packageId);

    if (!packageData) {
      throw new NotFoundException('Kh├┤ng t├¼m thß║Ñy g├│i thanh to├ín');
    }

    if (packageData.appointmentId !== appointmentId) {
      throw new BadRequestException(
        'G├│i thanh to├ín kh├┤ng thuß╗Öc lß╗ïch hß║╣n n├áy',
      );
    }

    // 4. Check if package is pending payment
    if (packageData.status !== AppointmentPackageStatus.PENDING_PAYMENT) {
      throw new BadRequestException(
        `Kh├┤ng thß╗â x├íc nhß║¡n thanh to├ín: G├│i thanh to├ín ─æ├ú ß╗ƒ trß║íng th├íi "${packageData.status}"`,
      );
    }

    // 5. Update package: Set as paid with COD payment type
    const updatedPackage =
      await this.appointmentPackageRepository.updatePackage(packageId, {
        transactionId: null,
        paymentType: PaymentType.COD,
        status: AppointmentPackageStatus.PAID,
      });

    // 6. Check if all packages are now paid
    const remainingPendingCount =
      await this.appointmentPackageRepository.countPendingPackages(
        appointmentId,
      );

    const allPackagesPaid = remainingPendingCount === 0;

    // 7. If all packages paid, update appointment status to COMPLETED
    let updatedAppointmentStatus = appointment.status;

    if (allPackagesPaid) {
      appointment.status = AppointmentStatus.COMPLETED;
      await this.appointmentRepository.save(appointment);
      updatedAppointmentStatus = AppointmentStatus.COMPLETED;
    }

    // 8. Return confirmation details
    return {
      message: 'X├íc nhß║¡n thanh to├ín tiß╗ün mß║╖t th├ánh c├┤ng',
      appointmentId,
      package: {
        packageId: updatedPackage._id,
        amount: updatedPackage.amount,
        status: updatedPackage.status,
        paymentType: updatedPackage.paymentType,
        paymentTransactionId: updatedPackage.transactionId,
        updatedAt: updatedPackage.updatedAt,
      },
      appointmentStatus: updatedAppointmentStatus,
      allPackagesPaid,
      remainingPendingPackages: remainingPendingCount,
    };
  }

  /**
   * Get Clinic Schedules (VERSION 4.5 - Option 1 & Option 3)
   *
   * Gß╗Öp 2 API c┼⌐ (working-days + slots) th├ánh 1 API duy nhß║Ñt.
   * Returns nested structure: Dates -> Shifts -> Slots with Doctor info.
   *
   * VERSION 4.5: Th├¬m tham sß╗æ working_date (optional)
   * - Nß║┐u c├│ working_date: Trß║ú vß╗ü lß╗ïch cß╗ºa ng├áy cß╗Ñ thß╗â (Option 3)
   * - Nß║┐u kh├┤ng c├│ working_date: Trß║ú vß╗ü lß╗ïch 60 ng├áy tß╗¢i (Option 1)
   *
   * Business Logic:
   * - Query employee_schedule for clinic_id
   * - Nß║╛U c├│ working_date: Filter by work_date = working_date
   * - Nß║╛U KH├öNG c├│ working_date: Filter by date range [today, today+60]
   * - JOIN clinic_shift, clinic_shift_hour
   * - Calculate available_slots for each slot
   * - Transform in TypeScript: Group by Date -> Shift -> Slots
   *
   * @param clinicId - Clinic UUID (CLINIC_ADMIN or CLINIC_MANAGER)
   * @param workingDate - Optional date filter (YYYY-MM-DD)
   * @returns Nested schedule structure: dates -> shifts -> slots
   */
  async getClinicSchedules(clinicId: string, workingDate?: string) {
    const today = getStartOfDay();
    const maxDate = addToVietnamTime(60, 'day');

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
        throw new BadRequestException(
          'Date cannot be more than 60 days in the future',
        );
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
      .leftJoin(
        'clinic_room_employee_schedule',
        'cres',
        'cres.employee_schedule_id = es._id',
      )
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
            date: this.toVietnamDateString(slot.work_date),
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
   * T├üCH Rß╗£I Lß╗èCH KH├üM V├Ç Dß╗èCH Vß╗ñ
   * API n├áy CHß╗ê trß║ú vß╗ü lß╗ïch kh├ím (dates, shifts, slots).
   * KH├öNG trß║ú vß╗ü services - services ─æ╞░ß╗úc lß║Ñy tß╗½ API ri├¬ng getDoctorServices.
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

    const today = getStartOfDay();
    const maxDate = addToVietnamTime(60, 'day');

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
      .leftJoin(
        'clinic_room_employee_schedule',
        'cres',
        'cres.employee_schedule_id = es._id',
      )
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
            date: this.toVietnamDateString(slot.work_date),
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

  /**
   * Get Available Doctors for Out-of-Hours Booking (Option 4)
   *
   * Business Logic:
   * - Parse extraHour to Date object for TIMESTAMPTZ comparison
   * - Step A: Query all doctors (role = DOCTOR) working at clinic on the date
   * - Step B: Query doctors who are BUSY at the requested time
   * - Step C: Filter out busy doctors from available list
   * - Return response with data and metadata
   *
   * @param clinicId - Clinic UUID
   * @param appointmentDate - Appointment date (YYYY-MM-DD)
   * @param extraHour - Extra hour timestamp (ISO 8601 with timezone)
   * @returns Available doctors with metadata
   */
  async getAvailableDoctorsForOutOfHours(
    clinicId: string,
    appointmentDate: string,
    extraHour: string,
  ): Promise<any> {
    // Parse extraHour to Date object for comparison with TIMESTAMPTZ
    const requestedTime = new Date(extraHour);
    if (isNaN(requestedTime.getTime())) {
      throw new BadRequestException(
        'Invalid extra_hour format. Use ISO 8601 with timezone.',
      );
    }

    // Parse appointment date
    const date = new Date(appointmentDate);
    if (isNaN(date.getTime())) {
      throw new BadRequestException(
        'Invalid appointment_date format. Use YYYY-MM-DD.',
      );
    }

    // Step A: Query all doctors working at the clinic on the specified date
    const allDoctors = await this.dataSource
      .createQueryBuilder()
      .select([
        'DISTINCT doctor._id AS doctor_id',
        'COALESCE(di.full_name, doctor.username) AS doctor_name',
        'di.profile_picture AS doctor_avatar',
        'di.academic_degree AS academic_degree',
        'di.position AS position',
      ])
      .from('employee_schedule', 'es')
      .innerJoin('accounts', 'doctor', 'doctor._id = es.employee_id')
      .leftJoin('doctor_information', 'di', 'di.account_id = doctor._id')
      .where('es.clinic_id = :clinicId', { clinicId })
      .andWhere('es.work_date = :workDate', { workDate: date })
      .andWhere('doctor.role = :role', { role: 'DOCTOR' })
      .andWhere('doctor.status = :status', { status: 'ACTIVE' })
      .andWhere('es.deleted_at IS NULL')
      .getRawMany();

    // Step B: Query doctors who are BUSY at the requested time
    // A doctor is BUSY if they have an appointment where:
    // - appointment_date matches the requested date
    // - AND (appointment_hour = requestedTime OR extra_hour = requestedTime)
    const busyDoctors = await this.dataSource
      .createQueryBuilder()
      .select('DISTINCT a.doctor_id AS doctor_id')
      .from('appointments', 'a')
      .where('a.clinic_id = :clinicId', { clinicId })
      .andWhere('a.appointment_date = :appointmentDate', {
        appointmentDate: date,
      })
      .andWhere(
        '(a.appointment_hour = :requestedTime OR a.extra_hour = :requestedTime)',
        { requestedTime },
      )
      .andWhere(
        "a.status IN ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS')",
      )
      .andWhere('a.doctor_id IS NOT NULL')
      .andWhere('a.deleted_at IS NULL')
      .getRawMany();

    // Step C: Filter out busy doctors from the available list
    const busyDoctorIds = new Set(busyDoctors.map((d) => d.doctor_id));
    const availableDoctors = allDoctors.filter(
      (doctor) => !busyDoctorIds.has(doctor.doctor_id),
    );

    // Step D: Return response with data and metadata
    return {
      data: availableDoctors.map((doctor) => ({
        doctor_id: doctor.doctor_id,
        doctor_name: doctor.doctor_name,
        doctor_avatar: doctor.doctor_avatar,
        academic_degree: doctor.academic_degree,
        position: doctor.position,
      })),
      meta: {
        total: availableDoctors.length,
        requested_date: appointmentDate,
        requested_time: extraHour,
      },
    };
  }

  /**
   * Get doctor's patient history
   *
   * Retrieves list of all patients who have been examined by the doctor
   * with summary statistics and last diagnosis
   *
   * @param doctorId - Doctor account UUID
   * @param queryDto - Query parameters (search, pagination, sorting)
   * @returns Paginated list of patients with visit summary
   */
  async getDoctorPatientHistory(
    doctorId: string,
    queryDto: DoctorPatientHistoryQueryDto,
  ): Promise<DoctorPatientHistoryResponseDto> {
    const {
      page = 1,
      limit = 20,
      search,
      sort_by = 'last_visit_date',
      order = 'DESC',
    } = queryDto;
    const skip = (page - 1) * limit;

    // Build query to get distinct patients with statistics
    const queryBuilder = this.dataSource
      .getRepository(Appointment)
      .createQueryBuilder('appointment')
      .leftJoin('appointment.patient', 'patient')
      .leftJoin('patient.generalAccount', 'generalAccount')
      .where('appointment.doctorId = :doctorId', { doctorId })
      .andWhere('appointment.deleted_at IS NULL')
      .andWhere('appointment.status IN (:...statuses)', {
        statuses: [AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED],
      })
      .select('patient._id', 'patientId')
      .addSelect('patient.email', 'email')
      .addSelect('patient.phone', 'phone')
      .addSelect('generalAccount.fullName', 'fullName')
      .addSelect('generalAccount.dob', 'dateOfBirth')
      .addSelect('generalAccount.gender', 'gender')
      .addSelect('generalAccount.profilePicture', 'profilePicture')
      .addSelect('MIN(appointment.appointmentDate)', 'firstVisitDate')
      .addSelect('MAX(appointment.appointmentDate)', 'lastVisitDate')
      .addSelect('COUNT(appointment._id)', 'totalVisits')
      .groupBy('patient._id')
      .addGroupBy('patient.email')
      .addGroupBy('patient.phone')
      .addGroupBy('generalAccount.fullName')
      .addGroupBy('generalAccount.dob')
      .addGroupBy('generalAccount.gender')
      .addGroupBy('generalAccount.profilePicture');

    // Add search filter if provided
    if (search && search.trim()) {
      queryBuilder.andWhere(
        '(generalAccount.fullName ILIKE :search OR ' +
          'patient.phone LIKE :searchExact OR ' +
          'patient.email ILIKE :searchExact)',
        { search: `%${search}%`, searchExact: `%${search}%` },
      );
    }

    // Add sorting - use proper field names for ORDER BY
    if (sort_by === 'patient_name') {
      queryBuilder.orderBy('generalAccount.fullName', order as 'ASC' | 'DESC');
    } else if (sort_by === 'total_visits') {
      queryBuilder.orderBy('COUNT(appointment._id)', order as 'ASC' | 'DESC');
    } else {
      // Default: sort by lastVisitDate
      queryBuilder.orderBy(
        'MAX(appointment.appointmentDate)',
        order as 'ASC' | 'DESC',
      );
    }

    // Get total count
    const totalQuery = queryBuilder.clone();
    const totalResult = await totalQuery.getRawMany();
    const total = totalResult.length;

    // Add pagination
    queryBuilder.offset(skip).limit(limit);

    // Execute query
    const patients = await queryBuilder.getRawMany();

    // Get last diagnosis and last appointment status for each patient
    const patientsWithDetails = await Promise.all(
      patients.map(async (patient) => {
        // Get last appointment
        const lastAppointment = await this.dataSource
          .getRepository(Appointment)
          .findOne({
            where: {
              patientId: patient.patientId,
              doctorId: doctorId,
              status: AppointmentStatus.COMPLETED,
            },
            order: { appointmentDate: 'DESC' },
          });

        let lastDiagnosis: string | null = null;
        let lastAppointmentStatus = AppointmentStatus.COMPLETED;

        if (lastAppointment) {
          lastAppointmentStatus = lastAppointment.status;

          // Try to get diagnosis from ERM Consultation
          const lastConsultation = await this.dataSource
            .getRepository(ERM)
            .createQueryBuilder('erm')
            .leftJoinAndSelect('erm.appointment', 'appointment')
            .leftJoin(
              'erm_consultations',
              'consultation',
              'consultation.erm_id = erm._id',
            )
            .where('erm.appointmentId = :appointmentId', {
              appointmentId: lastAppointment._id,
            })
            .andWhere('erm.recordType = :recordType', {
              recordType: ERMRecordType.CONSULTATION,
            })
            .andWhere('erm.status = :status', { status: ERMStatus.COMPLETED })
            .addSelect('consultation.working_diagnosis', 'workingDiagnosis')
            .getRawOne();

          if (lastConsultation && lastConsultation.workingDiagnosis) {
            // Extract diagnosis text from JSONB
            const diagnosis = lastConsultation.workingDiagnosis;
            if (typeof diagnosis === 'object' && diagnosis.primary) {
              lastDiagnosis = diagnosis.primary;
            } else if (typeof diagnosis === 'string') {
              lastDiagnosis = diagnosis;
            }
          }
        }

        // Calculate age from date of birth
        let age: number | null = null;
        if (patient.dateOfBirth) {
          const birthDate = new Date(patient.dateOfBirth);
          const today = new Date();
          age = today.getFullYear() - birthDate.getFullYear();
          const monthDiff = today.getMonth() - birthDate.getMonth();
          if (
            monthDiff < 0 ||
            (monthDiff === 0 && today.getDate() < birthDate.getDate())
          ) {
            age--;
          }
        }

        // Get patient addresses
        const addressesData = await this.dataSource.query(
          `
          SELECT _id, address, ward, ward_name, district, district_name, province, province_name
          FROM addresses
          WHERE account_id = $1
            AND deleted_at IS NULL
          ORDER BY created_at DESC
          `,
          [patient.patientId],
        );

        const addresses = addressesData.map((addr: any) => ({
          id: addr._id,
          address: addr.address,
          ward: addr.ward,
          wardName: addr.ward_name,
          district: addr.district,
          districtName: addr.district_name,
          province: addr.province,
          provinceName: addr.province_name,
        }));

        return {
          patientId: patient.patientId,
          fullName: patient.fullName || 'Unknown',
          dateOfBirth: patient.dateOfBirth
            ? this.formatDate(patient.dateOfBirth)
            : null,
          age,
          gender: patient.gender || null,
          phone: patient.phone || null,
          email: patient.email || 'No email',
          profileImageUrl: patient.profilePicture || null,
          addresses,
          firstVisitDate: this.formatDate(patient.firstVisitDate),
          lastVisitDate: this.formatDate(patient.lastVisitDate),
          totalVisits: parseInt(patient.totalVisits, 10),
          lastDiagnosis,
          lastAppointmentStatus,
        };
      }),
    );

    return {
      total,
      page,
      limit,
      patients: patientsWithDetails,
    };
  }

  /**
   * Get doctor's patient detail with appointment history
   *
   * Retrieves detailed information about a specific patient including:
   * - Patient personal information with address
   * - Visit statistics with the doctor
   * - Paginated appointment history with services and diagnosis
   *
   * @param doctorId - Doctor account UUID
   * @param patientId - Patient account UUID
   * @param queryDto - Query parameters for filtering appointments
   * @returns Patient detail with statistics and appointment history
   * @throws ForbiddenException if doctor has never examined this patient
   */
  async getDoctorPatientDetail(
    doctorId: string,
    patientId: string,
    queryDto: DoctorPatientAppointmentsQueryDto,
  ): Promise<DoctorPatientDetailResponseDto> {
    const {
      status = 'ALL',
      from_date,
      to_date,
      page = 1,
      limit = 10,
    } = queryDto;

    // Step 1: Verify doctor has examined this patient
    const hasExamined = await this.appointmentRepository
      .createQueryBuilder('appointment')
      .where('appointment.doctorId = :doctorId', { doctorId })
      .andWhere('appointment.patientId = :patientId', { patientId })
      .andWhere('appointment.status = :status', { status: 'COMPLETED' })
      .getCount();

    if (hasExamined === 0) {
      throw new ForbiddenException(
        'You do not have permission to view this patient information',
      );
    }

    // Step 2: Get patient information with address
    const patient = await this.accountRepository.findAccountById(patientId);

    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    const generalAccount = patient.generalAccount;

    // Get addresses from database (for backward compatibility, keep first one as string)
    const addressResult = await this.dataSource.query(
      `
      SELECT _id, address, ward, ward_name, district, district_name, province, province_name
      FROM addresses
      WHERE account_id = $1
        AND deleted_at IS NULL
      ORDER BY created_at DESC
      `,
      [patientId],
    );
    const addressData = addressResult[0];

    // Map all addresses to AddressDto array
    const addresses = addressResult.map((addr: any) => ({
      id: addr._id,
      address: addr.address,
      ward: addr.ward,
      wardName: addr.ward_name,
      district: addr.district,
      districtName: addr.district_name,
      province: addr.province,
      provinceName: addr.province_name,
    }));

    // Calculate age from date of birth
    let age: number | null = null;
    if (generalAccount?.dob) {
      const birthDate = new Date(generalAccount.dob);
      const today = new Date();
      age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (
        monthDiff < 0 ||
        (monthDiff === 0 && today.getDate() < birthDate.getDate())
      ) {
        age--;
      }
    }

    // Step 3: Calculate visit statistics
    const statsQuery = this.appointmentRepository
      .createQueryBuilder('appointment')
      .select('MIN(appointment.appointmentDate)', 'firstVisit')
      .addSelect('MAX(appointment.appointmentDate)', 'lastVisit')
      .addSelect('COUNT(DISTINCT appointment._id)', 'totalVisits')
      .where('appointment.doctorId = :doctorId', { doctorId })
      .andWhere('appointment.patientId = :patientId', { patientId })
      .andWhere('appointment.status = :status', { status: 'COMPLETED' });

    const statsResult = await statsQuery.getRawOne();

    // Get unique services used
    const servicesUsed = await this.dataSource.query(
      `
      SELECT COUNT(DISTINCT cs.service_name) as service_count
      FROM appointments a
      INNER JOIN appointment_package ap ON ap.appointment_id = a._id
      INNER JOIN service_appointments sa ON sa.appointment_package_id = ap._id
      INNER JOIN clinic_service_config csc ON csc._id = sa.clinic_service_id
      INNER JOIN clinic_services cs ON cs._id = csc.service_id
      WHERE a.doctor_id = $1
        AND a.patient_id = $2
        AND a.status = 'COMPLETED'
        AND sa.deleted_at IS NULL
      `,
      [doctorId, patientId],
    );

    const statistics: PatientVisitStatisticsDto = {
      first_visit: statsResult?.firstVisit || null,
      last_visit: statsResult?.lastVisit || null,
      total_visits: parseInt(statsResult?.totalVisits || '0', 10),
      services_used: servicesUsed[0]?.service_count || 0,
    };

    // Step 4: Get paginated appointment history with filtering
    const appointmentQuery = this.appointmentRepository
      .createQueryBuilder('appointment')
      .leftJoinAndSelect('appointment.patient', 'patient')
      .leftJoinAndSelect('patient.generalAccount', 'generalAccount')
      .leftJoinAndSelect('patient.addresses', 'patientAddresses')
      .leftJoinAndSelect('appointment.doctor', 'doctor')
      .leftJoinAndSelect('doctor.doctorInformation', 'doctorInformation')
      .leftJoinAndSelect('appointment.clinic', 'clinic')
      .leftJoinAndSelect('clinic.clinicManagerInformation', 'clinicManagerInfo')
      .where('appointment.doctorId = :doctorId', { doctorId })
      .andWhere('appointment.patientId = :patientId', { patientId });

    // Apply status filter
    if (status !== 'ALL') {
      appointmentQuery.andWhere('appointment.status = :status', { status });
    } else {
      // When ALL, show COMPLETED, CANCELLED, NO_SHOW
      appointmentQuery.andWhere('appointment.status IN (:...statuses)', {
        statuses: ['COMPLETED', 'CANCELLED', 'NO_SHOW'],
      });
    }

    // Apply date range filter
    if (from_date) {
      appointmentQuery.andWhere('appointment.appointmentDate >= :fromDate', {
        fromDate: from_date,
      });
    }
    if (to_date) {
      appointmentQuery.andWhere('appointment.appointmentDate <= :toDate', {
        toDate: to_date,
      });
    }

    // Get total count for pagination
    const total = await appointmentQuery.getCount();

    // Apply pagination and sorting (newest first)
    appointmentQuery
      .orderBy('appointment.appointmentDate', 'DESC')
      .addOrderBy('appointment.appointmentHour', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const appointments = await appointmentQuery.getMany();

    // Step 5: Load services and clinic rooms for all appointments
    const appointmentIds = appointments.map((apt) => apt._id);

    // Fetch services for all appointments
    const servicesMap =
      appointmentIds.length > 0
        ? await this.appointmentPackageRepository.findServicesByAppointmentIds(
            appointmentIds,
          )
        : new Map();

    // Fetch clinic rooms for all appointments
    const appointmentData = appointments.map((apt) => ({
      appointmentId: apt._id,
      clinicShiftHourId: apt.clinicShiftHourId,
      doctorId: apt.doctorId,
      appointmentDate: apt.appointmentDate,
    }));

    const clinicRoomsMap =
      appointmentIds.length > 0
        ? await this.employeeScheduleRepository.findClinicRoomsForMultipleAppointments(
            appointmentData,
          )
        : new Map();

    // Transform appointments to AppointmentResponseDto
    const appointmentHistory: AppointmentResponseDto[] = appointments.map(
      (appointment) => {
        const services = servicesMap.get(appointment._id) || [];
        const clinicRooms = clinicRoomsMap.get(appointment._id) || [];
        return this.transformToResponseDto(appointment, services, clinicRooms);
      },
    );

    // Build response
    const patientDetail: DoctorViewPatientDetailDto = {
      patient_id: patient._id,
      full_name: generalAccount?.fullName || 'N/A',
      phone: patient.phone || 'N/A',
      email: patient.email || null,
      gender: generalAccount?.gender || null,
      date_of_birth: generalAccount?.dob
        ? new Date(generalAccount.dob).toISOString().split('T')[0]
        : null,
      age,
      address: addressData
        ? `${addressData.address || ''}, ${addressData.ward_name || ''}, ${addressData.district_name || ''}, ${addressData.province_name || ''}`.trim()
        : null,
      addresses,
    };

    return {
      patient: patientDetail,
      statistics,
      appointment_history: {
        total,
        page,
        limit,
        appointments: appointmentHistory,
      },
    };
  }

  /**
   * Get detailed appointment information for doctor's patient history
   *
   * Returns comprehensive appointment details including ERMs and prescription.
   * Includes: patient info with addresses, doctor details, services with pricing,
   * clinic rooms, payment package, ERMs, prescription with medicines.
   *
   * @param doctorId - UUID of the doctor making the request
   * @param appointmentId - UUID of the appointment to retrieve
   * @returns Complete appointment detail with ERMs and prescription
   * @throws ForbiddenException if doctor does not own this appointment
   * @throws NotFoundException if appointment not found
   */
  async getDoctorAppointmentHistoryDetail(
    doctorId: string,
    appointmentId: string,
  ): Promise<DoctorAppointmentHistoryDetailResponseDto> {
    // Step 1: Get appointment with all basic relations
    const appointment = await this.appointmentRepository
      .createQueryBuilder('appointment')
      .leftJoinAndSelect('appointment.patient', 'patient')
      .leftJoinAndSelect('patient.generalAccount', 'patientGeneral')
      .leftJoinAndSelect('patient.addresses', 'patientAddresses')
      .leftJoinAndSelect('appointment.doctor', 'doctor')
      .leftJoinAndSelect('doctor.doctorInformation', 'doctorInfo')
      .leftJoinAndSelect('appointment.clinic', 'clinic')
      .leftJoinAndSelect('clinic.clinicManagerInformation', 'clinicInfo')
      .leftJoinAndSelect('clinic.addresses', 'clinicAddress')
      .leftJoinAndSelect('appointment.clinicShiftHour', 'shiftHour')
      .where('appointment._id = :appointmentId', { appointmentId })
      .getOne();

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    // Step 2: Verify doctor ownership
    if (appointment.doctorId !== doctorId) {
      throw new ForbiddenException(
        'You do not have permission to view this appointment',
      );
    }

    // Step 3: Build patient info with addresses
    const patientGeneral = appointment.patient?.generalAccount;
    let patientAge: number | null = null;
    if (patientGeneral?.dob) {
      const birthDate = new Date(patientGeneral.dob);
      const today = new Date();
      patientAge = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (
        monthDiff < 0 ||
        (monthDiff === 0 && today.getDate() < birthDate.getDate())
      ) {
        patientAge--;
      }
    }

    const patient: AppointmentPatientInfoDto = {
      patient_id: appointment.patientId,
      full_name: patientGeneral?.fullName || 'N/A',
      date_of_birth: patientGeneral?.dob
        ? new Date(patientGeneral.dob).toISOString().split('T')[0]
        : null,
      age: patientAge,
      gender: patientGeneral?.gender || null,
      phone: appointment.patient?.phone || null,
      email: appointment.patient?.email || 'N/A',
      profile_image_url: patientGeneral?.profilePicture || null,
      addresses:
        appointment.patient?.addresses?.map((addr) => ({
          address: addr.address || '',
          ward: addr.ward || '',
          wardName: addr.wardName || '',
          district: addr.district || '',
          districtName: addr.districtName || '',
          province: addr.province || '',
          provinceName: addr.provinceName || '',
        })) || [],
    };

    // Step 4: Build doctor info
    const doctorInfo = appointment.doctor?.doctorInformation;
    const doctor: AppointmentDoctorInfoDto = {
      doctor_id: appointment.doctorId || '',
      full_name: doctorInfo?.fullName || 'N/A',
      specialization:
        doctorInfo?.position || doctorInfo?.academicDegree || null,
      license_number: null, // medicalLicense is JSONB, not accessible directly
      profile_image_url: doctorInfo?.profilePicture || null,
    };

    // Step 5: Build clinic info
    const clinicInfo = appointment.clinic?.clinicManagerInformation;
    const clinicAddress = appointment.clinic?.addresses?.[0];
    const clinic: AppointmentClinicInfoDto = {
      clinic_id: appointment.clinicId,
      clinic_name: clinicInfo?.clinicBranchName || 'N/A',
      address: clinicAddress
        ? `${clinicAddress.address || ''}, ${clinicAddress.wardName || ''}, ${clinicAddress.districtName || ''}, ${clinicAddress.provinceName || ''}`.trim()
        : 'N/A',
      phone: appointment.clinic?.phone || null,
    };

    // Step 6: Build shift hour info with limit and shiftType
    const shiftHourData = appointment.clinicShiftHour;
    const shift_hour: AppointmentShiftHourInfoDto = {
      doctor_shift_hour_id: shiftHourData?._id || null,
      shift_date:
        appointment.appointmentDate instanceof Date
          ? appointment.appointmentDate.toISOString().split('T')[0]
          : new Date(appointment.appointmentDate).toISOString().split('T')[0],
      start_time: shiftHourData?.startHour || null,
      end_time: shiftHourData?.endHour || null,
      limit: shiftHourData?.limit || null,
      room_number: null, // Not in ClinicShiftHour schema
      room_name: null, // Not in ClinicShiftHour schema
    };

    // Step 7: Load clinic rooms
    let clinicRooms: any[] = [];
    if (
      appointment.doctorId &&
      appointment.appointmentDate &&
      appointment.clinicShiftHourId
    ) {
      const clinicRoomsMap =
        await this.employeeScheduleRepository.findClinicRoomsForMultipleAppointments(
          [
            {
              appointmentId: appointment._id,
              clinicShiftHourId: appointment.clinicShiftHourId,
              doctorId: appointment.doctorId,
              appointmentDate: appointment.appointmentDate,
            },
          ],
        );
      clinicRooms = (clinicRoomsMap.get(appointment._id) || []).map(
        (room: any) => ({
          id: room.id,
          roomName: room.roomName,
        }),
      );
    }

    // Step 8: Get services with ERM information and discount
    const servicesData = await this.dataSource.query(
      `
      SELECT 
        sa._id as service_appointment_id,
        sa.clinic_service_id,
        sa.price as sa_price,
        sa.discount as sa_discount,
        csc.service_id,
        cs.service_code,
        cs.service_name,
        cat.type as service_type,
        erm._id as erm_id,
        erm.status as erm_status
      FROM appointment_package ap
      INNER JOIN service_appointments sa ON sa.appointment_package_id = ap._id
      INNER JOIN clinic_service_config csc ON csc._id = sa.clinic_service_id
      INNER JOIN clinic_services cs ON cs._id = csc.service_id
      LEFT JOIN clinic_service_category cat ON cat._id = cs.category_id
      LEFT JOIN erms erm ON erm.service_appointments_id = sa._id AND erm.deleted_at IS NULL
      WHERE ap.appointment_id = $1
        AND sa.deleted_at IS NULL
      ORDER BY sa.created_at
      `,
      [appointmentId],
    );

    const services: AppointmentServiceDetailDto[] = servicesData.map(
      (svc: any) => ({
        service_appointment_id: svc.service_appointment_id,
        clinic_service_id: svc.clinic_service_id,
        service_code: svc.service_code || 'N/A',
        service_name: svc.service_name,
        service_type: svc.service_type || 'UNKNOWN',
        price: parseFloat(svc.sa_price) || 0,
        discount: svc.sa_discount ? parseFloat(svc.sa_discount) : null,
        added_during_examination: false, // Not tracked in current schema
        erm_id: svc.erm_id || null,
        erm_status: svc.erm_status || null,
      }),
    );

    // Step 9: Load payment package with services
    const appointmentPackage =
      await this.appointmentPackageRepository.findByAppointmentIdWithServices(
        appointmentId,
      );

    let paymentPackage: PaymentPackageDto | null = null;
    if (appointmentPackage) {
      const packageServices =
        appointmentPackage.services?.map((sa: any) => ({
          id: sa.clinicServiceId || sa._id,
          serviceName: sa.clinicService?.service?.serviceName || 'N/A',
          price: parseFloat(sa.price) || 0,
          discount: sa.discount ? parseFloat(sa.discount) : null,
        })) || [];

      paymentPackage = {
        id: appointmentPackage._id,
        transactionId: appointmentPackage.transactionId,
        amount: parseFloat(appointmentPackage.amount.toString()),
        status: appointmentPackage.status || null,
        paymentType: appointmentPackage.paymentType || null,
        services: packageServices,
      };
    }

    // Step 10: Get ERMs with creator information
    const ermsData = await this.dataSource.query(
      `
      SELECT 
        erm._id as erm_id,
        erm.service_appointments_id,
        erm.record_type,
        erm.service_code,
        erm.status,
        erm.created_at,
        erm.updated_at,
        erm.created_by,
        COALESCE(doc_info.full_name, 'Unknown') as created_by_name,
        cs.service_name
      FROM erms erm
      INNER JOIN service_appointments sa ON sa._id = erm.service_appointments_id
      INNER JOIN clinic_service_config csc ON csc._id = sa.clinic_service_id
      INNER JOIN clinic_services cs ON cs._id = csc.service_id
      LEFT JOIN accounts creator ON creator._id = erm.created_by
      LEFT JOIN doctor_information doc_info ON doc_info.account_id = creator._id
      WHERE erm.appointment_id = $1
        AND erm.deleted_at IS NULL
      ORDER BY erm.created_at
      `,
      [appointmentId],
    );

    const erms: AppointmentERMSummaryDto[] = ermsData.map((erm: any) => ({
      erm_id: erm.erm_id,
      service_appointment_id: erm.service_appointments_id,
      record_type: erm.record_type,
      service_code: erm.service_code || null,
      service_name: erm.service_name,
      status: erm.status,
      created_at: erm.created_at,
      updated_at: erm.updated_at,
      created_by: erm.created_by,
      created_by_name: erm.created_by_name,
    }));

    // Step 11: Get prescription with medicines
    let prescription: AppointmentPrescriptionDto | null = null;
    const prescriptionData = await this.dataSource.query(
      `
      SELECT 
        ep._id as e_prescription_id,
        ep.appointment_id,
        ep.reference_id,
        ep.doctor_note,
        ep.created_at
      FROM e_prescriptions ep
      WHERE ep.appointment_id = $1
        AND ep.deleted_at IS NULL
      LIMIT 1
      `,
      [appointmentId],
    );

    if (prescriptionData && prescriptionData.length > 0) {
      const prescrip = prescriptionData[0];

      // Get medicines for this prescription
      const medicinesData = await this.dataSource.query(
        `
        SELECT 
          epd._id as detail_id,
          epd.medicine_id,
          m.name as medicine_name,
          m.therapeutic_class,
          epd.check_out,
          m.habit_forming,
          m.side_effect
        FROM detail_e_prescriptions epd
        INNER JOIN medicines m ON m.id = epd.medicine_id
        WHERE epd.e_prescription_id = $1
          AND epd.deleted_at IS NULL
        ORDER BY epd.created_at
        `,
        [prescrip.e_prescription_id],
      );

      const medicines: PrescriptionMedicineDto[] = medicinesData.map(
        (med: any) => ({
          detail_id: med.detail_id,
          medicine_id: med.medicine_id,
          medicine_name: med.medicine_name,
          unit: null, // Unit field doesn't exist in Medicine entity
          therapeutic_class: med.therapeutic_class || null,
          check_out: med.check_out,
          habit_forming: med.habit_forming || false,
          contraindications: null, // Contraindications field doesn't exist in Medicine entity
          side_effects: med.side_effect || null,
        }),
      );

      prescription = {
        e_prescription_id: prescrip.e_prescription_id,
        appointment_id: prescrip.appointment_id,
        reference_id: prescrip.reference_id,
        doctor_note: prescrip.doctor_note || null,
        created_at: prescrip.created_at,
        created_by: appointment.doctorId || '',
        created_by_name: doctorInfo?.fullName || 'Unknown',
        medicines,
      };
    }

    // Step 12: Build final response
    return {
      appointment_id: appointment._id,
      appointment_date:
        appointment.appointmentDate instanceof Date
          ? appointment.appointmentDate.toISOString().split('T')[0]
          : new Date(appointment.appointmentDate).toISOString().split('T')[0],
      appointment_hour: appointment.appointmentHour,
      extra_hour: appointment.extraHour || null,
      status: appointment.status,
      total_price: parseFloat(appointment.total.toString()),
      patient,
      doctor,
      clinic,
      shift_hour,
      clinicRooms,
      isReminder: appointment.isRemider || false,
      package: paymentPackage,
      services,
      erms,
      prescription,
      patient_note: appointment.patientNote || null,
      doctor_note: null, // Not in current schema
      cancelled_reason: appointment.rejectReason || null,
      completed_at: null, // Not in current schema
      created_at: appointment.createdAt,
      updated_at: appointment.updatedAt,
    };
  }

  /**
   * Get Patient ERMs List
   * Retrieves summary of all ERM records linked to the appointment
   */
  async getPatientERMsList(patientId: string, appointmentId: string) {
    const appointment = await this.dataSource
      .getRepository(Appointment)
      .findOne({
        where: { _id: appointmentId, patientId, deletedAt: IsNull() },
        select: ['_id', 'status'],
      });

    if (!appointment) {
      throw new NotFoundException(
        MESSAGES.failMessage.appointmentNotFound ||
          'Appointment not found or access denied',
      );
    }

    const ermsRaw = await this.dataSource
      .createQueryBuilder()
      .select([
        'e._id AS id',
        'e.record_type AS record_type',
        'e.status AS status',
        'e.service_code AS service_code',
        'e.created_at AS created_at',
        'ec._id AS ec_id',
        'ec.main_service_code AS ec_service_code',
        'ec.created_at AS ec_created_at',
        'ex._id AS ex_id',
        'ex.region AS ex_region',
        'ex.created_at AS ex_created_at',
        'el._id AS el_id',
        'el.panel_name AS el_panel_name',
        'el.created_at AS el_created_at',
        'eu._id AS eu_id',
        'eu.service_code AS eu_service_code',
        'eu.created_at AS eu_created_at',
        'erd._id AS erd_id',
        'erd.procedure_code AS erd_procedure_code',
        'erd.created_at AS erd_created_at',
        'ebd._id AS ebd_id',
        'ebd.site AS ebd_site',
        'ebd.created_at AS ebd_created_at',
      ])
      .from('erms', 'e')
      .leftJoin(
        'erm_consultations',
        'ec',
        'ec.erm_id = e._id AND ec.deleted_at IS NULL',
      )
      .leftJoin(
        'erm_xrays',
        'ex',
        'ex.erm_id = e._id AND ex.deleted_at IS NULL',
      )
      .leftJoin('erm_labs', 'el', 'el.erm_id = e._id AND el.deleted_at IS NULL')
      .leftJoin(
        'erm_ultrasounds',
        'eu',
        'eu.erm_id = e._id AND eu.deleted_at IS NULL',
      )
      .leftJoin(
        'erm_procedures',
        'erd',
        'erd.erm_id = e._id AND erd.deleted_at IS NULL',
      )
      .leftJoin(
        'erm_bone_density',
        'ebd',
        'ebd.erm_id = e._id AND ebd.deleted_at IS NULL',
      )
      .where('e.appointment_id = :appointmentId', { appointmentId })
      .andWhere('e.deleted_at IS NULL')
      .getRawMany();

    return ermsRaw.map((e) => ({
      id: e.id,
      record_type: e.record_type,
      status: e.status,
      service_code: e.service_code,
      created_at: e.created_at,
      special_erm: e.ec_id
        ? {
            id: e.ec_id,
            service_code: e.ec_service_code,
            created_at: e.ec_created_at,
          }
        : e.ex_id
          ? { id: e.ex_id, region: e.ex_region, created_at: e.ex_created_at }
          : e.el_id
            ? {
                id: e.el_id,
                panel_name: e.el_panel_name,
                created_at: e.el_created_at,
              }
            : e.eu_id
              ? {
                  id: e.eu_id,
                  service_code: e.eu_service_code,
                  created_at: e.eu_created_at,
                }
              : e.erd_id
                ? {
                    id: e.erd_id,
                    procedure_code: e.erd_procedure_code,
                    created_at: e.erd_created_at,
                  }
                : e.ebd_id
                  ? {
                      id: e.ebd_id,
                      site: e.ebd_site,
                      created_at: e.ebd_created_at,
                    }
                  : null,
    }));
  }

  /**
   * Get Patient ERM Detail
   * Retrieves specific ERM record details (polymorphic)
   */
  async getPatientERMDetail(
    patientId: string,
    appointmentId: string,
    ermId: string,
  ) {
    const appointment = await this.dataSource
      .getRepository(Appointment)
      .findOne({
        where: { _id: appointmentId, patientId, deletedAt: IsNull() },
        select: ['_id', 'status'],
      });

    if (!appointment) {
      throw new NotFoundException(
        MESSAGES.failMessage.appointmentNotFound ||
          'Appointment not found or access denied',
      );
    }

    const erm = await this.dataSource
      .createQueryBuilder()
      .select('e.*')
      .from('erms', 'e')
      .where('e._id = :ermId', { ermId })
      .andWhere('e.appointment_id = :appointmentId', { appointmentId })
      .andWhere('e.deleted_at IS NULL')
      .getRawOne();

    if (!erm) {
      throw new NotFoundException('ERM record not found');
    }

    if (erm.status !== 'COMPLETED') {
      throw new ForbiddenException(
        'ERM record is not available (status must be COMPLETED)',
      );
    }

    let relationTable = '';
    switch (erm.record_type) {
      case 'CONSULTATION':
        relationTable = 'erm_consultations';
        break;
      case 'XRAY':
        relationTable = 'erm_xrays';
        break;
      case 'LAB':
        relationTable = 'erm_labs';
        break;
      case 'ULTRASOUND':
        relationTable = 'erm_ultrasounds';
        break;
      case 'BONE_DENSITY':
        relationTable = 'erm_bone_density';
        break;
      case 'PROCEDURE':
        relationTable = 'erm_procedures';
        break;
      default:
        throw new NotFoundException('Unsupported ERM record type');
    }

    const childDetails = await this.dataSource
      .createQueryBuilder()
      .select('c.*')
      .from(relationTable, 'c')
      .where('c.erm_id = :ermId', { ermId })
      .andWhere('c.deleted_at IS NULL')
      .getRawOne();

    if (!childDetails) {
      throw new NotFoundException(
        `${erm.record_type} details not found for this ERM record`,
      );
    }

    return {
      _id: erm._id,
      appointment_id: erm.appointment_id,
      record_type: erm.record_type,
      status: erm.status,
      service_code: erm.service_code,
      created_at: erm.created_at,
      signed_at: erm.signed_at,
      details: childDetails,
    };
  }
}
