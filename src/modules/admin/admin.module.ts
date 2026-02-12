import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountsModule } from '../accounts/accounts.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { MailerModule } from '../mailer/mailer.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminStatisticsService } from './admin-statistics.service';
import { AdminRegistrationRepository } from './repositories/admin-registration.repository';
import { AdminStatisticsRepository } from './repositories/admin-statistics.repository';
import {
  Account,
  ClinicAdminInformation,
  ClinicManagerInformation,
  ClinicsLegalDocuments,
} from '../accounts/entities';
import { ClinicSubscription } from '../subscriptions/entities/clinic-subscription.entity';
import { ClinicSubscriptionHistory } from '../subscriptions/entities/clinic-subscription-history.entity';
import { SubscriptionService } from '../subscriptions/entities/subscription-service.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Appointment } from '../appointments/entities/appointment.entity';

/**
 * Admin Module
 *
 * Provides admin functionality for:
 * - Approving/rejecting clinic registrations
 * - Dashboard statistics
 *
 * Dependencies:
 * - AccountsModule: For accessing Account, ClinicAdminInformation, ClinicManagerInformation, ClinicsLegalDocuments entities and repositories
 * - SubscriptionsModule: For accessing ClinicSubscription entity and repository
 * - MailerModule: For sending email notifications
 * - AuthModule: For JWT authentication and RBAC guards (imported via AccountsModule)
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Account,
      ClinicAdminInformation,
      ClinicManagerInformation,
      ClinicsLegalDocuments,
      ClinicSubscription,
      ClinicSubscriptionHistory,
      SubscriptionService,
      Transaction,
      Appointment,
    ]),
    AccountsModule,
    SubscriptionsModule,
    MailerModule,
  ],
  controllers: [AdminController],
  providers: [
    AdminRegistrationRepository,
    AdminStatisticsRepository,
    AdminService,
    AdminStatisticsService,
  ],
  exports: [AdminService, AdminStatisticsService],
})
export class AdminModule {}
