import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  addToVietnamTime,
  getStartOfDay,
  getDateString,
  getCurrentVietnamTime,
  formatToDateOnly,
  formatToTimeOnly,
} from 'src/common/utils/date.util';
import { EmployeeSchedule } from './entities/employee-schedule.entity';
import { ClinicShift } from './entities/clinic-shift.entity';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { CopyScheduleDto } from './dto/copy-schedule.dto';
import { CreateClinicRoomDto } from './dto/create-clinic-room.dto';
import { UpdateClinicRoomDto } from './dto/update-clinic-room.dto';
import { ClinicRoomQueryDto } from './dto/clinic-room-query.dto';
import { WeekDay } from './enums';
import { ClinicRoom } from './entities/clinic_room.entity';
import { Account } from '../accounts/entities/accounts.entity';
import { DoctorInformation } from '../accounts/entities/doctor_information.entity';
import { GeneralAccount } from '../accounts/entities/general_accounts.entity';
import { ClinicStaffInformation } from '../accounts/entities/clinic_staff_information.entity';
import { AccountRole } from '../accounts/enums/account-role.enum';
import { EmployeeScheduleRepository } from './repositories/employee-schedule.repository';
import { AppointmentStatus } from '../appointments/enums';

@Injectable()
export class SchedulesService {
  constructor(
    private readonly scheduleRepository: EmployeeScheduleRepository,
    @InjectRepository(ClinicShift)
    private readonly shiftRepository: Repository<ClinicShift>,
    @InjectRepository(ClinicRoom)
    private readonly roomRepository: Repository<ClinicRoom>,
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    @InjectRepository(DoctorInformation)
    private readonly doctorInfoRepository: Repository<DoctorInformation>,
    @InjectRepository(GeneralAccount)
    private readonly generalAccountRepository: Repository<GeneralAccount>,
    @InjectRepository(ClinicStaffInformation)
    private readonly clinicStaffRepository: Repository<ClinicStaffInformation>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Get Clinic Employees (Doctors & Staff)
   *
   * Retrieves list of employees belonging to a clinic.
   * Resolves clinicId from User context.
   * Supports filtering by search term.
   *
   * @param user - User context
   * @param search - Optional search term
   */
  async getEmployees(user: any, search?: string) {
    const clinicId = await this.resolveClinicId(user);
    if (!clinicId) return [];

    let targetManagerId: string;

    // Find Manager to find employees
    const manager = await this.accountRepository.findOne({
      where: {
        parentId: clinicId,
        role: AccountRole.CLINIC_MANAGER,
      },
    });

    if (manager) {
      targetManagerId = manager._id;
    } else {
      const acc = await this.accountRepository.findOne({
        where: { _id: clinicId },
      });
      if (acc && acc.role === AccountRole.CLINIC_MANAGER) {
        targetManagerId = clinicId;
      } else {
        return [];
      }
    }

    const employees = await this.accountRepository
      .createQueryBuilder('account')
      .select(['account._id', 'account.username', 'account.role'])
      .where('account.parent_id = :parentId', { parentId: targetManagerId })
      .andWhere('account.role = ANY(:roles)', {
        roles: [AccountRole.DOCTOR, AccountRole.CLINIC_STAFF],
      })
      .getMany();

    if (!employees.length) return [];

    // Manual Fetch DoctorInformation, GeneralAccount, and ClinicStaffInformation
    const employeeIds = employees.map((e) => e._id);
    const [doctorInfos, generalAccounts, staffInfos] = await Promise.all([
      this.doctorInfoRepository
        .createQueryBuilder('di')
        .where('di.account_id = ANY(:accountIds)', { accountIds: employeeIds })
        .getMany(),
      this.generalAccountRepository
        .createQueryBuilder('ga')
        .where('ga.account_id = ANY(:accountIds)', { accountIds: employeeIds })
        .getMany(),
      this.clinicStaffRepository
        .createQueryBuilder('csi')
        .where('csi.account_id = ANY(:accountIds)', { accountIds: employeeIds })
        .getMany(),
    ]);

    // Create Maps for quick lookup
    const doctorInfoMap = new Map<string, DoctorInformation>();
    doctorInfos.forEach((info) => {
      doctorInfoMap.set(info.accountId, info);
    });

    const generalAccountMap = new Map<string, GeneralAccount>();
    generalAccounts.forEach((acc) => {
      generalAccountMap.set(acc.accountId, acc);
    });

    const staffInfoMap = new Map<string, ClinicStaffInformation>();
    staffInfos.forEach((info) => {
      staffInfoMap.set(info.accountId, info);
    });

    let results = employees.map((emp) => {
      const doctorInfo = doctorInfoMap.get(emp._id);
      const generalAccount = generalAccountMap.get(emp._id);
      const staffInfo = staffInfoMap.get(emp._id);

      // Rule:
      // For DOCTOR: fullName from doctorInfo
      // For CLINIC_STAFF: fullName from staffInfo (ClinicStaffInformation)
      let fullName = emp.username || 'Unknown';
      if (emp.role === AccountRole.DOCTOR && doctorInfo?.fullName) {
        fullName = doctorInfo.fullName;
      } else if (emp.role === AccountRole.CLINIC_STAFF && staffInfo?.fullName) {
        fullName = staffInfo.fullName;
      } else if (generalAccount?.fullName) {
        fullName = generalAccount.fullName;
      }

      return {
        id: emp._id,
        name: fullName,
        role: emp.role,
        username: emp.username,
        profilePicture:
          emp.role === AccountRole.DOCTOR
            ? doctorInfo?.profilePicture
            : staffInfo?.profilePicture ||
              generalAccount?.profilePicture ||
              null,
      };
    });

    if (search) {
      const searchLower = search.toLowerCase();
      results = results.filter(
        (e) =>
          (e.name && e.name.toLowerCase().includes(searchLower)) ||
          (e.username && e.username.toLowerCase().includes(searchLower)),
      );
    }

    return results;
  }

  /**
   * Get Clinic Employees (Legal Docs Required for Doctors)
   *
   * Similar to getEmployees but filters Doctors to only include those who have
   * provided all required legal documents.
   */
  async getEmployeesLegal(user: any, search?: string) {
    const clinicId = await this.resolveClinicId(user);
    if (!clinicId)
      return [];

    let targetManagerId: string;

    const manager = await this.accountRepository.findOne({
      where: {
        parentId: clinicId,
        role: AccountRole.CLINIC_MANAGER,
      },
    });

    if (manager) {
      targetManagerId = manager._id;
    } else {
      const acc = await this.accountRepository.findOne({
        where: { _id: clinicId },
      });
      if (acc && acc.role === AccountRole.CLINIC_MANAGER) {
        targetManagerId = clinicId;
      } else {
        return [];
      }
    }

    const employees = await this.accountRepository
      .createQueryBuilder('account')
      .select(['account._id', 'account.username', 'account.role'])
      .where('account.parent_id = :parentId', { parentId: targetManagerId })
      .andWhere('account.role = ANY(:roles)', {
        roles: [AccountRole.DOCTOR, AccountRole.CLINIC_STAFF],
      })
      .getMany();

    if (!employees.length)
      return [];

    const employeeIds = employees.map((e) => e._id);
    const [doctorInfos, generalAccounts, staffInfos] = await Promise.all([
      this.doctorInfoRepository
        .createQueryBuilder('di')
        .where('di.account_id = ANY(:accountIds)', { accountIds: employeeIds })
        .getMany(),
      this.generalAccountRepository
        .createQueryBuilder('ga')
        .where('ga.account_id = ANY(:accountIds)', { accountIds: employeeIds })
        .getMany(),
      this.clinicStaffRepository
        .createQueryBuilder('csi')
        .where('csi.account_id = ANY(:accountIds)', { accountIds: employeeIds })
        .getMany(),
    ]);

    const doctorInfoMap = new Map<string, DoctorInformation>();
    doctorInfos.forEach((info) => {
      doctorInfoMap.set(info.accountId, info);
    });

    const generalAccountMap = new Map<string, GeneralAccount>();
    generalAccounts.forEach((acc) => {
      generalAccountMap.set(acc.accountId, acc);
    });

    const staffInfoMap = new Map<string, ClinicStaffInformation>();
    staffInfos.forEach((info) => {
      staffInfoMap.set(info.accountId, info);
    });

    let results = employees.map((emp) => {
      const doctorInfo = doctorInfoMap.get(emp._id);
      const generalAccount = generalAccountMap.get(emp._id);
      const staffInfo = staffInfoMap.get(emp._id);

      // Special Filtering Rule for DOCTOR: Must have all 3 legal docs
      if (emp.role === AccountRole.DOCTOR) {
        if (
          !doctorInfo ||
          !doctorInfo.medicalLicense ||
          !doctorInfo.professionalLicense ||
          !doctorInfo.certificatePracticalTraining
        ) {
          return null; // Filter out doctors with incomplete docs
        }
      }

      let fullName = emp.username || 'Unknown';
      if (emp.role === AccountRole.DOCTOR && doctorInfo?.fullName) {
        fullName = doctorInfo.fullName;
      } else if (emp.role === AccountRole.CLINIC_STAFF && staffInfo?.fullName) {
        fullName = staffInfo.fullName;
      } else if (generalAccount?.fullName) {
        fullName = generalAccount.fullName;
      }

      return {
        id: emp._id,
        name: fullName,
        role: emp.role,
        username: emp.username,
        profilePicture:
          emp.role === AccountRole.DOCTOR
            ? doctorInfo?.profilePicture
            : staffInfo?.profilePicture ||
              generalAccount?.profilePicture ||
              null,
      };
    }).filter(e => e !== null);

    if (search) {
      const searchLower = search.toLowerCase();
      results = results.filter(
        (e) =>
          (e.name && e.name.toLowerCase().includes(searchLower)) ||
          (e.username && e.username.toLowerCase().includes(searchLower)),
      );
    }

    return results;
  }

  /**
   * Copy Schedule (List Based)
   *
   * Copies schedules from a list of source dates to a target start date.
   * Maps source dates consecutively to target dates.
   * Skips duplicates/conflicts.
   *
   * @param user - Request user (manager)
   * @param copyScheduleDto - Source dates and target date
   */
  async copySchedule(user: any, copyScheduleDto: CopyScheduleDto) {
    const { fromDates, targetDate } = copyScheduleDto;
    const clinicId = await this.resolveClinicId(user);

    if (!clinicId) throw new BadRequestException('Clinic ID is required');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let copiedCount = 0;
    let skippedCount = 0;

    try {
      const targetStartDateObj = getStartOfDay(targetDate);

      // Iterate through each source date
      for (let i = 0; i < fromDates.length; i++) {
        const sourceDateStr = fromDates[i];
        const sourceDateObj = getStartOfDay(sourceDateStr);

        // Calculate target date for this index (Consecutive)
        const currentTargetDate = new Date(targetStartDateObj);
        currentTargetDate.setDate(targetStartDateObj.getDate() + i);

        // Get source schedules
        const sourceSchedules = await this.scheduleRepository.find({
          where: {
            clinicId,
            workDate: sourceDateObj,
          },
          relations: ['clinicShift', 'rooms', 'employee'],
        });

        if (sourceSchedules.length === 0) continue;

        // WeekDay calculation for target
        const dayOfWeek = currentTargetDate.getDay();
        const weekDayMap = [
          WeekDay.SUNDAY,
          WeekDay.MONDAY,
          WeekDay.TUESDAY,
          WeekDay.WEDNESDAY,
          WeekDay.THURSDAY,
          WeekDay.FRIDAY,
          WeekDay.SATURDAY,
        ];
        const weekDay = weekDayMap[dayOfWeek];

        for (const schedule of sourceSchedules) {
          // Check conflict in target
          const conflict = await this.scheduleRepository.findConflict(
            schedule.employeeId,
            currentTargetDate,
            schedule.clinicShiftId,
          );

          if (conflict) {
            skippedCount++;
            continue;
          }

                    // Check room conflict in target
          if (schedule.rooms && schedule.rooms.length > 0) {
            const roomConflict = await this.scheduleRepository.findRoomConflict(
              schedule.rooms[0]._id,
              currentTargetDate,
              schedule.clinicShiftId,
              schedule.employee?.role,
            );

            if (roomConflict) {
              skippedCount++;
              continue;
            }
          }

          // Clone
          const newSchedule = queryRunner.manager.create(EmployeeSchedule, {
            ...schedule,
            _id: undefined, // ensure new ID
            workDate: currentTargetDate,
            weekDay: weekDay,
            createdAt: undefined,
            updatedAt: undefined,
          });

          await queryRunner.manager.save(newSchedule);
          copiedCount++;
        }
      }

      await queryRunner.commitTransaction();
      return {
        message: 'Copy completed',
        copied: copiedCount,
        skipped: skippedCount,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Create Schedules (Bulk)
   *
   * Creates multiple schedule entries for an employee at a specific clinic.
   * Manages validations for employee, clinic, shift, and room existence.
   * Checks for potential schedule conflicts before creation.
   *
   * @param clinicId - ID of the clinic
   * @param createScheduleDto - Data transfer object containing schedule details
   * @returns Array of created EmployeeSchedule entities
   * @throws NotFoundException if related entities exist
   * @throws ConflictException if schedule overlap occurs
   */
  async create(clinicId: string, createScheduleDto: CreateScheduleDto) {
    const { employeeId, items } = createScheduleDto;

    if (!clinicId) throw new BadRequestException('Clinic ID is required');

    const employee = await this.accountRepository.findOne({
      where: { _id: employeeId },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const clinic = await this.accountRepository.findOne({
      where: { _id: clinicId },
    });
    if (!clinic) throw new NotFoundException('Clinic not found');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const createdSchedules = [];

      for (const item of items) {
        const { clinicShiftId, workDate, roomId } = item;
        const workDateObj = getStartOfDay(workDate);

        // WeekDay calculation
        const dayOfWeek = workDateObj.getDay();
        const weekDayMap = [
          WeekDay.SUNDAY,
          WeekDay.MONDAY,
          WeekDay.TUESDAY,
          WeekDay.WEDNESDAY,
          WeekDay.THURSDAY,
          WeekDay.FRIDAY,
          WeekDay.SATURDAY,
        ];
        const weekDay = weekDayMap[dayOfWeek];

        // Validate Shift
        const shift = await this.shiftRepository.findOne({
          where: { _id: clinicShiftId, clinicId },
        });
        if (!shift)
          throw new NotFoundException(`Shift ${clinicShiftId} not found`);

        // Validate Room
        let room = null;
        if (roomId) {
          room = await this.roomRepository.findOne({
            where: { _id: roomId, clinicId },
          });
          if (!room) throw new NotFoundException(`Room ${roomId} not found`);
        }

        // Conflict Check using Repository
        const conflict = await this.scheduleRepository.findConflict(
          employeeId,
          workDateObj,
          clinicShiftId,
        );

        if (conflict) {
          throw new ConflictException(
            `Schedule exists for Employee ${employeeId} on ${workDate} for Shift ${clinicShiftId}`,
          );
        }

                // Room Occupancy Check
        if (roomId) {
          const roomConflict = await this.scheduleRepository.findRoomConflict(
            roomId,
            workDateObj,
            clinicShiftId,
            employee.role,
          );

          if (roomConflict) {
            throw new ConflictException(
              `Room ${roomId} is already assigned to another doctor on ${workDate} for Shift ${clinicShiftId}`,
            );
          }
        }

        // Create
        const newSchedule = queryRunner.manager.create(EmployeeSchedule, {
          clinicId,
          employeeId,
          clinicShiftId,
          workDate: workDateObj,
          weekDay,
          rooms: room ? [room] : [], // Assign relation
        });

        const saved = await queryRunner.manager.save(newSchedule);
        createdSchedules.push(saved);
      }

      await queryRunner.commitTransaction();
      return createdSchedules;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Helper to resolve Clinic ID from User Context
   */
  private async resolveClinicId(user: any): Promise<string | null> {
    if (user.role === AccountRole.CLINIC_MANAGER) {
      return user._id; // Manager IS the clinic branch
    }

    if (
      user.role === AccountRole.DOCTOR ||
      user.role === AccountRole.CLINIC_STAFF
    ) {
      // Doctor/Staff's parentId = CLINIC_MANAGER._id (the branch they belong to)
      if (user.parentId) {
        return user.parentId;
      }
    }
    return null;
  }

  /**
   * Find All Schedules (Role-based)
   *
   * Retrieves schedules based on the requester's role and query filters.
   * - Managers: View all schedules for their clinic.
   * - Doctors/Staff: View all schedules for their clinic (Staff) or only their own (Doctor).
   *
   * @param user - Create object comprising role and ID
   * @param query - Filter parameters (date, range, etc.)
   * @returns Filtered and mapped list of schedules
   */
  async findAll(user: any, query: any) {
    let clinicId = query.clinicId;
    let filterEmployeeId = query.employeeId;

    // Auto-resolve Clinic ID if not provided (or enforce it)
    const resolvedClinicId = await this.resolveClinicId(user);
    if (resolvedClinicId) {
      clinicId = resolvedClinicId;
    }

    // If Doctor, restrict to own schedule
    if (user.role === AccountRole.DOCTOR) {
      filterEmployeeId = user._id;
    }

    if (!clinicId) {
      // Fallback or Error? Ideally fallback to query param if user is Admin (not handled yet)
    }

    return this.mapSchedules(
      await this.scheduleRepository.findSchedules(clinicId, {
        date: query.date,
        from: query.from,
        to: query.to,
        employeeId: filterEmployeeId,
        roomId: query.roomId,
        shiftId: query.shiftId,
      }),
    );
  }

  /**
   * Find All Schedules of Doctor in Clinic (Role-based)
   *
   * Retrieves schedules based on the requester's role and query filters.
   * - Managers: View all schedules for their clinic.
   * - Doctors/Staff: View all schedules for their clinic (Staff) or only their own (Doctor).
   *
   * @param user - Create object comprising role and ID
   * @param query - Filter parameters (date, range, etc.)
   * @returns Filtered and mapped list of schedules
   */
  async findDoctorSchedulesByClinic(clinicId: string, user: any, query: any) {
    let filterEmployeeId = query.employeeId;

    // Auto-resolve Clinic ID if not provided (or enforce it)
    const resolvedClinicId = await this.resolveClinicId(user);
    if (resolvedClinicId && resolvedClinicId !== clinicId) {
      throw new ForbiddenException('Access denied to this clinic schedules');
    }

    // If Doctor, restrict to own schedule
    if (user.role === AccountRole.DOCTOR) {
      filterEmployeeId = user._id;
    }

    if (!clinicId) {
      throw new BadRequestException('Clinic ID is required');
    }

    return this.mapSchedules(
      await this.scheduleRepository.findSchedules(clinicId, {
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
   * Find All Schedules of Doctor in Clinic (Role-based)
   *
   * Retrieves schedules based on the requester's role and query filters.
   * - Managers: View all schedules for their clinic.
   * - Doctors/Staff: View all schedules for their clinic (Staff) or only their own (Doctor).
   *
   * @param user - Create object comprising role and ID
   * @param query - Filter parameters (date, range, etc.)
   * @returns Filtered and mapped list of schedules
   */
  async findDoctorScheduleHoursByClinic(
    clinicId: string,
    user: any,
    query: any,
  ) {
    let filterEmployeeId = query.employeeId;

    // Auto-resolve Clinic ID if not provided (or enforce it)
    const resolvedClinicId = await this.resolveClinicId(user);
    if (resolvedClinicId && resolvedClinicId !== clinicId) {
      throw new ForbiddenException('Access denied to this clinic schedules');
    }

    // If Doctor, restrict to own schedule
    if (user.role === AccountRole.DOCTOR) {
      filterEmployeeId = user._id;
    }

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

    // Auto-resolve Clinic ID if not provided (or enforce it)
    const resolvedClinicId = await this.resolveClinicId(user);
    if (resolvedClinicId && resolvedClinicId !== clinicId) {
      throw new ForbiddenException('Access denied to this clinic schedules');
    }

    // If Doctor, restrict to own schedule
    if (user.role === AccountRole.DOCTOR) {
      filterEmployeeId = user._id;
    }

    if (!clinicId) {
      throw new BadRequestException('Clinic ID is required');
    }

    return this.mapSchedules(
      await this.scheduleRepository.findSchedules(clinicId, {
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
   * Map Schedules Response
   *
   * internal helper to transform entity structure to DTO response format
   */
  private mapSchedules(schedules: any[]) {
    const now = getCurrentVietnamTime();
    const nowDateStr = formatToDateOnly();
    const nowTimeStr = formatToTimeOnly();

    return schedules.map((schedule) => {
      const scheduleDateStr = formatToDateOnly(schedule.workDate);
      const isPastDate = scheduleDateStr < nowDateStr;
      const isToday = scheduleDateStr === nowDateStr;

      const emp: any = schedule.employee;
      const doctorInfo = emp?.doctorInformation;
      const staffInfo = emp?.clinicStaffInformation;
      const generalAccount = emp?.generalAccount;

      // Rule:
      // For DOCTOR: fullName from doctorInfo
      // For CLINIC_STAFF: fullName from staffInfo (ClinicStaffInformation)
      let fullName = emp?.username || 'Unknown';
      if (emp?.role === AccountRole.DOCTOR && doctorInfo?.fullName) {
        fullName = doctorInfo.fullName;
      } else if (
        emp?.role === AccountRole.CLINIC_STAFF &&
        staffInfo?.fullName
      ) {
        fullName = staffInfo.fullName;
      } else if (generalAccount?.fullName) {
        fullName = generalAccount.fullName;
      }

      const sortedHours = (schedule.clinicShift?.hours || []).sort((a: any, b: any) =>
        a.startHour.localeCompare(b.startHour),
      );

      return {
        id: schedule._id,
        workDate: schedule.workDate,
        weekDay: schedule.weekDay,
        employee: {
          id: emp?._id,
          fullName: fullName,
          avatar:
            emp?.role === AccountRole.DOCTOR
              ? doctorInfo?.profilePicture
              : staffInfo?.profilePicture ||
                generalAccount?.profilePicture ||
                null,
        },
        shift: {
          id: schedule.clinicShift?._id,
          name: schedule.clinicShift?.shift,
          startHour: sortedHours.length > 0 ? sortedHours[0].startHour : null,
          endHour:
            sortedHours.length > 0
              ? sortedHours[sortedHours.length - 1].endHour
              : null,
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
   * Update Schedule
   *
   * Updates an existing schedule identified by ID.
   * Checks for conflicts if critical fields (Shift, Date, Employee) are changed.
   *
   * @param id - UUID of schedule
   * @param updateScheduleDto - Fields to update
   * @returns Success message
   */
  async update(id: string, updateScheduleDto: UpdateScheduleDto) {
    const { clinicShiftId, workDate, roomId, employeeId } = updateScheduleDto;

    const schedule = await this.scheduleRepository.findOne({
      where: { _id: id },
      relations: ['rooms', 'employee'],
    });
    if (!schedule) throw new NotFoundException('Schedule not found');

    // Logic check: Validate new Foreign Keys (Employee, Shift) if changed...
    // ... (Skipping verbose checks for brevity, rely on existing logic or constraints)

    // Conflict Check on Appointments (If trying to modify Shift, Date, or Employee)
    if (clinicShiftId || workDate || employeeId) {
      // Check if there are any existing appointments for this schedule
      const checkQuery = this.dataSource
        .createQueryBuilder()
        .select('app._id')
        .from('appointments', 'app')
        .innerJoin(
          'clinic_shift_hour',
          'csh',
          'csh._id = app.clinic_shift_hour_id',
        )
        .innerJoin(
          'employee_schedule',
          'es',
          'es.clinic_shift_id = csh.shift_id AND es.employee_id = app.doctor_id AND es.work_date = app.appointment_date',
        )
        .where('es._id = :scheduleId', { scheduleId: id })
        .andWhere('NOT app.status = ANY(:statuses)', {
          statuses: [AppointmentStatus.CANCELLED, AppointmentStatus.ABSENT],
        })
        .andWhere('app.deleted_at IS NULL');

      const existingAppointments = await checkQuery.getRawMany();
      if (existingAppointments && existingAppointments.length > 0) {
        throw new ConflictException(
          'Cannot modify schedule because patients have already booked appointments.',
        );
      }
    }

    if (workDate) {
      schedule.workDate = getStartOfDay(workDate);
      const dayOfWeek = schedule.workDate.getDay();
      const weekDayMap = [
        WeekDay.SUNDAY,
        WeekDay.MONDAY,
        WeekDay.TUESDAY,
        WeekDay.WEDNESDAY,
        WeekDay.THURSDAY,
        WeekDay.FRIDAY,
        WeekDay.SATURDAY,
      ];
      schedule.weekDay = weekDayMap[dayOfWeek];
    }

    if (employeeId) schedule.employeeId = employeeId;
    if (clinicShiftId) schedule.clinicShiftId = clinicShiftId;

    // Update Room if provided
    if (roomId) {
      const room = await this.roomRepository.findOne({
        where: { _id: roomId, clinicId: schedule.clinicId },
      });
      if (!room) throw new NotFoundException('Clinic Room not found');
      schedule.rooms = [room];
    }

    // Conflict Check on Update
    if (clinicShiftId || workDate || employeeId) {
      const conflict = await this.scheduleRepository.findConflict(
        schedule.employeeId,
        schedule.workDate,
        schedule.clinicShiftId,
        id, // exclude current
      );
      if (conflict) {
        throw new ConflictException(
          'Update failed: Shift conflict for doctor detected',
        );
      }
    }

        // Room Occupancy Check on Update
    if (roomId || clinicShiftId || workDate) {
      const roomToCheck =
        roomId ||
        (schedule.rooms && schedule.rooms.length > 0
          ? schedule.rooms[0]._id
          : null);
      if (roomToCheck) {
        // Fetch employee to get role for conflict check
        const employeeForRole = await this.accountRepository.findOne({
          where: { _id: schedule.employeeId },
        });

        const roomConflict = await this.scheduleRepository.findRoomConflict(
          roomToCheck,
          schedule.workDate,
          schedule.clinicShiftId,
          employeeForRole?.role,
          id, // exclude current
        );
        if (roomConflict) {
          throw new ConflictException(
            'Update failed: Room is already assigned to another doctor for this shift',
          );
        }
      }
    }

    await this.scheduleRepository.save(schedule);
    return { message: 'Schedule updated successfully' };
  }

  /**
   * Remove Schedule
   *
   * Soft deletes a schedule.
   *
   * @param id - UUID of schedule to delete
   * @returns Success message
   */
  async remove(id: string) {
    const schedule = await this.scheduleRepository.findOne({
      where: { _id: id },
    });
    if (!schedule) throw new NotFoundException('Schedule not found');

    // Check if there are any existing appointments for this schedule before deleting
    const checkQuery = this.dataSource
      .createQueryBuilder()
      .select('app._id')
      .from('appointments', 'app')
      .innerJoin(
        'clinic_shift_hour',
        'csh',
        'csh._id = app.clinic_shift_hour_id',
      )
      .innerJoin(
        'employee_schedule',
        'es',
        'es.clinic_shift_id = csh.shift_id AND es.employee_id = app.doctor_id AND es.work_date = app.appointment_date',
      )
      .where('es._id = :scheduleId', { scheduleId: id })
      .andWhere('NOT app.status = ANY(:statuses)', {
        statuses: [AppointmentStatus.CANCELLED, AppointmentStatus.ABSENT],
      })
      .andWhere('app.deleted_at IS NULL');

    const existingAppointments = await checkQuery.getRawMany();
    if (existingAppointments && existingAppointments.length > 0) {
      throw new ConflictException(
        'Cannot delete schedule because patients have already booked appointments.',
      );
    }

    const result = await this.scheduleRepository.softDelete(id);
    if (result.affected === 0)
      throw new NotFoundException('Schedule not found');
    return { message: 'Schedule deleted successfully' };
  }

  /**
   * Get Clinic Shifts
   *
   * Helper to list all shifts for a clinic.
   */
  async getShifts(user: any) {
    const clinicId = await this.resolveClinicId(user);
    if (!clinicId) return [];

    return this.shiftRepository.find({
      where: { clinicId },
      relations: ['hours'],
      order: { shift: 'ASC' },
    });
  }

  /**
   * Get Clinic Rooms
   *
   * Helper to list all rooms for a clinic.
   * Resolves clinicId from user if provided.
   */
  async getRooms(user: any) {
    // Changed to accept User
    const clinicId = await this.resolveClinicId(user);
    if (!clinicId) return [];

    return this.roomRepository.find({
      where: { clinicId },
      select: ['_id', 'roomName'],
      order: { roomName: 'ASC' },
    });
  }

  async getRoomsByStaffId(staffId: string) {
    if (!staffId) return [];

    const staffAccount = await this.accountRepository.findOne({
      where: { _id: staffId },
    });

    if (!staffAccount || !staffAccount.parentId) return [];

    return this.roomRepository.find({
      where: { clinicId: staffAccount.parentId },
      select: ['_id', 'roomName'],
      order: { roomName: 'ASC' },
    });
  }

  /**
   * ---------------------------------------------------------
   * CLINIC ROOM CRUD APIs
   * ---------------------------------------------------------
   */

  async createClinicRoom(user: any, dto: CreateClinicRoomDto) {
    const clinicId = await this.resolveClinicId(user);
    if (!clinicId)
      throw new BadRequestException('Clinic ID could not be resolved');

    const room = this.roomRepository.create({
      roomName: dto.roomName,
      clinicId,
    });

    return await this.roomRepository.save(room);
  }

  async getPaginatedClinicRooms(user: any, query: ClinicRoomQueryDto) {
    const clinicId = await this.resolveClinicId(user);
    if (!clinicId)
      throw new BadRequestException('Clinic ID could not be resolved');

    const { page = 1, limit = 10, search } = query;
    const skip = (page - 1) * limit;

    const qb = this.roomRepository
      .createQueryBuilder('room')
      .where('room.clinicId = :clinicId', { clinicId });

    if (search) {
      qb.andWhere('LOWER(room.roomName) LIKE LOWER(:search)', {
        search: `%${search}%`,
      });
    }

    qb.orderBy('room.createdAt', 'DESC').skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getPaginatedClinicRoomsByStaffId(
    staffId: string,
    query: ClinicRoomQueryDto,
  ) {
    if (!staffId) throw new BadRequestException('Staff ID is required');

    const staffAccount = await this.accountRepository.findOne({
      where: { _id: staffId },
    });

    if (!staffAccount || !staffAccount.parentId) {
      throw new BadRequestException(
        'Staff not found or not assigned to a clinic',
      );
    }

    const { page = 1, limit = 10, search } = query;
    const skip = (page - 1) * limit;

    const qb = this.roomRepository
      .createQueryBuilder('room')
      .where('room.clinicId = :clinicId', { clinicId: staffAccount.parentId });

    if (search) {
      qb.andWhere('LOWER(room.roomName) LIKE LOWER(:search)', {
        search: `%${search}%`,
      });
    }

    qb.orderBy('room.createdAt', 'DESC').skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getClinicRoomById(id: string, user: any) {
    const clinicId = await this.resolveClinicId(user);
    if (!clinicId)
      throw new BadRequestException('Clinic ID could not be resolved');

    const room = await this.roomRepository.findOne({
      where: { _id: id, clinicId },
    });

    if (!room)
      throw new NotFoundException(
        'Clinic room not found or you do not have permission',
      );
    return room;
  }

  async updateClinicRoom(id: string, user: any, dto: UpdateClinicRoomDto) {
    const room = await this.getClinicRoomById(id, user);

    if (dto.roomName) {
      room.roomName = dto.roomName;
    }

    return await this.roomRepository.save(room);
  }

  async deleteClinicRoom(id: string, user: any) {
    const room = await this.getClinicRoomById(id, user);

    // Optional logic: Check if room is being used in an active EmployeeSchedule before deleting
    // ...

    const result = await this.roomRepository.softDelete(room._id);
    if (result.affected === 0)
      throw new NotFoundException('Failed to delete clinic room');
    return { message: 'Clinic room deleted successfully' };
  }

  /**
   * Get Clinic Rooms with Shift Hours (Staff Only)
   *
   * Retrieves all clinic rooms with their shift hours based on employee schedules
   * Used by staff to view available rooms and time slots
   *
   * Logic:
   * - Query all rooms for the clinic
   * - For each room, find employee schedules linked to that room
   * - From employee schedules, get clinic shifts and their hours
   * - Filter by work_date if provided
   *
   * @param user - User context (Staff)
   * @param date - Optional work date filter (YYYY-MM-DD)
   * @returns Object containing rooms array with nested shift hours
   */
  async getClinicRoomsWithShiftHours(user: any, date?: string) {
    const clinicId = await this.resolveClinicId(user);
    if (!clinicId)
      throw new BadRequestException('Clinic ID could not be resolved');

    // Get all rooms for the clinic
    const rooms = await this.roomRepository.find({
      where: { clinicId },
      select: ['_id', 'roomName'],
      order: { roomName: 'ASC' },
    });

    if (rooms.length === 0) {
      return { rooms: [] };
    }

    const roomIds = rooms.map((r) => r._id);

    // Query employee schedules linked to these rooms in ONE batch query
    const qb = this.dataSource
      .createQueryBuilder()
      .select([
        'cres.clinic_room_id as room_id',
        'es._id as schedule_id',
        'es.clinic_shift_id',
        'cs.shift',
        'csh._id as shift_hour_id',
        'csh.start_hour',
        'csh.end_hour',
        'csh.limit',
      ])
      .from('employee_schedule', 'es')
      .innerJoin(
        'clinic_room_employee_schedule',
        'cres',
        'cres.employee_schedule_id = es._id',
      )
      .innerJoin('clinic_shift', 'cs', 'cs._id = es.clinic_shift_id')
      .innerJoin('clinic_shift_hour', 'csh', 'csh.shift_id = cs._id')
      .where('cres.clinic_room_id = ANY(:roomIds)', { roomIds })
      .andWhere('es.clinic_id = :clinicId', { clinicId })
      .andWhere('es.deleted_at IS NULL')
      .andWhere('cs.deleted_at IS NULL')
      .andWhere('csh.deleted_at IS NULL');

    // Filter by date if provided
    if (date) {
      qb.andWhere('es.work_date = :workDate', { workDate: date });
    }

    qb.orderBy('csh.start_hour', 'ASC');

    const allScheduleData = await qb.getRawMany();

    // Group shift hours by room ID in memory
    const shiftHoursByRoom = new Map<string, Map<string, any>>();

    for (const row of allScheduleData) {
      const roomId = row.room_id;
      const shiftHourId = row.shift_hour_id;

      if (!shiftHoursByRoom.has(roomId)) {
        shiftHoursByRoom.set(roomId, new Map());
      }

      const roomMap = shiftHoursByRoom.get(roomId)!;
      if (!roomMap.has(shiftHourId)) {
        roomMap.set(shiftHourId, {
          id: shiftHourId,
          startHour: row.start_hour,
          endHour: row.end_hour,
          limit: row.limit,
          shiftType: row.shift,
          shiftId: row.clinic_shift_id,
        });
      }
    }

    // Build the final response structure
    const roomsWithShiftHours = rooms.map((room) => {
      const roomMap = shiftHoursByRoom.get(room._id);
      const shiftHours = roomMap ? Array.from(roomMap.values()) : [];

      return {
        id: room._id,
        roomName: room.roomName,
        shiftHours,
      };
    });

    return {
      rooms: roomsWithShiftHours,
    };
  }

  /**
   * Get Doctor Schedules (Staff Only)
   *
   * Retrieves list of doctors with their available schedules for appointment booking
   * Includes time slots, rooms, and availability information
   *
   * Query Logic:
   * - Get all employee schedules for clinic within date range (today + 60 days)
   * - JOIN clinic_shift, clinic_shift_hour, clinic_room
   * - Calculate available slots (limit - booked appointments)
   * - Filter by serviceConfigId (doctors who can perform service)
   * - Filter by shiftType if provided
   * - Group by doctor
   *
   * @param {string} clinicId - Clinic UUID
   * @param {object} query - Query parameters (serviceConfigId, shiftType)
   * @returns {Promise<DoctorSchedulesResponseDto>} Doctors with schedules
   */
  async getDoctorSchedules(
    clinicId: string,
    query: {
      serviceConfigId?: string;
      shiftType?: string;
    },
  ): Promise<any> {
    const { serviceConfigId, shiftType } = query;

    // === STEP 1: Get clinic info ===
    const clinicInfo = await this.dataSource
      .createQueryBuilder()
      .select([
        'a._id AS clinic_id',
        'COALESCE(ga.full_name, a.email) AS clinic_name',
        "COALESCE(addr.address, '') AS address",
        "COALESCE(a.phone, '') AS phone",
      ])
      .from('accounts', 'a')
      .leftJoin(
        'general_accounts',
        'ga',
        'ga.account_id = a._id AND ga.deleted_at IS NULL',
      )
      .leftJoin(
        'addresses',
        'addr',
        'addr.account_id = a._id AND addr.deleted_at IS NULL',
      )
      .where('a._id = :clinicId', { clinicId })
      .andWhere('a.deleted_at IS NULL')
      .getRawOne();

    if (!clinicInfo) {
      throw new NotFoundException('Clinic not found');
    }

    // === STEP 2: Calculate date range ===
    const today = getStartOfDay();
    const maxDate = addToVietnamTime(30, 'day'); // Limited to 30 days ahead

    const dateRangeStart = getDateString(today);
    const dateRangeEnd = getDateString(maxDate);

    // === STEP 3: Build complex query to get schedules ===
    let queryBuilder = this.dataSource
      .createQueryBuilder()
      .select([
        'es._id AS employee_schedule_id',
        'es.employee_id AS doctor_id',
        'es.work_date AS work_date',
        'es.week_day AS week_day',
        'cs._id AS shift_id',
        'cs.shift AS shift_type',
        'csh._id AS shift_hour_id',
        'csh.start_hour AS start_hour',
        'csh.end_hour AS end_hour',
        'csh.limit AS limit',
        'COALESCE(COUNT(DISTINCT app._id), 0) AS booked_count',
        'COALESCE(ga.full_name, di.full_name, a.email) AS doctor_name',
        'a.email AS doctor_email',
        'a.phone AS doctor_phone',
        'di.profile_picture AS doctor_avatar',
        'di.position AS specialization',
        'di.experience AS years_of_experience',
      ])
      .from('employee_schedule', 'es')
      .innerJoin('clinic_shift', 'cs', 'cs._id = es.clinic_shift_id')
      .innerJoin('clinic_shift_hour', 'csh', 'csh.shift_id = cs._id')
      .innerJoin('accounts', 'a', 'a._id = es.employee_id')
      .leftJoin(
        'general_accounts',
        'ga',
        'ga.account_id = a._id AND ga.deleted_at IS NULL',
      )
      .leftJoin(
        'doctor_information',
        'di',
        'di.account_id = a._id AND di.deleted_at IS NULL',
      )
      .leftJoin(
        'appointments',
        'app',
        'app.clinic_shift_hour_id = csh._id AND app.appointment_date = es.work_date AND NOT app.status = ANY(:cancelledStatuses) AND app.deleted_at IS NULL',
        { cancelledStatuses: ['CANCELLED', 'ABSENT'] },
      )
      .where('es.clinic_id = :clinicId', { clinicId })
      .andWhere('es.work_date >= :today', { today: dateRangeStart })
      .andWhere('es.work_date <= :maxDate', { maxDate: dateRangeEnd })
      .andWhere('es.deleted_at IS NULL')
      .andWhere('cs.deleted_at IS NULL')
      .andWhere('csh.deleted_at IS NULL')
      .andWhere('a.role = :role', { role: AccountRole.DOCTOR })
      .andWhere('a.deleted_at IS NULL')
      .groupBy(
        'es._id, es.employee_id, es.work_date, es.week_day, cs._id, cs.shift, csh._id, csh.start_hour, csh.end_hour, csh.limit, a._id, a.email, a.phone, ga.full_name, di.full_name, di.profile_picture, di.position, di.experience',
      );
    // Filter by shift type if provided
    if (shiftType) {
      queryBuilder = queryBuilder.andWhere('cs.shift = :shiftType', {
        shiftType,
      });
    }

    // Filter by service if provided
    if (serviceConfigId) {
      // Get service_id from service config (this points to clinic_services._id)
      const serviceConfig = await this.dataSource
        .createQueryBuilder()
        .select('csc.service_id')
        .from('clinic_service_config', 'csc')
        .where('csc._id = :serviceConfigId', { serviceConfigId })
        .andWhere('csc.deleted_at IS NULL')
        .getRawOne();

      if (serviceConfig && serviceConfig.service_id) {
        // Filter doctors who can perform this service
        queryBuilder = queryBuilder.andWhere(
          'EXISTS (SELECT 1 FROM doctor_services dcs WHERE dcs.doctor_id = es.employee_id AND dcs.clinic_service_id = :clinicServiceId AND dcs.deleted_at IS NULL)',
          { clinicServiceId: serviceConfig.service_id },
        );
      }
    }

    queryBuilder = queryBuilder
      .orderBy('es.work_date', 'ASC')
      .addOrderBy('csh.start_hour', 'ASC');

    const schedules = await queryBuilder.getRawMany();

    // === STEP 4: Get room information for each schedule ===
    const scheduleIds = [
      ...new Set(schedules.map((s) => s.employee_schedule_id)),
    ];

    let roomsData: any[] = [];
    if (scheduleIds.length > 0) {
      roomsData = await this.dataSource
        .createQueryBuilder()
        .select([
          'cres.employee_schedule_id AS employee_schedule_id',
          'cr._id AS room_id',
          'cr.room_name AS room_name',
        ])
        .from('clinic_room_employee_schedule', 'cres')
        .innerJoin('clinic_room', 'cr', 'cr._id = cres.clinic_room_id')
        .where('cres.employee_schedule_id = ANY(:scheduleIds)', {
          scheduleIds,
        })
        .andWhere('cr.deleted_at IS NULL')
        .getRawMany();
    }

    // === STEP 5: Group schedules by doctor ===
    const doctorMap = new Map<string, any>();

    schedules.forEach((schedule) => {
      const doctorId = schedule.doctor_id;

      if (!doctorMap.has(doctorId)) {
        doctorMap.set(doctorId, {
          doctor: {
            doctorId: schedule.doctor_id,
            fullName: schedule.doctor_name,
            email: schedule.doctor_email,
            phone: schedule.doctor_phone,
            avatar: schedule.doctor_avatar,
            specialization: schedule.specialization,
            yearsOfExperience: schedule.years_of_experience,
          },
          schedules: [],
          totalSchedules: 0,
        });
      }

      const doctorData = doctorMap.get(doctorId);

      // Find or create schedule entry for this date/shift
      let scheduleEntry = doctorData.schedules.find(
        (s: any) => s.employeeScheduleId === schedule.employee_schedule_id,
      );

      if (!scheduleEntry) {
        // Get rooms for this schedule
        const scheduleRooms = roomsData
          .filter(
            (r) => r.employee_schedule_id === schedule.employee_schedule_id,
          )
          .map((r) => ({
            roomId: r.room_id,
            roomNumber: r.room_name,
            roomName: r.room_name,
          }));

        scheduleEntry = {
          employeeScheduleId: schedule.employee_schedule_id,
          workDate: schedule.work_date,
          weekDay: schedule.week_day,
          shiftType: schedule.shift_type,
          shiftId: schedule.shift_id,
          timeSlots: [],
          rooms: scheduleRooms,
          totalAvailableSlots: 0,
        };
        doctorData.schedules.push(scheduleEntry);
        doctorData.totalSchedules++;
      }

      // Add time slot
      const limit = Number(schedule.limit || 0);
      const bookedCount = Number(schedule.booked_count || 0);
      const availableSlots = Math.max(limit - bookedCount, 0);
      scheduleEntry.timeSlots.push({
        shiftHourId: schedule.shift_hour_id,
        startHour: schedule.start_hour,
        endHour: schedule.end_hour,
        limit,
        availableSlots: availableSlots,
        isFullyBooked: availableSlots <= 0,
      });
      scheduleEntry.totalAvailableSlots += availableSlots;
    });

    // === STEP 6: Convert map to array ===
    const doctors = Array.from(doctorMap.values());

    return {
      doctors,
      totalDoctors: doctors.length,
      clinicInfo: {
        clinicId: clinicInfo.clinic_id,
        clinicName: clinicInfo.clinic_name,
        address: clinicInfo.address,
        phone: clinicInfo.phone,
      },
      dateRangeStart,
      dateRangeEnd,
    };
  }

  /**
   * Get doctor schedules by specific date
   * Optimized query for single date with detailed slot information
   */
  async getDoctorSchedulesByDate(
    clinicId: string,
    query: {
      date: string;
      doctorId?: string;
      shiftType?: string;
      serviceConfigId?: string;
    },
  ): Promise<any> {
    const { date, doctorId, shiftType, serviceConfigId } = query;

    // Validate date format and not in past
    const queryDate = new Date(date);
    const today = getStartOfDay();

    if (isNaN(queryDate.getTime())) {
      throw new BadRequestException('Invalid date format. Use YYYY-MM-DD');
    }

    if (queryDate < today) {
      throw new BadRequestException('Cannot query schedules for past dates');
    }

    // Calculate week day
    const weekDays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const weekDay = weekDays[queryDate.getDay()];

    // === QUERY: Get all schedules for the specific date ===
    let queryBuilder = this.dataSource
      .createQueryBuilder()
      .select([
        'es._id AS employee_schedule_id',
        'es.employee_id AS doctor_id',
        'es.work_date AS work_date',
        'COALESCE(ga.full_name, di.full_name, a.email) AS doctor_name',
        'a.email AS doctor_email',
        'a.phone AS doctor_phone',
        'di.profile_picture AS doctor_avatar',
        'di.position AS doctor_specialty',
        'di.experience AS doctor_experience',
        'cs._id AS shift_id',
        'cs.shift AS shift_type',
        'csh._id AS shift_hour_id',
        'csh.start_hour AS slot_start_time',
        'csh.end_hour AS slot_end_time',
        'csh.limit AS slot_limit',
        'COALESCE(COUNT(DISTINCT app._id), 0) AS booked_count',
      ])
      .from('employee_schedule', 'es')
      .innerJoin('clinic_shift', 'cs', 'cs._id = es.clinic_shift_id')
      .innerJoin('clinic_shift_hour', 'csh', 'csh.shift_id = cs._id')
      .innerJoin('accounts', 'a', 'a._id = es.employee_id')
      .leftJoin(
        'general_accounts',
        'ga',
        'ga.account_id = a._id AND ga.deleted_at IS NULL',
      )
      .leftJoin(
        'doctor_information',
        'di',
        'di.account_id = a._id AND di.deleted_at IS NULL',
      )
      .leftJoin(
        'appointments',
        'app',
        'app.clinic_shift_hour_id = csh._id AND app.appointment_date = :date AND NOT app.status = ANY(:cancelledStatuses) AND app.deleted_at IS NULL',
        { cancelledStatuses: ['CANCELLED', 'ABSENT'] },
      )
      .where('es.clinic_id = :clinicId', { clinicId })
      .andWhere('es.work_date = :date', { date })
      .andWhere('es.deleted_at IS NULL')
      .andWhere('cs.deleted_at IS NULL')
      .andWhere('csh.deleted_at IS NULL')
      .andWhere('a.role = :role', { role: AccountRole.DOCTOR })
      .andWhere('a.deleted_at IS NULL')
      .groupBy(
        [
          'es._id',
          'es.employee_id',
          'es.work_date',
          'ga.full_name',
          'di.full_name',
          'a.email',
          'a.phone',
          'di.profile_picture',
          'di.position',
          'di.experience',
          'cs._id',
          'cs.shift',
          'csh._id',
          'csh.start_hour',
          'csh.end_hour',
          'csh.limit',
        ].join(', '),
      );

    // Apply optional filters
    if (doctorId) {
      queryBuilder = queryBuilder.andWhere('es.employee_id = :doctorId', {
        doctorId,
      });
    }

    if (shiftType) {
      queryBuilder = queryBuilder.andWhere('cs.shift = :shiftType', {
        shiftType,
      });
    }

    // Filter by service if provided
    if (serviceConfigId) {
      const serviceConfig = await this.dataSource
        .createQueryBuilder()
        .select('csc.service_id')
        .from('clinic_service_config', 'csc')
        .where('csc._id = :serviceConfigId', { serviceConfigId })
        .andWhere('csc.deleted_at IS NULL')
        .getRawOne();

      if (serviceConfig && serviceConfig.service_id) {
        queryBuilder = queryBuilder.andWhere(
          'EXISTS (SELECT 1 FROM doctor_services dcs WHERE dcs.doctor_id = es.employee_id AND dcs.clinic_service_id = :clinicServiceId AND dcs.deleted_at IS NULL)',
          { clinicServiceId: serviceConfig.service_id },
        );
      }
    }

    queryBuilder = queryBuilder
      .orderBy('a.email', 'ASC')
      .addOrderBy('cs.shift', 'ASC')
      .addOrderBy('csh.start_hour', 'ASC');

    const schedules = await queryBuilder.getRawMany();

    if (schedules.length === 0) {
      return {
        date,
        weekDay,
        doctors: [],
        summary: {
          totalDoctorsAvailable: 0,
          totalSlotsAvailable: 0,
          earliestSlot: null,
          latestSlot: null,
        },
      };
    }

    // === Get room information ===
    const scheduleIds = [
      ...new Set(schedules.map((s) => s.employee_schedule_id)),
    ];
    let roomsData: any[] = [];

    if (scheduleIds.length > 0) {
      roomsData = await this.dataSource
        .createQueryBuilder()
        .select([
          'cres.employee_schedule_id AS employee_schedule_id',
          'cr._id AS room_id',
          'cr.room_name AS room_name',
        ])
        .from('clinic_room_employee_schedule', 'cres')
        .innerJoin('clinic_room', 'cr', 'cr._id = cres.clinic_room_id')
        .where('cres.employee_schedule_id = ANY(:scheduleIds)', {
          scheduleIds,
        })
        .andWhere('cr.deleted_at IS NULL')
        .getRawMany();
    }

    // === Process data and group by doctor → shift ===
    const doctorMap = new Map<string, any>();
    let totalAvailableSlots = 0;
    let earliestTime = '23:59:59';
    let latestTime = '00:00:00';

    schedules.forEach((schedule) => {
      const doctorId = schedule.doctor_id;
      const employeeScheduleId = schedule.employee_schedule_id;
      const shiftId = schedule.shift_id;

      // Initialize doctor entry
      if (!doctorMap.has(doctorId)) {
        doctorMap.set(doctorId, {
          doctorId: schedule.doctor_id,
          doctorFullName: schedule.doctor_name,
          doctorSpecialty: schedule.doctor_specialty || 'Not updated',
          doctorAvatar: schedule.doctor_avatar,
          doctorEmail: schedule.doctor_email,
          doctorPhone: schedule.doctor_phone,
          shifts: [],
          totalAvailableSlots: 0,
        });
      }

      const doctorData = doctorMap.get(doctorId);

      // Find or create shift entry
      let shiftEntry = doctorData.shifts.find(
        (s: any) =>
          s.employeeScheduleId === employeeScheduleId && s.shiftId === shiftId,
      );

      if (!shiftEntry) {
        // Get room for this schedule
        const scheduleRoom = roomsData.find(
          (r) => r.employee_schedule_id === employeeScheduleId,
        );

        shiftEntry = {
          employeeScheduleId,
          shiftId,
          shiftType: schedule.shift_type,
          shiftStartTime: '23:59:59', // Will be calculated from slots
          shiftEndTime: '00:00:00', // Will be calculated from slots
          room: scheduleRoom
            ? {
                roomId: scheduleRoom.room_id,
                roomName: scheduleRoom.room_name,
              }
            : null,
          availableSlots: [],
          bookedSlots: [],
          totalSlots: 0,
          availableCount: 0,
          bookedCount: 0,
        };
        doctorData.shifts.push(shiftEntry);
      }

      const slotLimit = Number(schedule.slot_limit || 0);
      const bookedCount = Number(schedule.booked_count || 0);
      const availableCount = Math.max(slotLimit - bookedCount, 0);

      // Create time slot object
      const appointmentHour = `${date}T${schedule.slot_start_time}.000Z`;
      const timeSlot = {
        shiftHourId: schedule.shift_hour_id,
        startTime: schedule.slot_start_time,
        endTime: schedule.slot_end_time,
        appointmentHour,
        isAvailable: availableCount > 0,
      };

      // Mode 2: include all slots (both available and full)
      if (bookedCount > 0) {
        shiftEntry.bookedSlots.push({
          ...timeSlot,
          bookedBy: `Booked ${bookedCount}/${slotLimit}`,
        });
        shiftEntry.bookedCount += bookedCount;
      }

      // When a slot is partially booked, it must appear in available list too
      if (availableCount > 0) {
        shiftEntry.availableSlots.push(timeSlot);
      }

      shiftEntry.availableCount += availableCount;
      doctorData.totalAvailableSlots += availableCount;
      totalAvailableSlots += availableCount;
      shiftEntry.totalSlots += slotLimit;

      // Update shift time range from slots
      if (schedule.slot_start_time < shiftEntry.shiftStartTime) {
        shiftEntry.shiftStartTime = schedule.slot_start_time;
      }
      if (schedule.slot_end_time > shiftEntry.shiftEndTime) {
        shiftEntry.shiftEndTime = schedule.slot_end_time;
      }

      // Track earliest and latest times
      if (schedule.slot_start_time < earliestTime) {
        earliestTime = schedule.slot_start_time;
      }
      if (schedule.slot_end_time > latestTime) {
        latestTime = schedule.slot_end_time;
      }
    });

    // Mode 2: keep all doctors in response, including those with fully booked slots
    const doctors = Array.from(doctorMap.values());
    const availableDoctorsCount = doctors.filter(
      (d) => d.totalAvailableSlots > 0,
    ).length;

    return {
      date,
      weekDay,
      doctors,
      summary: {
        totalDoctorsAvailable: availableDoctorsCount,
        totalSlotsAvailable: totalAvailableSlots,
        earliestSlot: totalAvailableSlots > 0 ? earliestTime : null,
        latestSlot: totalAvailableSlots > 0 ? latestTime : null,
      },
    };
  }
}
