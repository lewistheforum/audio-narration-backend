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
import {
  AccountRole,
  AccountStatus,
  LegalDocumentVerificationStatus,
} from '../accounts/enums';
import { RegistrationStatus } from '../subscriptions/enums';
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
import { DataSource, Not, In } from 'typeorm';
import {
  getDateString,
  addToVietnamTime,
  getCurrentVietnamTime,
  parseVietnamTime,
  getStartOfVietnamDate,
  buildVietnamDateTime,
} from 'src/common/utils/date.util';

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
      patientAddress: patientAddress
        ? {
            id: patientAddress._id,
            address: patientAddress.address,
            ward: patientAddress.ward,
            wardName: patientAddress.wardName,
            district: patientAddress.district,
            districtName: patientAddress.districtName,
            province: patientAddress.province,
            provinceName: patientAddress.provinceName,
          }
        : null,
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
    const now = getCurrentVietnamTime();
    return schedules.map((schedule) => {
      const mapped = this.mapSingleSchedule(schedule, now);
      return {
        ...mapped,
        shift: mapped.shift ? [mapped.shift] : [],
      };
    });
  }

  /**
   * Map Schedules Plain Response
   *
   * internal helper to transform entity structure to DTO response format without shift details
   */
  private mapSchedulesPlain(schedules: any[]) {
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

  /**
   * Map Schedules Grouped Response
   *
   * groups schedules by employee and work date
   */
  private mapSchedulesGrouped(schedules: any[]) {
    const now = getCurrentVietnamTime();
    const mappedSchedules = schedules.map((s) =>
      this.mapSingleSchedule(s, now),
    );

    const grouped = new Map<string, any>();

    for (const item of mappedSchedules) {
      const key = `${item.employee.id}_${item.workDate}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          ...item,
          shift: item.shift ? [item.shift] : [],
          // Keep a list of schedule IDs if needed, otherwise item.id is the first one
          ids: [item.id],
        });
      } else {
        const existing = grouped.get(key);
        if (item.shift) {
          existing.shift.push(item.shift);
        }
        existing.ids.push(item.id);
      }
    }

    return Array.from(grouped.values()).map((item) => {
      // Sort shifts by their first hour's startHour
      item.shift.sort((a: any, b: any) => {
        const aStart = a.hours?.[0]?.startHour || '';
        const bStart = b.hours?.[0]?.startHour || '';
        return aStart.localeCompare(bStart);
      });

      // Simplify shift details for "overall" view: consolidate hours into a single range
      item.shift = item.shift.map((s: any) => {
        if (!s.hours || s.hours.length === 0) {
          return { name: s.name, hours: [] };
        }

        // hours are already sorted in mapSingleSchedule, but we'll be safe
        const sortedHours = [...s.hours].sort((a: any, b: any) =>
          a.startHour.localeCompare(b.startHour),
        );

        return {
          name: s.name,
          hours: [
            {
              startHour: sortedHours[0].startHour,
              endHour: sortedHours[sortedHours.length - 1].endHour,
            },
          ],
        };
      });

      return item;
    });
  }

  /**
   * Helper to map a single schedule entity to response format
   */
  private mapSingleSchedule(schedule: any, now: Date) {
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
      shift: schedule.clinicShift
        ? {
            id: schedule.clinicShift._id,
            name: schedule.clinicShift.shift,
            hours:
              schedule.clinicShift.hours
                ?.map((hour: any) => {
                  const slotEndTime = buildVietnamDateTime(
                    schedule.workDate,
                    hour.endHour,
                  );

                  return {
                    id: hour._id,
                    startHour: hour.startHour,
                    endHour: hour.endHour,
                    limit: hour.limit,
                    bookedCount: hour.bookedCount || 0,
                    isFull:
                      (hour.bookedCount || 0) >= hour.limit ||
                      now > slotEndTime,
                  };
                })
                .sort((a: any, b: any) =>
                  a.startHour.localeCompare(b.startHour),
                ) || [],
          }
        : null,
      room:
        schedule.rooms && schedule.rooms.length > 0
          ? {
              id: schedule.rooms[0]._id,
              name: schedule.rooms[0].roomName,
            }
          : null,
    };
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

    const welcomeMessageText = `Hello ${patientName ? patientName : 'patient'}, I am your Medicare AI assistant. How can I help you today?`;

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

    if (!clinicId) {
      throw new BadRequestException('Clinic ID is required');
    }

    // Show from tomorrow from current date to the future
    const tomorrowStr = getDateString(addToVietnamTime(1, 'day'));

    let searchDate = query.date;
    let searchFrom = query.from;
    let searchTo = query.to;

    if (searchDate) {
      // If user asks for a date in the past or today, we don't show it
      if (searchDate < tomorrowStr) {
        return [];
      }
    } else {
      // If no range is specified, default to showing from tomorrow
      if (!searchFrom || searchFrom < tomorrowStr) {
        searchFrom = tomorrowStr;
      }
    }

    return this.mapSchedulesPlain(
      await this.scheduleRepository.findSchedulesPlain(clinicId, {
        date: searchDate,
        from: searchFrom,
        to: searchTo,
        employeeId: filterEmployeeId,
        roomId: query.roomId,
        role: AccountRole.DOCTOR,
      }),
    );
  }

  async findClinicSchedulesShift(clinicId: string, user: any, query: any) {
    let filterEmployeeId = query.employeeId;

    if (!clinicId) {
      throw new BadRequestException('Clinic ID is required');
    }

    // Show from tomorrow from current date to the future
    const tomorrowStr = getDateString(addToVietnamTime(1, 'day'));

    let searchDate = query.date;
    let searchFrom = query.from;
    let searchTo = query.to;

    if (searchDate) {
      // If user asks for a date in the past or today, we don't show it
      if (searchDate < tomorrowStr) {
        return [];
      }
    } else {
      // If no range is specified, default to showing from tomorrow
      if (!searchFrom || searchFrom < tomorrowStr) {
        searchFrom = tomorrowStr;
      }
    }

    return this.mapSchedules(
      await this.scheduleRepository.findScheduleHours(clinicId, {
        date: searchDate,
        from: searchFrom,
        to: searchTo,
        employeeId: filterEmployeeId,
        roomId: query.roomId,
        shiftId: query.shiftId,
        role: AccountRole.DOCTOR,
      }),
    );
  }

  async findClinicSchedulesOverall(clinicId: string, user: any, query: any) {
    let filterEmployeeId = query.employeeId;

    if (!clinicId) {
      throw new BadRequestException('Clinic ID is required');
    }

    // Show from tomorrow from current date to the future
    const tomorrowStr = getDateString(addToVietnamTime(1, 'day'));

    let searchDate = query.date;
    let searchFrom = query.from;
    let searchTo = query.to;

    if (searchDate) {
      // If user asks for a date in the past or today, we don't show it
      if (searchDate < tomorrowStr) {
        return [];
      }
    } else {
      // If no range is specified, default to showing from tomorrow
      if (!searchFrom || searchFrom < tomorrowStr) {
        searchFrom = tomorrowStr;
      }
    }

    return this.mapSchedulesGrouped(
      await this.scheduleRepository.findScheduleHours(clinicId, {
        date: searchDate,
        from: searchFrom,
        to: searchTo,
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
   * OPTIMIZED: Uses single query with LEFT JOINs instead of N+1 Promise.all
   */
  async findAllClinicManagers() {
    const rawData = await this.dataSource.query(
      `
      SELECT 
        m._id as manager_id,
        m.email as email,
        m.username as username,
        cmi.full_name as full_name,
        cmi.clinic_branch_name as clinic_branch_name,
        cmi.profile_picture as profile_picture,
        ga.full_name as general_full_name,
        ga.profile_picture as general_profile_picture
      FROM accounts m
      INNER JOIN accounts p ON m.parent_id = p._id AND p.deleted_at IS NULL
      INNER JOIN clinic_subcriptions cs ON p._id = cs.clinic_id AND cs.deleted_at IS NULL
      INNER JOIN clinics_legal_documents ld ON m._id = ld.account_id AND ld.deleted_at IS NULL
      LEFT JOIN clinic_manager_information cmi ON cmi.account_id = m._id AND cmi.deleted_at IS NULL
      LEFT JOIN general_accounts ga ON ga.account_id = m._id AND ga.deleted_at IS NULL
      WHERE m.role = $1 AND m.status = $2 AND m.deleted_at IS NULL
      AND p.status = $2
      AND cs.subscription_status = $3
      AND ld.verification_status = $4
      ORDER BY cmi.full_name ASC
    `,
      [
        AccountRole.CLINIC_MANAGER,
        AccountStatus.ACTIVE,
        RegistrationStatus.ACTIVE,
        LegalDocumentVerificationStatus.APPROVED,
      ],
    );

    return rawData.map((row: Record<string, unknown>) => ({
      accountId: row.manager_id,
      email: row.email,
      username: row.username,
      fullName:
        row.full_name || row.general_full_name || row.email || 'Unknown',
      clinicBranchName: row.clinic_branch_name || '',
      profilePicture:
        row.profile_picture || row.general_profile_picture || null,
    }));
  }

  /**
   * Find Clinic Managers by Doctor Name
   *
   * Retrieves clinic managers whose doctors have names matching the search query.
   *
   * @param name - The doctor name to search for (partial match)
   */
  async findClinicManagersByDoctorName(name: string) {
    const rawData = await this.dataSource.query(
      `
      SELECT 
        m._id as manager_id,
        m.email as email,
        m.username as username,
        cmi.full_name as full_name,
        cmi.clinic_branch_name as clinic_branch_name,
        cmi.profile_picture as profile_picture,
        ga.full_name as general_full_name,
        ga.profile_picture as general_profile_picture,
        d._id as doctor_id,
        di.full_name as doctor_full_name,
        di.profile_picture as doctor_profile_picture
      FROM accounts d
      INNER JOIN doctor_information di ON di.account_id = d._id AND di.deleted_at IS NULL
      INNER JOIN accounts m ON d.parent_id = m._id AND m.deleted_at IS NULL
      INNER JOIN accounts p ON m.parent_id = p._id AND p.deleted_at IS NULL
      INNER JOIN clinic_subcriptions cs ON p._id = cs.clinic_id AND cs.deleted_at IS NULL
      INNER JOIN clinics_legal_documents ld ON m._id = ld.account_id AND ld.deleted_at IS NULL
      LEFT JOIN clinic_manager_information cmi ON cmi.account_id = m._id AND cmi.deleted_at IS NULL
      LEFT JOIN general_accounts ga ON ga.account_id = m._id AND ga.deleted_at IS NULL
      WHERE d.role = $1 AND d.status = $2 AND d.deleted_at IS NULL
      AND m.role = $3 AND m.status = $2
      AND p.status = $2
      AND cs.subscription_status = $4
      AND ld.verification_status = $5
      AND di.full_name ILIKE $6
      ORDER BY cmi.full_name ASC, di.full_name ASC
    `,
      [
        AccountRole.DOCTOR,
        AccountStatus.ACTIVE,
        AccountRole.CLINIC_MANAGER,
        RegistrationStatus.ACTIVE,
        LegalDocumentVerificationStatus.APPROVED,
        `%${name}%`,
      ],
    );

    return rawData.map((row: Record<string, unknown>) => ({
      accountId: row.manager_id,
      email: row.email,
      username: row.username,
      fullName:
        row.full_name || row.general_full_name || row.email || 'Unknown',
      clinicBranchName: row.clinic_branch_name || '',
      profilePicture:
        row.profile_picture || row.general_profile_picture || null,
      doctor: {
        accountId: row.doctor_id,
        fullName: row.doctor_full_name,
        profilePicture: row.doctor_profile_picture || null,
      },
    }));
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
   * OPTIMIZED: Uses single query with LEFT JOINs instead of N+1 Promise.all
   *
   * @param date - The work date to search for
   * @returns List of clinic managers
   */
  async findManagersByWorkDate(date: string) {
    const rawData = await this.dataSource.query(
      `
      SELECT DISTINCT 
        m._id as manager_id,
        m.email as email,
        m.username as username,
        cmi.full_name as full_name,
        cmi.clinic_branch_name as clinic_branch_name,
        cmi.profile_picture as profile_picture,
        ga.full_name as general_full_name,
        ga.profile_picture as general_profile_picture
      FROM accounts m
      INNER JOIN employee_schedule es ON es.clinic_id = m._id AND es.deleted_at IS NULL
      INNER JOIN accounts p ON m.parent_id = p._id AND p.deleted_at IS NULL
      INNER JOIN clinic_subcriptions cs ON p._id = cs.clinic_id AND cs.deleted_at IS NULL
      INNER JOIN clinics_legal_documents ld ON m._id = ld.account_id AND ld.deleted_at IS NULL
      LEFT JOIN clinic_manager_information cmi ON cmi.account_id = m._id AND cmi.deleted_at IS NULL
      LEFT JOIN general_accounts ga ON ga.account_id = m._id AND ga.deleted_at IS NULL
      WHERE m.role = $1 AND m.status = $2 AND m.deleted_at IS NULL
      AND es.work_date = $3
      AND p.status = $4
      AND cs.subscription_status = $5
      AND ld.verification_status = $6
      ORDER BY cmi.full_name ASC
    `,
      [
        AccountRole.CLINIC_MANAGER,
        AccountStatus.ACTIVE,
        date,
        AccountStatus.ACTIVE,
        RegistrationStatus.ACTIVE,
        LegalDocumentVerificationStatus.APPROVED,
      ],
    );

    return rawData.map((row: Record<string, unknown>) => ({
      accountId: row.manager_id,
      email: row.email,
      username: row.username,
      fullName:
        row.full_name || row.general_full_name || row.email || 'Unknown',
      clinicBranchName: row.clinic_branch_name || '',
      profilePicture:
        row.profile_picture || row.general_profile_picture || null,
    }));
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

    // Convert date strings to Date objects using Vietnam timezone.
    // The AI might send UTC strings (e.g., "2026-04-10T17:00:00.000Z") intending them as local time.
    // We strip the timezone identifier to ensure it's evaluated strictly as Vietnam time.
    const appointmentDate = getStartOfVietnamDate(createDto.appointmentDate);
    const appointmentHourStr = createDto.appointmentHour.replace(
      /(Z|[+-]\d{2}:\d{2})$/i,
      '',
    );
    const appointmentHour = parseVietnamTime(appointmentHourStr);
    const extraHour = createDto.extraHour
      ? parseVietnamTime(
          createDto.extraHour.replace(/(Z|[+-]\d{2}:\d{2})$/i, ''),
        )
      : null;

    // Check if user already has an active appointment on this date
    const existingAppointments = await this.appointmentRepository.find({
      patientId: createDto.patientId,
      appointmentDate,
      status: Not(
        In([
          AppointmentStatus.COMPLETED,
          AppointmentStatus.CANCELLED,
          AppointmentStatus.ABSENT,
        ]),
      ),
    });

    if (existingAppointments.length > 0) {
      throw new ConflictException(
        'You already have an appointment need to process in this day. Please book appointment on another day.',
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
      // Note: We use unique serviceIds check in case of duplicates in input
      const uniqueServiceIdsCount = new Set(serviceIds).size;
      if (serviceConfigs.length < uniqueServiceIdsCount) {
        throw new BadRequestException(
          `One or more services not found or inactive for this clinic. Expected ${uniqueServiceIdsCount} unique services, found ${serviceConfigs.length}`,
        );
      }

      // Create Map: clinicServiceId (either configId or master serviceId) -> { id, price, discount }
      const serviceConfigLookupMap = new Map();
      serviceConfigs.forEach((config) => {
        const configData = {
          id: config.id, // The UUID from clinic_service_config
          price: parseFloat(config.price) || 0,
          discount: parseFloat(config.discount || 0) || 0,
        };
        serviceConfigLookupMap.set(config.id, configData);
        // Postgres lowercases unquoted aliases, so we check for both
        serviceConfigLookupMap.set(
          config.serviceId || config.serviceid,
          configData,
        );
      });

      // Calculate package amount from services (price - discount)
      const packageAmount = serviceConfigs.reduce((sum, config) => {
        const price = parseFloat(config.price) || 0;
        const discount = parseFloat(config.discount || 0) || 0;
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
          'clinicService._id AS "id"',
          'clinicService.service_name AS "serviceName"',
          'clinicService.description AS "description"',
          'serviceAppointment.price AS "price"',
          'serviceAppointment.discount AS "discount"',
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
        serviceName: row.serviceName,
        description: row.description,
        price: parseFloat(row.price) || 0,
        discount: row.discount ? parseFloat(row.discount) : 0,
      }));

      // Fetch clinic rooms if doctor shift is assigned
      let clinicRooms = [];

      if (savedAppointment.clinicShiftHourId && savedAppointment.doctorId) {
        // Query clinic rooms directly without needing appointment_id
        const roomsResult = await manager
          .createQueryBuilder()
          .select('cr._id', 'id')
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
          id: row.id || row.roomId,
          roomName: row.roomName || row.roomname,
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
