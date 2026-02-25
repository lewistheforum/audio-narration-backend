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
import { AiConversationSeederService } from './ai-conversation-seeder.service';
import { KnowledgeBaseSeederService } from './knowledge-base-seeder.service';
import { ClinicServiceCategorySeederService } from './clinic-service-category-seeder.service';
import { ClinicServiceSeederService } from './clinic-service-seeder.service';
import { ClinicServiceConfigSeederService } from './clinic-service-config-seeder.service';
import { SubscriptionServiceRepository } from '../../modules/subscriptions/repositories/subscription-service.repository';
import { ClinicServiceCategoryRepository } from '../../modules/clinic-services/repositories/clinic-service-category.repository';
import { ClinicServiceRepository } from '../../modules/clinic-services/repositories/clinic-service.repository';
import { ClinicRoomSeederService } from './clinic-room-seeder.service';
import { ClinicShiftSeederService } from './clinic-shift-seeder.service';
import { EmployeeScheduleSeederService } from './employee-schedule-seeder.service';
import { ClinicRoomEmployeeScheduleSeederService } from './clinic-room-employee-schedule-seeder.service';
import { AppointmentSeederService } from './appointment-seeder.service';
import { ERMSeederService } from './erm-seeder.service';
import { EPrescriptionSeederService } from './e-prescription-seeder.service';
import { EPrescriptionDetailSeederService } from './e-prescription-detail-seeder.service';
import { TransactionHistorySeederService } from './transaction-history-seeder.service';
import { ReportSeederService } from './report-seeder.service';

/**
 * Seeder Orchestrator Service
 *
 * Coordinates the execution of database seeders during application bootstrap.
 * This service ensures that seeders run in the correct order to avoid race conditions.
 *
 * Idempotent Seeding Logic:
 * Before running any seeders, the orchestrator checks if the required data already exists.
 * Seeding is skipped only if the following conditions are met for deterministic seeders:
 * - Admin: 1 Admin account exists
 * - CLINIC_ADMIN: 5 CLINIC_ADMIN accounts exist
 * - PATIENT: 10 PATIENT accounts exist
 * - SubscriptionService: 4 SubscriptionService records exist (BASIC, STANDARD, PREMIUM, ENTERPRISE)
 * - ClinicServiceCategory: 6 ClinicServiceCategory records exist (1 per ServiceCategoryType)
 * - ClinicService: 12 ClinicService records exist (2 CONSULTATION, 2 ULTRASOUND, 2 XRAY, 2 LAB, 1 BONE_DENSITY, 3 PROCEDURE)
 *
 * Note: Variable/random seeders are NOT included in the idempotency check:
 * - CLINIC_MANAGER, CLINIC_STAFF, DOCTOR accounts (random counts)
 * - ClinicManagerInformation, ClinicStaffInformation, DoctorInformation
 * - ClinicsLegalDocuments, Address, GoogleIframe
 * - ContractPackage, ClinicContractInformation
 * - ClinicSubscriptionHistory (0-2 per clinic)
 * - Feedback (random per clinic)
 * - Blog (3-5 per clinic)
 * - ClinicServiceConfig (8 per clinic)
 *
 * The check only validates deterministic seeders with fixed data counts.
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
 * 5. ClinicsLegalDocumentsSeederService - Seeds ClinicsLegalDocuments records
 * 6. AddressSeederService - Seeds Address records
 * 7. GoogleIframeSeederService - Seeds GoogleIframe records
 * 8. ContractPackageSeederService - Seeds ContractPackage records
 * 9. ClinicContractInformationSeederService - Seeds ClinicContractInformation records
 * 10. ClinicStaffInformationSeederService - Seeds ClinicStaffInformation records
 * 11. DoctorInformationSeederService - Seeds DoctorInformation records
 * 12. GeneralAccountSeederService - Seeds GeneralAccount records for PATIENT accounts
 * 13. FeedbackSeederService - Seeds random feedback records (not part of idempotency check)
 * 14. BlogSeederService - Seeds blog records (not part of idempotency check)
 * 15. SubscriptionServiceSeederService - Seeds SubscriptionService records
 * 16. SubscriptionsSeederService - Seeds ClinicSubscription and ClinicSubscriptionHistory records
 * 17. ClinicServiceCategorySeederService - Seeds ClinicServiceCategory records
 * 18. ClinicServiceSeederService - Seeds ClinicService records
 * 19. ClinicServiceConfigSeederService - Seeds ClinicServiceConfig records (not part of idempotency check)
 * 20. TransactionHistorySeederService - Seeds Transaction and ClinicSubscriptionHistory records
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
    private readonly subscriptionServiceRepository: SubscriptionServiceRepository,
    private readonly clinicServiceCategoryRepository: ClinicServiceCategoryRepository,
    private readonly clinicServiceRepository: ClinicServiceRepository,
    private readonly aiConversationSeeder: AiConversationSeederService,
    private readonly knowledgeBaseSeeder: KnowledgeBaseSeederService,
    private readonly clinicRoomSeeder: ClinicRoomSeederService,
    private readonly clinicShiftSeeder: ClinicShiftSeederService,
    private readonly employeeScheduleSeeder: EmployeeScheduleSeederService,
    private readonly clinicRoomEmployeeScheduleSeeder: ClinicRoomEmployeeScheduleSeederService,
    private readonly appointmentSeeder: AppointmentSeederService,
    private readonly ermSeeder: ERMSeederService,
    private readonly ePrescriptionSeeder: EPrescriptionSeederService,
    private readonly ePrescriptionDetailSeeder: EPrescriptionDetailSeederService,
    private readonly transactionHistorySeeder: TransactionHistorySeederService,
    private readonly reportSeeder: ReportSeederService,
  ) {}

  /**
   * Check if seed data already exists
   *
   * Verifies that all required data counts meet the minimum requirements for
   * deterministic seeders. Only checks for:
   * - Admin accounts (≥1)
   * - CLINIC_ADMIN accounts (≥5)
   * - PATIENT accounts (≥10)
   * - SubscriptionService records (≥4 - BASIC, STANDARD, PREMIUM, ENTERPRISE)
   * - ClinicServiceCategory records (≥6 - 1 per ServiceCategoryType)
   * - ClinicService records (≥12 - 2 CONSULTATION, 2 ULTRASOUND, 2 XRAY, 2 LAB, 1 BONE_DENSITY, 3 PROCEDURE)
   *
   * Note: Variable/random seeders are NOT validated in this check:
   * - CLINIC_MANAGER, CLINIC_STAFF, DOCTOR accounts (random counts)
   * - ClinicManagerInformation, ClinicStaffInformation, DoctorInformation
   * - ClinicsLegalDocuments, Address, GoogleIframe
   * - ContractPackage, ClinicContractInformation
   * - ClinicSubscriptionHistory (0-2 per clinic)
   * - Feedback (random per clinic)
   * - Blog (3-5 per clinic)
   * - ClinicServiceConfig (8 per clinic)
   *
   * The idempotency check only applies to seeders with deterministic data.
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
    const subscriptionServiceCount =
      await this.subscriptionServiceRepository.count();
    const clinicServiceCategoryCount =
      await this.clinicServiceCategoryRepository.count();
    const clinicServiceCount = await this.clinicServiceRepository.count();

    this.logger.log(`Current data counts:`);
    this.logger.log(`  - Admins: ${adminCount} (required: 1)`);
    this.logger.log(`  - Clinic Admins: ${clinicAdminCount} (required: 8)`);
    this.logger.log(`  - Patients: ${patientCount} (required: 10)`);
    this.logger.log(
      `  - Subscription Services: ${subscriptionServiceCount} (required: 4)`,
    );
    this.logger.log(
      `  - Clinic Service Categories: ${clinicServiceCategoryCount} (required: 6)`,
    );
    this.logger.log(
      `  - Clinic Services: ${clinicServiceCount} (required: 12)`,
    );

    const allConditionsMet =
      adminCount >= 1 &&
      clinicAdminCount >= 8 &&
      patientCount >= 10 &&
      subscriptionServiceCount >= 4 &&
      clinicServiceCategoryCount >= 6 &&
      clinicServiceCount >= 12;

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
        // await this.aiConversationSeeder.seed();
        this.logger.log(
          '✅ AI Conversation seeding completed (Incremental update)',
        );

        // Ensure Knowledge Base is seeded/updated even if other data exists
        // await this.knowledgeBaseSeeder.seed();
        this.logger.log(
          '✅ Knowledge Base seeding completed (Incremental update)',
        );
        return;
      }

      this.logger.log('🌱 Starting database seeding process...');

      // Step 1: Seed admin account
      await this.adminSeeder.seed();
      this.logger.log('✅ Admin seeding completed');

      // Step 2: Seed base account types (Admin, ClinicAdmin, Manager, Patient)
      await this.accountSeeder.seedBaseAccounts();
      this.logger.log('✅ Base Account seeding completed');

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

      // Now that Base Accounts and basic legal docs/addresses are seeded, we seed Subscriptions
      // Step 8: Seed subscription services
      await this.subscriptionServiceSeeder.seed();
      this.logger.log('✅ SubscriptionService seeding completed');

      // Step 9: Seed clinic subscriptions and subscription history
      await this.subscriptionsSeeder.seed();
      this.logger.log('✅ Clinic subscriptions seeding completed');

      // Now that Subscriptions exist (identifying ACTIVE clinics), we seed Employee accounts (Staff, Doctors)
      // Step 10: Seed Employee Accounts (Staff and Doctors)
      await this.accountSeeder.seedEmployeeAccounts();
      this.logger.log('✅ Employee Account seeding completed');

      // Step 11: Seed ContractPackage for CLINIC_STAFF and DOCTOR
      await this.contractPackageSeeder.seed();
      this.logger.log('✅ ContractPackage seeding completed');

      // Step 12: Seed ClinicContractInformation for CLINIC_STAFF and DOCTOR
      await this.clinicContractInformationSeeder.seed();
      this.logger.log('✅ ClinicContractInformation seeding completed');

      // Step 13: Seed ClinicStaffInformation
      await this.clinicStaffInfoSeeder.seed();
      this.logger.log('✅ ClinicStaffInformation seeding completed');

      // Step 14: Seed DoctorInformation
      await this.doctorInfoSeeder.seed();
      this.logger.log('✅ DoctorInformation seeding completed');

      // Step 12: Seed GeneralAccount for PATIENT accounts
      await this.generalAccountSeeder.seed();
      this.logger.log('✅ GeneralAccount seeding completed');

      // Step 14: Seed AI conversations
      await this.aiConversationSeeder.seed();
      this.logger.log('✅ AI Conversation seeding completed');

      // Step 15: Seed blog records
      await this.blogSeeder.seed();
      this.logger.log('✅ Blog seeding completed');

      // The subscription seeders were already moved up above employees.
      // So we skip step 16 and 17 here.

      // Step 18: Seed clinic service categories
      await this.clinicServiceCategorySeeder.seed();
      this.logger.log('✅ ClinicServiceCategory seeding completed');

      // Step 19: Seed clinic services
      await this.clinicServiceSeeder.seed();
      this.logger.log('✅ ClinicService seeding completed');

      // Step 20: Seed clinic service configs
      await this.clinicServiceConfigSeeder.seed();
      this.logger.log('✅ ClinicServiceConfig seeding completed');

      // Step 21: Seed clinic rooms
      await this.clinicRoomSeeder.seed();
      this.logger.log('✅ ClinicRoom seeding completed');

      // Step 22: Seed clinic shifts and shift hours
      await this.clinicShiftSeeder.seed();
      this.logger.log('✅ ClinicShift seeding completed');

      // Step 23: Seed employee schedules
      await this.employeeScheduleSeeder.seed();
      this.logger.log('✅ EmployeeSchedule seeding completed');

      // Step 24: Seed clinic room employee schedule assignments
      await this.clinicRoomEmployeeScheduleSeeder.seed();
      this.logger.log('✅ ClinicRoomEmployeeSchedule seeding completed');

      // Step 25: Seed Knowledge Base - MUST RUN LAST after all other data is seeded
      await this.knowledgeBaseSeeder.seed();
      this.logger.log('✅ Knowledge Base seeding completed');

      // Step 26: Seed Appointments (must run after all other data is seeded)
      await this.appointmentSeeder.seed();
      this.logger.log('✅ Appointment seeding completed');

      // Step 27: Seed ERMs (must run after appointments)
      await this.ermSeeder.seed();
      this.logger.log('✅ ERM seeding completed');

      // Step 28: Seed E-Prescriptions (must run after appointments)
      await this.ePrescriptionSeeder.seed();
      this.logger.log('✅ E-Prescription seeding completed');

      // Step 29: Seed E-Prescription Details (must run after e-prescriptions)
      await this.ePrescriptionDetailSeeder.seed();
      this.logger.log('✅ E-Prescription Detail seeding completed');

      // Step 30: Seed Transaction History
      await this.transactionHistorySeeder.seed();
      this.logger.log('✅ Transaction history seeding completed');

      // Step 31: Validate seeded appointment data
      await this.validateAppointmentData();
      this.logger.log('✅ Appointment data validation completed');

      // Step 32: Seed feedback records
      await this.feedbackSeeder.seed();
      this.logger.log('✅ Feedback seeding completed');

      // Step 33: Seed report records
      await this.reportSeeder.seed();
      this.logger.log('✅ Report seeding completed');

      this.logger.log('🎉 Database seeding process completed successfully');
    } catch (error) {
      this.logger.error('❌ Database seeding process failed', error.stack);
      throw error;
    }
  }

  /**
   * Validate appointment-related data after seeding
   *
   * Checks:
   * - Every appointment has status COMPLETED
   * - Every appointment has exactly one e_prescription
   * - Every ERM references a valid appointment and has compatible status
   * - Every appointment's patient account has role PATIENT
   */
  private async validateAppointmentData(): Promise<void> {
    const errors: string[] = [];

    // Validate appointments
    const appointmentValidation =
      await this.appointmentSeeder.validateAppointments();
    errors.push(...appointmentValidation.errors);

    // Validate ERMs
    const ermValidation = await this.ermSeeder.validateERMs();
    errors.push(...ermValidation.errors);

    // Validate e-prescriptions
    const ePrescriptionValidation =
      await this.ePrescriptionSeeder.validateEPrescriptions();
    errors.push(...ePrescriptionValidation.errors);

    // Validate e-prescription details
    const ePrescriptionDetailValidation =
      await this.ePrescriptionDetailSeeder.validateEPrescriptionDetails();
    errors.push(...ePrescriptionDetailValidation.errors);

    if (errors.length > 0) {
      this.logger.warn('Appointment data validation found issues:');
      errors.forEach((error) => this.logger.warn(`  - ${error}`));
    } else {
      this.logger.log('✅ All appointment data validation checks passed');
    }
  }
}
