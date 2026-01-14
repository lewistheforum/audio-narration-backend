import { Module } from '@nestjs/common';
import { AccountsModule } from '../../modules/accounts/accounts.module';
import { ReportsModule } from '../../modules/reports/reports.module';
import { AdminSeederService } from './admin-seeder.service';
import { FeedbackSeederService } from './feedback-seeder.service';
import { AccountSeederService } from './account-seeder.service';
import { ClinicAdminInformationSeederService } from './clinic-admin-information-seeder.service';
import { ClinicManagerInformationSeederService } from './clinic-manager-information-seeder.service';
import { ClinicStaffInformationSeederService } from './clinic-staff-information-seeder.service';
import { DoctorInformationSeederService } from './doctor-information-seeder.service';
import { GeneralAccountSeederService } from './general-account-seeder.service';
import { ClinicsLegalDocumentsSeederService } from './clinics-legal-documents-seeder.service';
import { AddressSeederService } from './address-seeder.service';
import { GoogleIframeSeederService } from './google-iframe-seeder.service';
import { ContractPackageSeederService } from './contract-package-seeder.service';
import { ClinicContractInformationSeederService } from './clinic-contract-information-seeder.service';
import { SeederOrchestratorService } from './seeder-orchestrator.service';

/**
 * Seeders Module
 *
 * Provides database seeding services for initial data setup.
 * This module is imported in AppModule to automatically run seeders
 * on application startup via the SeederOrchestratorService's OnModuleInit lifecycle hook.
 *
 * The orchestrator ensures sequential execution of all seeders to avoid race conditions:
 * 1. AdminSeederService: Seeds default admin account
 * 2. AccountSeederService: Seeds all account roles (CLINIC_ADMIN, CLINIC_MANAGER, CLINIC_STAFF, DOCTOR, PATIENT)
 * 3. ClinicAdminInformationSeederService: Seeds ClinicAdminInformation records
 * 4. ClinicManagerInformationSeederService: Seeds ClinicManagerInformation records
 * 5. ClinicStaffInformationSeederService: Seeds ClinicStaffInformation records
 * 6. DoctorInformationSeederService: Seeds DoctorInformation records
 * 7. GeneralAccountSeederService: Seeds GeneralAccount records for PATIENT accounts
 * 8. FeedbackSeederService: Seeds feedback records
 *
 * Individual seeder services expose public seed() methods but do not implement OnModuleInit.
 * Only SeederOrchestratorService implements OnModuleInit to coordinate the seeding process.
 */
@Module({
  imports: [AccountsModule, ReportsModule],
  providers: [
    AdminSeederService,
    AccountSeederService,
    ClinicAdminInformationSeederService,
    ClinicManagerInformationSeederService,
    ClinicsLegalDocumentsSeederService,
    AddressSeederService,
    GoogleIframeSeederService,
    ContractPackageSeederService,
    ClinicContractInformationSeederService,
    ClinicStaffInformationSeederService,
    DoctorInformationSeederService,
    GeneralAccountSeederService,
    FeedbackSeederService,
    SeederOrchestratorService,
  ],
  exports: [
    AdminSeederService,
    AccountSeederService,
    ClinicAdminInformationSeederService,
    ClinicManagerInformationSeederService,
    ClinicsLegalDocumentsSeederService,
    AddressSeederService,
    GoogleIframeSeederService,
    ContractPackageSeederService,
    ClinicContractInformationSeederService,
    ClinicStaffInformationSeederService,
    DoctorInformationSeederService,
    GeneralAccountSeederService,
    FeedbackSeederService,
    SeederOrchestratorService,
  ],
})
export class SeedersModule {}
