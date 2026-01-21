import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AdminSeederService } from './admin-seeder.service';
import { AccountSeederService } from './account-seeder.service';
import { ClinicAdminInformationSeederService } from './clinic-admin-information-seeder.service';
import { ClinicManagerInformationSeederService } from './clinic-manager-information-seeder.service';
import { ClinicStaffInformationSeederService } from './clinic-staff-information-seeder.service';
import { DoctorInformationSeederService } from './doctor-information-seeder.service';
import { GeneralAccountSeederService } from './general-account-seeder.service';
import { FeedbackSeederService } from './feedback-seeder.service';
import { AccountRepository } from '../../modules/accounts/repositories/account.repository';
import { AccountRole } from '../../modules/accounts/enums';
import { ClinicsLegalDocumentsSeederService } from './clinics-legal-documents-seeder.service';
import { AddressSeederService } from './address-seeder.service';
import { GoogleIframeSeederService } from './google-iframe-seeder.service';
import { ContractPackageSeederService } from './contract-package-seeder.service';
import { ClinicContractInformationSeederService } from './clinic-contract-information-seeder.service';
import { AiConversationSeederService } from './ai-conversation-seeder.service';
import { KnowledgeBaseSeederService } from './knowledge-base-seeder.service';

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
 * - CLINIC_ADMIN: 5 CLINIC_ADMIN accounts exist
 * - PATIENT: 10 PATIENT accounts exist
 *
 * If the count is insufficient, the orchestrator runs the seeders to fill the missing data.
 *
 * Execution Order:
 * 1. AdminSeederService - Seeds default admin account
 * 2. AccountSeederService - Seeds all account roles (CLINIC_ADMIN, CLINIC_MANAGER, CLINIC_STAFF, DOCTOR, PATIENT)
 * 3. ClinicAdminInformationSeederService - Seeds ClinicAdminInformation records
 * 4. ClinicManagerInformationSeederService - Seeds ClinicManagerInformation records
 * 5. ClinicStaffInformationSeederService - Seeds ClinicStaffInformation records
 * 6. DoctorInformationSeederService - Seeds DoctorInformation records
 * 7. GeneralAccountSeederService - Seeds GeneralAccount records for PATIENT accounts
 * 8. FeedbackSeederService - Seeds feedback records
 * 9. AiConversationSeederService - Seeds AI conversations and messages
 * 10. KnowledgeBaseSeederService - Seeds system information into Knowledge Base
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
    private readonly accountSeeder: AccountSeederService,
    private readonly clinicAdminInfoSeeder: ClinicAdminInformationSeederService,
    private readonly clinicManagerInfoSeeder: ClinicManagerInformationSeederService,
    private readonly clinicsLegalDocumentsSeeder: ClinicsLegalDocumentsSeederService,
    private readonly addressSeeder: AddressSeederService,
    private readonly googleIframeSeeder: GoogleIframeSeederService,
    private readonly contractPackageSeeder: ContractPackageSeederService,
    private readonly clinicContractInformationSeeder: ClinicContractInformationSeederService,
    private readonly clinicStaffInfoSeeder: ClinicStaffInformationSeederService,
    private readonly doctorInfoSeeder: DoctorInformationSeederService,
    private readonly generalAccountSeeder: GeneralAccountSeederService,
    private readonly feedbackSeeder: FeedbackSeederService,
    private readonly aiConversationSeeder: AiConversationSeederService,
    private readonly knowledgeBaseSeeder: KnowledgeBaseSeederService,
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
    const patientCount = await this.accountRepository.countByRole(
      AccountRole.PATIENT,
    );

    this.logger.log(`Current data counts:`);
    this.logger.log(`  - Admins: ${adminCount} (required: 1)`);
    this.logger.log(`  - Clinic Admins: ${clinicAdminCount} (required: 5)`);
    this.logger.log(`  - Patients: ${patientCount} (required: 10)`);

    const allConditionsMet =
      adminCount >= 1 && clinicAdminCount >= 5 && patientCount >= 10;

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
        this.logger.log('✅ Seed data already exists.');

        // Ensure AI conversations are seeded even if other data exists
        await this.aiConversationSeeder.seed();
        this.logger.log(
          '✅ AI Conversation seeding completed (Incremental update)',
        );
        return;
      }

      this.logger.log('🌱 Starting database seeding process...');

      // Step 1: Seed admin account
      await this.adminSeeder.seed();
      this.logger.log('✅ Admin seeding completed');

      // Step 2: Seed all account types
      await this.accountSeeder.seed();
      this.logger.log('✅ Account seeding completed');

      // Step 3: Seed ClinicAdminInformation
      await this.clinicAdminInfoSeeder.seed();
      this.logger.log('✅ ClinicAdminInformation seeding completed');

      // Step 4: Seed ClinicManagerInformation
      await this.clinicManagerInfoSeeder.seed();
      this.logger.log('✅ ClinicManagerInformation seeding completed');

      // Step 5: Seed ClinicsLegalDocuments for CLINIC_MANAGER
      await this.clinicsLegalDocumentsSeeder.seed();
      this.logger.log('✅ ClinicsLegalDocuments seeding completed');

      // Step 6: Seed Address for CLINIC_MANAGER
      await this.addressSeeder.seed();
      this.logger.log('✅ Address seeding completed');

      // Step 7: Seed GoogleIframe for addresses
      await this.googleIframeSeeder.seed();
      this.logger.log('✅ GoogleIframe seeding completed');

      // Step 8: Seed ContractPackage for CLINIC_STAFF and DOCTOR
      await this.contractPackageSeeder.seed();
      this.logger.log('✅ ContractPackage seeding completed');

      // Step 9: Seed ClinicContractInformation for CLINIC_STAFF and DOCTOR
      await this.clinicContractInformationSeeder.seed();
      this.logger.log('✅ ClinicContractInformation seeding completed');

      // Step 10: Seed ClinicStaffInformation
      await this.clinicStaffInfoSeeder.seed();
      this.logger.log('✅ ClinicStaffInformation seeding completed');

      // Step 11: Seed DoctorInformation
      await this.doctorInfoSeeder.seed();
      this.logger.log('✅ DoctorInformation seeding completed');

      // Step 7: Seed GeneralAccount for PATIENT accounts
      await this.generalAccountSeeder.seed();
      this.logger.log('✅ GeneralAccount seeding completed');

      // Step 8: Seed feedback records
      await this.feedbackSeeder.seed();
      this.logger.log('✅ Feedback seeding completed');

      // Step 10: Seed AI conversations
      await this.aiConversationSeeder.seed();
      this.logger.log('✅ AI Conversation seeding completed');

      // Step 11: Seed Knowledge Base
      await this.knowledgeBaseSeeder.seed();
      this.logger.log('✅ Knowledge Base seeding completed');

      this.logger.log('🎉 Database seeding process completed successfully');
    } catch (error) {
      this.logger.error('❌ Database seeding process failed', error.stack);
      throw error;
    }
  }
}
