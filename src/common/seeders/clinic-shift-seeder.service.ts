import { Injectable, Logger } from '@nestjs/common';
import { Account } from '../../modules/accounts/entities/accounts.entity';
import { AccountRole } from '../../modules/accounts/enums';
import { AccountRepository } from '../../modules/accounts/repositories/account.repository';
import { ClinicShift } from '../../modules/schedules/entities/clinic-shift.entity';
import { ClinicShiftHour } from '../../modules/schedules/entities/clinic-shift-hour.entity';
import { ClinicShiftRepository } from '../../modules/schedules/repositories/clinic-shift.repository';
import { ClinicShiftHourRepository } from '../../modules/schedules/repositories/clinic-shift-hour.repository';
import { ShiftType } from '../../modules/schedules/enums';

/**
 * Clinic Shift Seeder Service
 *
 * Seeds ClinicShift records (MORNING, AFTERNOON, EVENING) for each clinic.
 * Seeds ClinicShiftHour records for each shift with predefined time windows.
 *
 * Shift hour windows:
 * - MORNING: 08:00-09:00, 09:00-10:00, 10:00-11:00
 * - AFTERNOON: 13:00-14:00, 14:00-15:00, 15:00-16:00
 * - EVENING: 17:00-18:00, 18:00-19:00, 19:00-20:00
 *
 * Limit: random 3-5 per shift hour
 *
 * Idempotent: Checks if shifts already exist for each clinic before seeding.
 *
 * Seeding Order:
 * - Must run after AccountSeederService (CLINIC_MANAGER accounts must exist)
 * - Must run before EmployeeScheduleSeederService (shifts are needed for schedules)
 */
@Injectable()
export class ClinicShiftSeederService {
  private readonly logger = new Logger(ClinicShiftSeederService.name);
  private readonly MIN_LIMIT = 3;
  private readonly MAX_LIMIT = 5;

  // Shift hour configurations
  private readonly SHIFT_HOURS = {
    [ShiftType.MORNING]: [
      { start: '08:00:00', end: '09:00:00' },
      { start: '09:00:00', end: '10:00:00' },
      { start: '10:00:00', end: '11:00:00' },
    ],
    [ShiftType.AFTERNOON]: [
      { start: '13:00:00', end: '14:00:00' },
      { start: '14:00:00', end: '15:00:00' },
      { start: '15:00:00', end: '16:00:00' },
    ],
    [ShiftType.EVENING]: [
      { start: '17:00:00', end: '18:00:00' },
      { start: '18:00:00', end: '19:00:00' },
      { start: '19:00:00', end: '20:00:00' },
    ],
  };

  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly clinicShiftRepository: ClinicShiftRepository,
    private readonly clinicShiftHourRepository: ClinicShiftHourRepository,
  ) {}

  /**
   * Seed clinic shifts and shift hours for all CLINIC_MANAGER accounts
   *
   * This method is called by SeederOrchestratorService during application bootstrap.
   */
  async seed(): Promise<void> {
    try {
      this.logger.log('Starting to seed clinic shifts...');

      // Get all CLINIC_MANAGER accounts (clinics)
      const allAccounts = await this.accountRepository.findAllAccounts();
      const clinicManagers = allAccounts.filter(
        (acc) => acc.role === AccountRole.CLINIC_MANAGER,
      );

      if (clinicManagers.length === 0) {
        this.logger.warn('No CLINIC_MANAGER accounts found. Skipping clinic shift seeding.');
        return;
      }

      let totalShiftsCreated = 0;
      let totalShiftHoursCreated = 0;

      for (const clinic of clinicManagers) {
        const { shiftsCreated, shiftHoursCreated } =
          await this.seedShiftsForClinic(clinic);
        totalShiftsCreated += shiftsCreated;
        totalShiftHoursCreated += shiftHoursCreated;
      }

      this.logger.log(
        `✅ Clinic shift seeding completed. Created ${totalShiftsCreated} shifts and ${totalShiftHoursCreated} shift hours total.`,
      );
    } catch (error) {
      this.logger.error('Failed to seed clinic shifts', error.stack);
      throw error;
    }
  }

  /**
   * Seed shifts for a single clinic
   *
   * @param clinic - The CLINIC_MANAGER account representing the clinic
   * @returns Object with counts of created shifts and shift hours
   */
  private async seedShiftsForClinic(
    clinic: Account,
  ): Promise<{ shiftsCreated: number; shiftHoursCreated: number }> {
    // Check if shifts already exist for this clinic
    const existingShifts = await this.clinicShiftRepository.find({
      where: { clinicId: clinic._id },
    });

    // If shifts already exist, skip seeding for this clinic
    if (existingShifts.length > 0) {
      this.logger.log(
        `Clinic ${clinic._id} already has ${existingShifts.length} shifts. Skipping.`,
      );
      return { shiftsCreated: 0, shiftHoursCreated: 0 };
    }

    this.logger.log(`Seeding shifts for clinic ${clinic._id}...`);

    let shiftsCreated = 0;
    let shiftHoursCreated = 0;

    // Create shifts for each shift type (MORNING, AFTERNOON, EVENING)
    for (const shiftType of Object.values(ShiftType)) {
      const shift = this.clinicShiftRepository.create({
        clinicId: clinic._id,
        shift: shiftType,
      });

      const savedShift = await this.clinicShiftRepository.save(shift);
      shiftsCreated++;

      // Create shift hours for this shift
      const hoursCreated = await this.seedShiftHoursForShift(savedShift);
      shiftHoursCreated += hoursCreated;
    }

    this.logger.log(
      `✅ Created ${shiftsCreated} shifts and ${shiftHoursCreated} shift hours for clinic ${clinic._id}`,
    );

    return { shiftsCreated, shiftHoursCreated };
  }

  /**
   * Seed shift hours for a single shift
   *
   * @param shift - The ClinicShift entity
   * @returns Number of shift hours created
   */
  private async seedShiftHoursForShift(shift: ClinicShift): Promise<number> {
    const hours = this.SHIFT_HOURS[shift.shift];

    if (!hours || hours.length === 0) {
      this.logger.warn(`No shift hours defined for shift type: ${shift.shift}`);
      return 0;
    }

    let createdCount = 0;

    for (const hourConfig of hours) {
      const limit = this.getRandomInt(this.MIN_LIMIT, this.MAX_LIMIT);

      const shiftHour = this.clinicShiftHourRepository.create({
        shiftId: shift._id,
        startHour: hourConfig.start,
        endHour: hourConfig.end,
        limit,
      });

      await this.clinicShiftHourRepository.save(shiftHour);
      createdCount++;
    }

    return createdCount;
  }

  /**
   * Get random integer between min and max (inclusive)
   */
  private getRandomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}
