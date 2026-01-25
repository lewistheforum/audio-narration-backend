import { Injectable, Logger } from '@nestjs/common';
import { Account } from '../../modules/accounts/entities/accounts.entity';
import { AccountRole } from '../../modules/accounts/enums';
import { AccountRepository } from '../../modules/accounts/repositories/account.repository';
import { ClinicShift } from '../../modules/schedules/entities/clinic-shift.entity';
import { EmployeeSchedule } from '../../modules/schedules/entities/employee-schedule.entity';
import { ClinicShiftRepository } from '../../modules/schedules/repositories/clinic-shift.repository';
import { EmployeeScheduleRepository } from '../../modules/schedules/repositories/employee-schedule.repository';
import { ShiftType, WeekDay } from '../../modules/schedules/enums';

/**
 * Employee Schedule Seeder Service
 *
 * Seeds EmployeeSchedule records for DOCTOR and CLINIC_STAFF accounts.
 *
 * For each employee:
 * - Derive clinic_id from employee's parent_id (the clinic manager account)
 * - Generate schedules for next 30 days
 * - Randomly assign to MORNING/AFTERNOON/EVENING shifts
 * - Calculate week_day based on work_date
 *
 * Idempotent: Checks if schedule exists by (employee_id, work_date, clinic_shift_id).
 *
 * Seeding Order:
 * - Must run after AccountSeederService (DOCTOR and CLINIC_STAFF accounts must exist)
 * - Must run after ClinicShiftSeederService (shifts must exist)
 * - Must run before ClinicRoomEmployeeScheduleSeederService (schedules are needed for room assignments)
 */
@Injectable()
export class EmployeeScheduleSeederService {
  private readonly logger = new Logger(EmployeeScheduleSeederService.name);
  private readonly DAYS_TO_GENERATE = 30;

  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly clinicShiftRepository: ClinicShiftRepository,
    private readonly employeeScheduleRepository: EmployeeScheduleRepository,
  ) {}

  /**
   * Seed employee schedules for all DOCTOR and CLINIC_STAFF accounts
   *
   * This method is called by SeederOrchestratorService during application bootstrap.
   */
  async seed(): Promise<void> {
    try {
      this.logger.log('Starting to seed employee schedules...');

      // Get all DOCTOR and CLINIC_STAFF accounts
      const allAccounts = await this.accountRepository.findAllAccounts();
      const employees = allAccounts.filter(
        (acc) =>
          acc.role === AccountRole.DOCTOR ||
          acc.role === AccountRole.CLINIC_STAFF,
      );

      if (employees.length === 0) {
        this.logger.warn('No DOCTOR or CLINIC_STAFF accounts found. Skipping employee schedule seeding.');
        return;
      }

      let totalSchedulesCreated = 0;

      for (const employee of employees) {
        const schedulesCreated = await this.seedSchedulesForEmployee(employee);
        totalSchedulesCreated += schedulesCreated;
      }

      this.logger.log(
        `✅ Employee schedule seeding completed. Created ${totalSchedulesCreated} schedules total.`,
      );
    } catch (error) {
      this.logger.error('Failed to seed employee schedules', error.stack);
      throw error;
    }
  }

  /**
   * Seed schedules for a single employee
   *
   * @param employee - The DOCTOR or CLINIC_STAFF account
   * @returns Number of schedules created for this employee
   */
  private async seedSchedulesForEmployee(
    employee: Account,
  ): Promise<number> {
    // Derive clinic_id from employee's parent_id
    if (!employee.parentId) {
      this.logger.warn(
        `Employee ${employee._id} has no parent_id. Skipping schedule seeding.`,
      );
      return 0;
    }

    // Get all shifts for this clinic
    const shifts = await this.clinicShiftRepository.find({
      where: { clinicId: employee.parentId },
    });

    if (shifts.length === 0) {
      this.logger.warn(
        `No shifts found for clinic ${employee.parentId}. Skipping employee ${employee._id}.`,
      );
      return 0;
    }

    this.logger.log(
      `Seeding schedules for employee ${employee._id} (${employee.role})...`,
    );

    let createdCount = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Generate schedules for the next 30 days
    for (let dayOffset = 0; dayOffset < this.DAYS_TO_GENERATE; dayOffset++) {
      const workDate = new Date(today);
      workDate.setDate(today.getDate() + dayOffset);

      // Calculate week_day based on work_date
      const weekDay = this.getWeekDay(workDate);

      // Randomly assign to a shift (not all employees work every day)
      if (this.shouldAssignSchedule()) {
        const randomShift = shifts[this.getRandomInt(0, shifts.length - 1)];

        // Check if schedule already exists for this employee, date, and shift
        const existingSchedule =
          await this.employeeScheduleRepository.findOne({
            where: {
              employeeId: employee._id,
              workDate: workDate,
              clinicShiftId: randomShift._id,
            },
          });

        if (existingSchedule) {
          continue;
        }

        const schedule = this.employeeScheduleRepository.create({
          employeeId: employee._id,
          clinicId: employee.parentId,
          clinicShiftId: randomShift._id,
          workDate,
          weekDay,
        });

        await this.employeeScheduleRepository.save(schedule);
        createdCount++;
      }
    }

    this.logger.log(
      `✅ Created ${createdCount} schedules for employee ${employee._id}`,
    );

    return createdCount;
  }

  /**
   * Get WeekDay enum value from a Date object
   *
   * @param date - The date to convert
   * @returns WeekDay enum value
   */
  private getWeekDay(date: Date): WeekDay {
    const day = date.getDay(); // 0 = Sunday, 1 = Monday, etc.

    switch (day) {
      case 0:
        return WeekDay.SUNDAY;
      case 1:
        return WeekDay.MONDAY;
      case 2:
        return WeekDay.TUESDAY;
      case 3:
        return WeekDay.WEDNESDAY;
      case 4:
        return WeekDay.THURSDAY;
      case 5:
        return WeekDay.FRIDAY;
      case 6:
        return WeekDay.SATURDAY;
      default:
        return WeekDay.MONDAY;
    }
  }

  /**
   * Determine if an employee should be assigned a schedule for a given day
   * Returns true with 70% probability (employees don't work every day)
   *
   * @returns True if schedule should be assigned
   */
  private shouldAssignSchedule(): boolean {
    return Math.random() < 0.7;
  }

  /**
   * Get random integer between min and max (inclusive)
   */
  private getRandomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}
