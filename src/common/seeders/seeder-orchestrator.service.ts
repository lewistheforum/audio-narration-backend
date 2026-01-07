import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AdminSeederService } from './admin-seeder.service';
import { PatientManagerSeederService } from './patient-manager-seeder.service';
import { FeedbackSeederService } from './feedback-seeder.service';
import { AccountRepository } from '../../modules/accounts/repositories/account.repository';
import { FeedbackRepository } from '../../modules/reports/repositories/feedback.repository';
import { AccountRole } from '../../modules/accounts/enums';

/**
 * Seeder Orchestrator Service
 *
 * Coordinates the sequential execution of all database seeders during application bootstrap.
 * This service ensures that seeders run in the correct order to avoid race conditions.
 *
 * Idempotent Seeding Logic:
 * Before running any seeders, the orchestrator checks if the required data already exists.
 * Seeding is skipped only if ALL the following conditions are met:
 * - Admin: 1 Admin account exists
 * - Patients: At least 3 Patient accounts exist
 * - Clinics: At least 3 Clinic Manager accounts exist
 * - Feedbacks: At least 45 feedbacks exist (3 clinics * 15 feedbacks each)
 *
 * If any count is insufficient, the orchestrator runs the relevant seeders to fill the missing data.
 *
 * Execution Order:
 * 1. AdminSeederService - Seeds default admin account
 * 2. PatientManagerSeederService - Seeds patient and clinic manager accounts (creates clinics)
 * 3. FeedbackSeederService - Seeds feedbacks for clinics (requires clinics to exist)
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
    private readonly patientManagerSeeder: PatientManagerSeederService,
    private readonly feedbackSeeder: FeedbackSeederService,
    private readonly accountRepository: AccountRepository,
    private readonly feedbackRepository: FeedbackRepository,
  ) {}

  /**
   * Check if seed data already exists
   *
   * Verifies that all required data counts meet the minimum requirements.
   *
   * @returns {Promise<boolean>} True if all conditions are met, false otherwise
   */
  private async checkSeedDataExists(): Promise<boolean> {
    const [adminCount, patientCount, clinicCount, feedbackCount] =
      await Promise.all([
        this.accountRepository.countByRole(AccountRole.ADMIN),
        this.accountRepository.countByRole(AccountRole.PATIENT),
        this.accountRepository.countByRole(AccountRole.CLINIC_MANAGER),
        this.feedbackRepository.countFeedbacks(),
      ]);

    this.logger.log(`Current data counts:`);
    this.logger.log(`  - Admins: ${adminCount} (required: 1)`);
    this.logger.log(`  - Patients: ${patientCount} (required: 3)`);
    this.logger.log(`  - Clinics: ${clinicCount} (required: 3)`);
    this.logger.log(`  - Feedbacks: ${feedbackCount} (required: 45)`);

    const allConditionsMet =
      adminCount >= 1 &&
      patientCount >= 3 &&
      clinicCount >= 3 &&
      feedbackCount >= 45;

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

      // Step 2: Seed patient and manager accounts (creates clinics)
      await this.patientManagerSeeder.seed();
      this.logger.log('✅ Patient and Manager seeding completed');

      // Step 3: Seed feedbacks (requires clinics to exist)
      await this.feedbackSeeder.seed();
      this.logger.log('✅ Feedback seeding completed');

      this.logger.log('🎉 Database seeding process completed successfully');
    } catch (error) {
      this.logger.error('❌ Database seeding process failed', error.stack);
      throw error;
    }
  }
}
