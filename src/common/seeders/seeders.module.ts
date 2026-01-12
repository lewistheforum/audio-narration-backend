import { Module } from '@nestjs/common';
import { AccountsModule } from '../../modules/accounts/accounts.module';
import { ReportsModule } from '../../modules/reports/reports.module';
import { AdminSeederService } from './admin-seeder.service';
import { FeedbackSeederService } from './feedback-seeder.service';
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
 *
 * Individual seeder services expose public seed() methods but do not implement OnModuleInit.
 * Only SeederOrchestratorService implements OnModuleInit to coordinate the seeding process.
 */
@Module({
  imports: [AccountsModule, ReportsModule],
  providers: [
    AdminSeederService,
    FeedbackSeederService,
    SeederOrchestratorService,
  ],
  exports: [
    AdminSeederService,
    FeedbackSeederService,
    SeederOrchestratorService,
  ],
})
export class SeedersModule {}
