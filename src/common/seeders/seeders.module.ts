import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountsModule } from '../../modules/accounts/accounts.module';
import { ReportsModule } from '../../modules/reports/reports.module';
import { ChatBotModule } from '../../modules/ai-rag-chat-bot/chat-bot.module';

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
import { AiConversationSeederService } from './ai-conversation-seeder.service';
import { KnowledgeBaseSeederService } from './knowledge-base-seeder.service';
import { KnowledgeBaseRepository } from '../../modules/ai-rag-chat-bot/repositories/knowledge-base.repository';

// Entities for KnowledgeBaseSeeder
import { DoctorInformation } from '../../modules/accounts/entities/doctor_information.entity';
import { ClinicAdminInformation } from '../../modules/accounts/entities/clinic-admin-information.entity';
import { Feedback } from '../../modules/reports/entities/feedback.entity';
import { ClinicServiceConfig } from '../../modules/service-configs/entities/clinic-service-config.entity';
import { EmployeeSchedule } from '../../modules/schedules/entities/employee-schedule.entity';
import { ClinicShift } from '../../modules/schedules/entities/clinic-shift.entity';
import { ClinicShiftHour } from '../../modules/schedules/entities/clinic-shift-hour.entity';
import { ClinicRoom } from '../../modules/accounts/entities/clinic_room.entity';

@Module({
  imports: [
    AccountsModule,
    ReportsModule,
    ChatBotModule,
    TypeOrmModule.forFeature([
      DoctorInformation,
      ClinicAdminInformation,
      Feedback,
      ClinicServiceConfig,
      EmployeeSchedule,
      ClinicShift,
      ClinicShiftHour,
      ClinicRoom,
    ]),
  ],
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
    AiConversationSeederService,
    KnowledgeBaseSeederService,
    SeederOrchestratorService,
    KnowledgeBaseRepository,
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
    AiConversationSeederService,
    KnowledgeBaseSeederService,
    SeederOrchestratorService,
  ],
})
export class SeedersModule {}
