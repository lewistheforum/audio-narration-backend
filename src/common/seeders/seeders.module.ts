import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AccountsModule } from '../../modules/accounts/accounts.module';
import { ReportsModule } from '../../modules/reports/reports.module';
import { AdminSeederService } from './admin-seeder.service';
import { ClinicAdminSeederService } from './clinic-admin-seeder.service';
import { AccountsSeederService } from './accounts-seeder.service';
import { FeedbackSeederService } from './feedback-seeder.service';
import { SeederOrchestratorService } from './seeder-orchestrator.service';
import { AddressDataService } from './address-data.service';

/**
 * Seeders Module
 *
 * Provides database seeding services for initial data setup.
 * This module is imported in AppModule to automatically run seeders
 * on application startup via the SeederOrchestratorService's OnModuleInit lifecycle hook.
 *
 * The orchestrator ensures sequential execution of all seeders to avoid race conditions:
 * 1. AdminSeederService: Seeds default admin account
 * 2. ClinicAdminSeederService: Seeds clinic admin (owns organization)
 * 3. AccountsSeederService: Seeds patients, managers, doctors, staff
 * 4. FeedbackSeederService: Seeds feedback data (optional)
 *
 * Individual seeder services expose public seed() methods but do not implement OnModuleInit.
 * Only SeederOrchestratorService implements OnModuleInit to coordinate the seeding process.
 */
@Module({
  imports: [HttpModule, AccountsModule, ReportsModule],
  providers: [
    AddressDataService,
    AdminSeederService,
    ClinicAdminSeederService,
    AccountsSeederService,
    FeedbackSeederService,
    SeederOrchestratorService,
  ],
  exports: [
    AddressDataService,
    AdminSeederService,
    ClinicAdminSeederService,
    AccountsSeederService,
    FeedbackSeederService,
    SeederOrchestratorService,
  ],
})
export class SeedersModule {}
