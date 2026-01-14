import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AdminSeederService } from './admin-seeder.service';
import { ClinicAdminSeederService } from './clinic-admin-seeder.service';
import { AccountsSeederService } from './accounts-seeder.service';
import { FeedbackSeederService } from './feedback-seeder.service';
import { AccountRepository } from '../../modules/accounts/repositories/account.repository';
import { AccountRole } from '../../modules/accounts/enums';

/**
 * Seeder Orchestrator Service
 *
 * Coordinates the execution of database seeders during application bootstrap.
 * This service ensures that seeders run in the correct order to avoid race conditions.
 *
 * Idempotent Seeding Logic:
 * Before running any seeders, the orchestrator checks if the required data already exists.
 * Seeding is skipped only if the following condition is met:
 * - Admin: 1 Admin account exists
 *
 * If the count is insufficient, the orchestrator runs the admin seeder to fill the missing data.
 *
 * Execution Order:
 * 1. AdminSeederService - Seeds default admin account
 * 2. ClinicAdminSeederService - Seeds clinic admin (owns organization)
 * 3. AccountsSeederService - Seeds patients, managers, doctors, staff
 *
 * The orchestrator implements OnModuleInit and is the only seeder that runs automatically
 * during application startup. Individual seeder services expose public seed() methods
 * but do not implement OnModuleInit themselves.
 */
@Injectable()
export class SeederOrchestratorService implements OnModuleInit {
  private readonly logger = new Logger(SeederOrchestratorService.name);

  constructor(
    private readonly adminSeeder: AdminSeederService,
    private readonly clinicAdminSeeder: ClinicAdminSeederService,
    private readonly accountsSeeder: AccountsSeederService,
    private readonly accountRepository: AccountRepository,
  ) {}

  /**
   * Check if seed data already exists
   *
   * Verifies that all required data counts meet the minimum requirements.
   *
   * @returns {Promise<boolean>} True if all conditions are met, false otherwise
   */
  private async checkSeedDataExists(): Promise<boolean> {
    const adminCount = await this.accountRepository.countByRole(
      AccountRole.ADMIN,
    );
    const clinicAdminCount = await this.accountRepository.countByRole(
      AccountRole.CLINIC_ADMIN,
    );
    const managerCount = await this.accountRepository.countByRole(
      AccountRole.CLINIC_MANAGER,
    );

    this.logger.log(`Current data counts:`);
    this.logger.log(`  - Admins: ${adminCount} (required: 1)`);
    this.logger.log(`  - Clinic Admins: ${clinicAdminCount} (required: 1)`);
    this.logger.log(`  - Managers: ${managerCount} (required: 3)`);

    const allConditionsMet =
      adminCount >= 1 && clinicAdminCount >= 1 && managerCount >= 3;

    return allConditionsMet;
  }

  /**
   * Lifecycle hook - runs when module initializes
   *
   * Executes all seeders in sequential order to ensure data dependencies are satisfied.
   * Each seeder must complete before the next one starts.
   *
   * Idempotent Logic:
   * - Checks if required data already exists before running seeders
   * - Skips seeding if all conditions are met
   * - Runs seeders only if data is missing or insufficient
   */
  async onModuleInit(): Promise<void> {
    try {
      this.logger.log('🌱 Checking seed data status...');

      const seedDataExists = await this.checkSeedDataExists();

      if (seedDataExists) {
        this.logger.log('✅ Seed data already exists. Skipping seeding.');
        return;
      }

      this.logger.log('🌱 Starting database seeding process...');

      // Step 1: Seed admin account
      await this.adminSeeder.seed();
      this.logger.log('✅ Admin seeding completed');

      // Step 2: Seed clinic admin account
      await this.clinicAdminSeeder.seed();
      this.logger.log('✅ Clinic admin seeding completed');

      // Step 3: Seed patients, managers, doctors, staff
      await this.accountsSeeder.seed();
      this.logger.log('✅ Accounts seeding completed');

      this.logger.log('🎉 Database seeding process completed successfully');
    } catch (error) {
      this.logger.error('❌ Database seeding process failed', error.stack);
      throw error;
    }
  }
}
