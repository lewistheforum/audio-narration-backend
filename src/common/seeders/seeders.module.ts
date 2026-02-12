import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { AccountsModule } from '../../modules/accounts/accounts.module';
import { ReportsModule } from '../../modules/reports/reports.module';
import { ChatBotModule } from '../../modules/ai-rag-chat-bot/chat-bot.module';

import { BlogsModule } from '../../modules/blogs/blogs.module';
import { SubscriptionsModule } from '../../modules/subscriptions/subscriptions.module';
import { ClinicServicesModule } from '../../modules/clinic-services/clinic-services.module';
import { ServiceConfigsModule } from '../../modules/service-configs/service-configs.module';
import { ContractsModule } from '../../modules/contracts/contracts.module';
import { SchedulesModule } from '../../modules/schedules/schedules.module';
import { PrescriptionsModule } from '../../modules/prescriptions/prescriptions.module';
import { AppointmentsModule } from '../../modules/appointments/appointments.module';
import { TransactionsModule } from '../../modules/transactions/transactions.module';
import { TransactionHistorySeederService } from './transaction-history-seeder.service';
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
import { BlogSeederService } from './blog-seeder.service';
import { SubscriptionServiceSeederService } from './subscription-service-seeder.service';
import { SubscriptionsSeederService } from './subscriptions-seeder.service';
import { ClinicServiceCategorySeederService } from './clinic-service-category-seeder.service';
import { ClinicServiceSeederService } from './clinic-service-seeder.service';
import { ClinicServiceConfigSeederService } from './clinic-service-config-seeder.service';
import { SeederOrchestratorService } from './seeder-orchestrator.service';
import { AiConversationSeederService } from './ai-conversation-seeder.service';
import { KnowledgeBaseSeederService } from './knowledge-base-seeder.service';
import { KnowledgeBaseRepository } from '../../modules/ai-rag-chat-bot/repositories/knowledge-base.repository';
import { ClinicRoomSeederService } from './clinic-room-seeder.service';
import { ClinicShiftSeederService } from './clinic-shift-seeder.service';
import { EmployeeScheduleSeederService } from './employee-schedule-seeder.service';
import { ClinicRoomEmployeeScheduleSeederService } from './clinic-room-employee-schedule-seeder.service';
import { ClinicRoomRepository } from '../../modules/schedules/repositories/clinic-room.repository';
import { ClinicShiftRepository } from '../../modules/schedules/repositories/clinic-shift.repository';
import { ClinicShiftHourRepository } from '../../modules/schedules/repositories/clinic-shift-hour.repository';
import { EmployeeScheduleRepository } from '../../modules/schedules/repositories/employee-schedule.repository';
import { AppointmentSeederService } from './appointment-seeder.service';
import { ERMSeederService } from './erm-seeder.service';
import { EPrescriptionSeederService } from './e-prescription-seeder.service';
import { EPrescriptionDetailSeederService } from './e-prescription-detail-seeder.service';

// Entities for KnowledgeBaseSeeder
import { DoctorInformation } from '../../modules/accounts/entities/doctor_information.entity';
import { ClinicAdminInformation } from '../../modules/accounts/entities/clinic-admin-information.entity';
import { Feedback } from '../../modules/reports/entities/feedback.entity';
import { ClinicServiceConfig } from '../../modules/service-configs/entities/clinic-service-config.entity';
import { EmployeeSchedule } from '../../modules/schedules/entities/employee-schedule.entity';
import { ClinicShift } from '../../modules/schedules/entities/clinic-shift.entity';
import { ClinicShiftHour } from '../../modules/schedules/entities/clinic-shift-hour.entity';
import { ClinicRoom } from '../../modules/schedules/entities/clinic_room.entity';

// Entities for Appointment Seeders
import { Appointment } from '../../modules/appointments/entities/appointment.entity';
import { AppointmentPackage } from '../../modules/appointments/entities/appointment-package.entity';
import { ServiceAppointment } from '../../modules/appointments/entities/service-appointment.entity';
import { ERM } from '../../modules/prescriptions/entities/erm.entity';
import { ERMConsultation } from '../../modules/prescriptions/entities/erm-consultation.entity';
import { ERMXray } from '../../modules/prescriptions/entities/erm-xray.entity';
import { ERMUltrasound } from '../../modules/prescriptions/entities/erm-ultrasound.entity';
import { ERMLab } from '../../modules/prescriptions/entities/erm-lab.entity';
import { ERMBoneDensity } from '../../modules/prescriptions/entities/erm-bone-density.entity';
import { ERMProcedure } from '../../modules/prescriptions/entities/erm-procedure.entity';
import { EPrescription } from '../../modules/prescriptions/entities/e-prescription.entity';
import { DetailEPrescription } from '../../modules/prescriptions/entities/detail-e-prescription.entity';
import { Medicine } from '../../modules/prescriptions/entities/medicine.entity';
import { MedicineRepository } from '../../modules/prescriptions/repositories/medicine.repository';
// Entities for Transaction History Seeder
import { Transaction } from '../../modules/transactions/entities/transaction.entity';
import { TransactionType } from '../../modules/transactions/entities/transaction-type.entity';

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
 * 5. ClinicsLegalDocumentsSeederService: Seeds ClinicsLegalDocuments records
 * 6. AddressSeederService: Seeds Address records
 * 7. GoogleIframeSeederService: Seeds GoogleIframe records
 * 8. ContractPackageSeederService: Seeds ContractPackage records
 * 9. ClinicContractInformationSeederService: Seeds ClinicContractInformation records
 * 10. ClinicStaffInformationSeederService: Seeds ClinicStaffInformation records
 * 11. DoctorInformationSeederService: Seeds DoctorInformation records
 * 12. GeneralAccountSeederService: Seeds GeneralAccount records for PATIENT accounts
 * 13. FeedbackSeederService: Seeds feedback records
 * 14. BlogSeederService: Seeds blog records
 * 15. SubscriptionServiceSeederService: Seeds SubscriptionService records
 * 16. SubscriptionsSeederService: Seeds ClinicSubscription and ClinicSubscriptionHistory records
 * 17. ClinicServiceCategorySeederService: Seeds ClinicServiceCategory records
 * 18. ClinicServiceSeederService: Seeds ClinicService records
 * 19. ClinicServiceConfigSeederService: Seeds ClinicServiceConfig records
 *
 * Individual seeder services expose public seed() methods but do not implement OnModuleInit.
 * Only SeederOrchestratorService implements OnModuleInit to coordinate the seeding process.
 */
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
      Appointment,
      AppointmentPackage,
      ServiceAppointment,
      ERM,
      ERMConsultation,
      ERMXray,
      ERMUltrasound,
      ERMLab,
      ERMBoneDensity,
      ERMProcedure,
      EPrescription,
      DetailEPrescription,
      Medicine,
      Transaction,
      TransactionType,
    ]),
    BlogsModule,
    SubscriptionsModule,
    ClinicServicesModule,
    ServiceConfigsModule,
    ContractsModule,
    SchedulesModule,
    PrescriptionsModule,
    AppointmentsModule,
    TransactionsModule,
    HttpModule,
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
    BlogSeederService,
    SubscriptionServiceSeederService,
    SubscriptionsSeederService,
    ClinicServiceCategorySeederService,
    ClinicServiceSeederService,
    ClinicServiceConfigSeederService,
    ClinicRoomSeederService,
    ClinicShiftSeederService,
    EmployeeScheduleSeederService,
    ClinicRoomEmployeeScheduleSeederService,
    AppointmentSeederService,
    ERMSeederService,
    EPrescriptionSeederService,
    EPrescriptionDetailSeederService,
    TransactionHistorySeederService,
    SeederOrchestratorService,
    KnowledgeBaseRepository,
    ClinicRoomRepository,
    ClinicShiftRepository,
    ClinicShiftHourRepository,
    EmployeeScheduleRepository,
    MedicineRepository,
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
    BlogSeederService,
    SubscriptionServiceSeederService,
    SubscriptionsSeederService,
    ClinicServiceCategorySeederService,
    ClinicServiceSeederService,
    ClinicServiceConfigSeederService,
    ClinicRoomSeederService,
    ClinicShiftSeederService,
    EmployeeScheduleSeederService,
    ClinicRoomEmployeeScheduleSeederService,
    AppointmentSeederService,
    ERMSeederService,
    EPrescriptionSeederService,
    EPrescriptionDetailSeederService,
    TransactionHistorySeederService,
    SeederOrchestratorService,
  ],
})
export class SeedersModule {}
