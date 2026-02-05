import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountsModule } from '../accounts/accounts.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { MailerModule } from '../mailer/mailer.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminRegistrationRepository } from './repositories/admin-registration.repository';
import {
  Account,
  ClinicAdminInformation,
  ClinicManagerInformation,
  ClinicsLegalDocuments,
} from '../accounts/entities';
import { ClinicSubscription } from '../subscriptions/entities/clinic-subscription.entity';

/**
 * Admin Module
 *
 * Provides admin functionality for approving/rejecting clinic registrations
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
    ]),
    AccountsModule,
    SubscriptionsModule,
    MailerModule,
  ],
  controllers: [AdminController],
  providers: [
    AdminRegistrationRepository,
    AdminService,
  ],
  exports: [AdminService],
})
export class AdminModule {}
