import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AdminSeederService } from './admin-seeder.service';
import { AccountSeederService } from './account-seeder.service';
import { ClinicAdminInformationSeederService } from './clinic-admin-information-seeder.service';
import { ClinicManagerInformationSeederService } from './clinic-manager-information-seeder.service';
import { ClinicStaffInformationSeederService } from './clinic-staff-information-seeder.service';
import { DoctorInformationSeederService } from './doctor-information-seeder.service';
import { GeneralAccountSeederService } from './general-account-seeder.service';
import { FeedbackSeederService } from './feedback-seeder.service';
import { BlogSeederService } from './blog-seeder.service';
import { SubscriptionServiceSeederService } from './subscription-service-seeder.service';
import { SubscriptionsSeederService } from './subscriptions-seeder.service';
import { AccountRepository } from '../../modules/accounts/repositories/account.repository';
import { AccountRole } from '../../modules/accounts/enums';
import { ClinicsLegalDocumentsSeederService } from './clinics-legal-documents-seeder.service';
import { AddressSeederService } from './address-seeder.service';
import { GoogleIframeSeederService } from './google-iframe-seeder.service';
import { ContractPackageSeederService } from './contract-package-seeder.service';
import { ClinicContractInformationSeederService } from './clinic-contract-information-seeder.service';
import { ClinicServiceCategorySeederService } from './clinic-service-category-seeder.service';
import { ClinicServiceSeederService } from './clinic-service-seeder.service';
import { ClinicServiceConfigSeederService } from './clinic-service-config-seeder.service';

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
 * 5. ClinicsLegalDocumentsSeederService - Seeds ClinicsLegalDocuments records
 * 6. AddressSeederService - Seeds Address records
 * 7. GoogleIframeSeederService - Seeds GoogleIframe records
 * 8. ContractPackageSeederService - Seeds ContractPackage records
 * 9. ClinicContractInformationSeederService - Seeds ClinicContractInformation records
 * 10. ClinicStaffInformationSeederService - Seeds ClinicStaffInformation records
 * 11. DoctorInformationSeederService - Seeds DoctorInformation records
 * 12. GeneralAccountSeederService - Seeds GeneralAccount records for PATIENT accounts
 * 13. FeedbackSeederService - Seeds feedback records
 * 14. BlogSeederService - Seeds blog records
 * 15. SubscriptionServiceSeederService - Seeds SubscriptionService records
 * 16. SubscriptionsSeederService - Seeds ClinicSubscription and ClinicSubscriptionHistory records
 * 17. ClinicServiceCategorySeederService - Seeds ClinicServiceCategory records
 * 18. ClinicServiceSeederService - Seeds ClinicService records
 * 19. ClinicServiceConfigSeederService - Seeds ClinicServiceConfig records
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
    private readonly blogSeeder: BlogSeederService,
    private readonly subscriptionServiceSeeder: SubscriptionServiceSeederService,
    private readonly subscriptionsSeeder: SubscriptionsSeederService,
    private readonly clinicServiceCategorySeeder: ClinicServiceCategorySeederService,
    private readonly clinicServiceSeeder: ClinicServiceSeederService,
    private readonly clinicServiceConfigSeeder: ClinicServiceConfigSeederService,
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
        this.logger.log('✅ Seed data already exists. Skipping seeding.');
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

      // Step 12: Seed GeneralAccount for PATIENT accounts
      await this.generalAccountSeeder.seed();
      this.logger.log('✅ GeneralAccount seeding completed');

      // Step 13: Seed feedback records
      await this.feedbackSeeder.seed();
      this.logger.log('✅ Feedback seeding completed');

      // Step 14: Seed blog records
      await this.blogSeeder.seed();
      this.logger.log('✅ Blog seeding completed');

      // Step 15: Seed subscription services
      await this.subscriptionServiceSeeder.seed();
      this.logger.log('✅ SubscriptionService seeding completed');

      // Step 16: Seed clinic subscriptions and subscription history
      await this.subscriptionsSeeder.seed();
      this.logger.log('✅ Clinic subscriptions seeding completed');

      // Step 17: Seed clinic service categories
      await this.clinicServiceCategorySeeder.seed();
      this.logger.log('✅ ClinicServiceCategory seeding completed');

      // Step 18: Seed clinic services
      await this.clinicServiceSeeder.seed();
      this.logger.log('✅ ClinicService seeding completed');

      // Step 19: Seed clinic service configs
      await this.clinicServiceConfigSeeder.seed();
      this.logger.log('✅ ClinicServiceConfig seeding completed');

      this.logger.log('🎉 Database seeding process completed successfully');
    } catch (error) {
      this.logger.error('❌ Database seeding process failed', error.stack);
      throw error;
    }
  }
}
