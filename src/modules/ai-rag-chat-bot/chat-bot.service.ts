import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AiConversationRepository } from './repositories/ai-conversation.repository';
import { CreateAiConversationDto } from './dto/create-conversation.dto';
import { AiConversation } from './entities/ai-conversation.entity';
import { AiMessage } from './entities/ai-message.entity';
import { AiMessageRepository } from './repositories/ai-message.repository';
import { AccountsService } from '../accounts/accounts.service';
import { AccountRole, AccountStatus } from '../accounts/enums';
import { EmployeeScheduleRepository } from './repositories/employee-schedule.repository';
import { ClinicServicesService } from '../clinic-services/clinic-services.service';
import { AiCreateAppointmentDto } from './dto/ai-create-appointment.dto';
import { AppointmentResponseDto } from '../appointments/dto';
import { AppointmentRepository } from '../appointments/repositories';
import { AccountRepository } from '../accounts/repositories';
import { MESSAGES } from 'src/common/message';
import {
  AppointmentPackageStatus,
  AppointmentStatus,
  PaymentType,
} from '../appointments/enums';
import {
  Appointment,
  AppointmentPackage,
  ServiceAppointment,
} from '../appointments/entities';
import { DataSource } from 'typeorm';

@Injectable()
export class AiRagChatBotService {
  constructor(
    private readonly aiConversationRepository: AiConversationRepository,
    private readonly aiMessageRepository: AiMessageRepository,
    private readonly accountsService: AccountsService,
    private readonly scheduleRepository: EmployeeScheduleRepository,
    private readonly clinicServicesService: ClinicServicesService,
    private readonly appointmentRepository: AppointmentRepository,
    private readonly accountRepository: AccountRepository,
    private readonly dataSource: DataSource,
  ) {}

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

    // Get patient address
    const patientAddress = appointment.patient?.address;

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
      patientAddress: patientAddress ? {
        id: patientAddress._id,
        address: patientAddress.address,
        ward: patientAddress.ward,
        wardName: patientAddress.wardName,
        district: patientAddress.district,
        districtName: patientAddress.districtName,
        province: patientAddress.province,
        provinceName: patientAddress.provinceName,
      } : null,
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
   * Map Schedules Response
   *
   * internal helper to transform entity structure to DTO response format
   */
 private mapSchedules(schedules: any[]) {
    const now = new Date();
    return schedules.map((schedule) => {
      const emp: any = schedule.employee;
      const doctorInfo = emp?.doctorInformation;

      return {
        id: schedule._id,
        workDate: schedule.workDate,
        weekDay: schedule.weekDay,
        employee: {
          id: emp?._id,
          fullName: doctorInfo?.fullName || emp?.username || 'Unknown',
          avatar: doctorInfo?.profilePicture || null,
        },
        shift: {
          id: schedule.clinicShift?._id,
          name: schedule.clinicShift?.shift,
          hours:
            schedule.clinicShift?.hours
              ?.map((hour: any) => {
                const [endH, endM] = hour.endHour.split(':').map(Number);
                const slotEndTime = new Date(schedule.workDate);
                slotEndTime.setHours(endH, endM, 0, 0);

                return {
                  id: hour._id,
                  startHour: hour.startHour,
                  endHour: hour.endHour,
                  limit: hour.limit,
                  bookedCount: hour.bookedCount || 0,
                  isFull:
                    (hour.bookedCount || 0) >= hour.limit || now > slotEndTime,
                };
              })
              .sort((a, b) => a.startHour.localeCompare(b.startHour)) || [],
        },
        room:
          schedule.rooms && schedule.rooms.length > 0
            ? {
                id: schedule.rooms[0]._id,
                name: schedule.rooms[0].roomName,
              }
            : null,
      };
    });
  }

  async createConversation(
    userId: string,
    createAiConversationDto: CreateAiConversationDto,
  ): Promise<AiConversation> {
    const conversation = await this.aiConversationRepository.createConversation(
      userId,
      createAiConversationDto,
    );

    // After creating a conversation, automatically create a welcome message
    let patientName = '';

    if (userId) {
      try {
        const accountInfo = await this.accountsService.findOne(userId);
        const accountData: any = accountInfo;
        if (accountData.patientProfile && accountData.patientProfile.fullName) {
          patientName = accountData.patientProfile.fullName;
        } else if (
          accountData.generalAccount &&
          accountData.generalAccount.fullName
        ) {
          patientName = accountData.generalAccount.fullName;
        } else {
          patientName = accountInfo.username || '';
        }
      } catch (error) {
        console.error('Failed to fetch user name for welcome message', error);
      }
    }

    const welcomeMessageText = `Hello ${patientName ? patientName : 'patient'}, I am your Bonix AI assistant. How can I help you today?`;

    await this.aiMessageRepository.createMessage({
      conversationId: conversation._id,
      senderId: null, // null implies assistant
      role: 'assistant',
      content: welcomeMessageText,
      metadata: {
        type: 'welcome',
      },
    });

    return conversation;
  }

  async getMessagesByConversationIdAndUserId(
    conversationId: string,
    userId: string,
  ): Promise<AiMessage[]> {
    return this.aiMessageRepository.findMessagesByConversationAndUser(
      conversationId,
      userId,
    );
  }

  /**
   * Find All Schedules of Clinic (Role-based)
   *
   * Retrieves schedules based on the requester's role and query filters.
   * - Managers: View all schedules for their clinic.
   * - Doctors/Staff: View all schedules for their clinic (Staff) or only their own (Doctor).
   *
   * @param user - Create object comprising role and ID
   * @param query - Filter parameters (date, range, etc.)
   * @returns Filtered and mapped list of schedules
   */
  async findClinicSchedules(clinicId: string, user: any, query: any) {
    let filterEmployeeId = query.employeeId;

    // If Doctor, restrict to own schedule
    // if (user.role === AccountRole.DOCTOR) {
    //   filterEmployeeId = user._id;
    // }

    if (!clinicId) {
      throw new BadRequestException('Clinic ID is required');
    }

    return this.mapSchedules(
      await this.scheduleRepository.findScheduleHours(clinicId, {
        date: query.date,
        from: query.from,
        to: query.to,
        employeeId: filterEmployeeId,
        roomId: query.roomId,
        shiftId: query.shiftId,
        role: AccountRole.DOCTOR,
      }),
    );
  }

  /**
   * Find All Clinic Managers
   *
   * Retrieves all active clinic manager accounts.
   */
  async findAllClinicManagers() {
    const [accounts] = await this.accountsService.findByRoleAndStatus(
      AccountRole.CLINIC_MANAGER,
      AccountStatus.ACTIVE,
      0,
      1000, // Fetch a large enough number to get "all"
    );

    // Map to simple response format if needed, or return AccountResponseDto
    return Promise.all(
      accounts.map(async (account) => {
        const generalAccount =
          await this.accountsService.findGeneralAccountByUserId(account._id);
        const managerInfo =
          await this.accountsService.getAccountInformationByRole(account._id);
        return managerInfo;
      }),
    );
  }

  /**
   * Get Clinic Services By Manager ID
   *
   * Retrieves all services configured for a specific clinic manager.
   *
   * @param managerId - ID of the clinic manager
   * @returns List of services with their configs
   */
  async getClinicServicesByManagerId(managerId: string) {
    return this.clinicServicesService.getServicesByManager(managerId);
  }

  /**
   * Find Clinic Managers by Work Date
   *
   * Retrieves all clinic managers who have schedules on a specific date.
   *
   * @param date - The work date to search for
   * @returns List of clinic managers
   */
  async findManagersByWorkDate(date: string) {
    const schedules = await this.scheduleRepository.find({
      where: { workDate: new Date(date) },
      select: ['clinicId'],
    });

    const clinicIds = [...new Set(schedules.map((s) => s.clinicId))];

    if (clinicIds.length === 0) {
      return [];
    }

    return Promise.all(
      clinicIds.map(async (id) => {
        return this.accountsService.getAccountInformationByRole(id);
      }),
    );
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
  async aiCreateAppointment(
    createDto: AiCreateAppointmentDto,
  ): Promise<AppointmentResponseDto> {
    // Get staff account to verify clinic access
    // const staffAccount =
    //   await this.accountRepository.findAccountById(staffAccountId);

    // if (
    //   !staffAccount ||
    //   staffAccount.role !== AccountRole.CLINIC_STAFF ||
    //   !staffAccount.parentId
    // ) {
    //   throw new NotFoundException(MESSAGES.failMessage.accountNotFound);
    // }

    const clinicId = createDto.clinicId;

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
          'Thß╗¥i gian hß║╣n n├áy ─æ├ú c├│ ng╞░ß╗¥i ─æß║╖t. Vui l├▓ng chß╗ìn thß╗¥i gian kh├íc.',
      );
    }

    // Execute transaction to create appointment + package + services
    return await this.dataSource.transaction(async (manager) => {
      // Query service prices and discounts from clinic_service_config
      const serviceIds = createDto.services.map((s) => s.clinicServiceId);

      const serviceConfigs = await manager
        .createQueryBuilder()
        .select('config._id', 'id')
        .addSelect('config.service_id', 'serviceId')
        .addSelect('config.price', 'price')
        .addSelect('config.discount', 'discount')
        .from('clinic_service_config', 'config')
        .where(
          '(config._id IN (:...serviceIds) OR config.service_id IN (:...serviceIds))',
          { serviceIds },
        )
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

      // Create Map: clinicServiceId (either configId or master serviceId) -> { id, price, discount }
      const serviceConfigLookupMap = new Map();
      serviceConfigs.forEach((config) => {
        const configData = {
          id: config.id, // The UUID from clinic_service_config
          price: parseFloat(config.price),
          discount: parseFloat(config.discount || 0),
        };
        serviceConfigLookupMap.set(config.id, configData);
        serviceConfigLookupMap.set(config.serviceId, configData);
      });

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
        const config = serviceConfigLookupMap.get(service.clinicServiceId);
        return manager.create(ServiceAppointment, {
          clinicServiceId: config?.id || service.clinicServiceId,
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
          'patient.address',
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
