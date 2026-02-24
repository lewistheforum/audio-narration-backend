import { Injectable, Logger } from '@nestjs/common';
import { Account } from '../../modules/accounts/entities/accounts.entity';
import { AccountRole } from '../../modules/accounts/enums';
import { AccountRepository } from '../../modules/accounts/repositories/account.repository';
import { ClinicRoom } from '../../modules/schedules/entities/clinic_room.entity';
import { ClinicRoomRepository } from '../../modules/schedules/repositories/clinic-room.repository';
import { ClinicSubscriptionRepository } from '../../modules/subscriptions/repositories/clinic-subscription.repository';
// imports resolved

/**
 * Clinic Room Seeder Service
 *
 * Seeds ClinicRoom records for each CLINIC_MANAGER account (clinic).
 * Creates 3-5 rooms per clinic with names like "Room 1", "Room 2", etc.
 *
 * Idempotent: Checks if rooms already exist for each clinic before seeding.
 *
 * Seeding Order:
 * - Must run after AccountSeederService (CLINIC_MANAGER accounts must exist)
 * - Must run before EmployeeScheduleSeederService (rooms are needed for assignments)
 */
@Injectable()
export class ClinicRoomSeederService {
  private readonly logger = new Logger(ClinicRoomSeederService.name);
  private readonly MIN_ROOMS_PER_CLINIC = 3;
  private readonly MAX_ROOMS_PER_CLINIC = 5;

  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly clinicRoomRepository: ClinicRoomRepository,
    private readonly clinicSubscriptionRepository: ClinicSubscriptionRepository,
  ) {}

  /**
   * Seed clinic rooms for all CLINIC_MANAGER accounts
   *
   * This method is called by SeederOrchestratorService during application bootstrap.
   */
  async seed(): Promise<void> {
    try {
      this.logger.log('Starting to seed clinic rooms...');

      // Check active subscriptions to filter clinics
      const activeClinicIds =
        await this.clinicSubscriptionRepository.findActiveClinicIds();

      // Get all CLINIC_MANAGER accounts (clinics)
      const allAccounts = await this.accountRepository.findAllAccounts();
      const clinicManagers = allAccounts.filter(
        (acc) =>
          acc.role === AccountRole.CLINIC_MANAGER &&
          activeClinicIds.includes(acc.parentId),
      );

      if (clinicManagers.length === 0) {
        this.logger.warn(
          'No CLINIC_MANAGER accounts found. Skipping clinic room seeding.',
        );
        return;
      }

      let totalRoomsCreated = 0;

      for (const clinic of clinicManagers) {
        const roomsCreated = await this.seedRoomsForClinic(clinic);
        totalRoomsCreated += roomsCreated;
      }

      this.logger.log(
        `✅ Clinic room seeding completed. Created ${totalRoomsCreated} rooms total.`,
      );
    } catch (error) {
      this.logger.error('Failed to seed clinic rooms', error.stack);
      throw error;
    }
  }

  /**
   * Seed rooms for a single clinic
   *
   * @param clinic - The CLINIC_MANAGER account representing the clinic
   * @returns Number of rooms created for this clinic
   */
  private async seedRoomsForClinic(clinic: Account): Promise<number> {
    // Check if rooms already exist for this clinic
    const existingRooms = await this.clinicRoomRepository.find({
      where: { clinicId: clinic._id },
    });

    // If rooms already exist, skip seeding for this clinic
    if (existingRooms.length > 0) {
      this.logger.log(
        `Clinic ${clinic._id} already has ${existingRooms.length} rooms. Skipping.`,
      );
      return 0;
    }

    // Determine number of rooms to create (3-5)
    const roomCount = this.getRandomInt(
      this.MIN_ROOMS_PER_CLINIC,
      this.MAX_ROOMS_PER_CLINIC,
    );

    this.logger.log(`Seeding ${roomCount} rooms for clinic ${clinic._id}...`);

    let createdCount = 0;

    for (let i = 1; i <= roomCount; i++) {
      const roomName = `Room ${i}`;

      const room = this.clinicRoomRepository.create({
        clinicId: clinic._id,
        roomName,
      });

      await this.clinicRoomRepository.save(room);
      createdCount++;
    }

    this.logger.log(
      `✅ Created ${createdCount} rooms for clinic ${clinic._id}`,
    );

    return createdCount;
  }

  /**
   * Get random integer between min and max (inclusive)
   */
  private getRandomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}
