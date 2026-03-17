import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { ZaloWebhookService } from './zalo-webhook.service';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { TransactionsModule } from '../transactions/transactions.module';
import {
  Account,
  GeneralAccount,
  Address,
  GoogleIframe,
  ClinicsLegalDocuments,
  ClinicManagerInformation,
  ClinicStaffInformation,
  DoctorInformation,
  ClinicAdminInformation,
  CodeVerification,

} from './entities';
import {
  AccountRepository,
  GeneralAccountRepository,
  AddressRepository,
  GoogleIframeRepository,
  ClinicsLegalDocumentsRepository,
  ClinicManagerInformationRepository,
  ClinicStaffInformationRepository,
  DoctorInformationRepository,
  ClinicAdminInformationRepository,
  CodeVerificationRepository,

} from './repositories';
import { MailerModule } from '../mailer/mailer.module';
import { TransactionRepository } from '../transactions/repositories/transaction.repository';
import { ClinicManagerService } from './api-clinic-admin/clinic-manager.service';
import { ClinicManagerController } from './api-clinic-admin/clinic-manager.controller';

/**
 * Accounts Module
 *
 * Provides account management functionality including:
 * - Account CRUD operations
 * - Patient and clinic staff creation
 * - Password management
 * - Account search and retrieval
 * - Email verification
 * - Automatic profile creation on account registration
 *
 * Uses multiple entities:
 * - Account: Common account data (email, password, role, status, ban info)
 * - GeneralAccount: Account-specific data (fullName, gender) for patients and admins
 * - Address: Address information for accounts
 * - GoogleIframe: Google Map iframe information
 * - ClinicsLegalDocuments: Legal documents for clinics
 * - ClinicManagerInformation: Detailed clinic manager information
 * - ClinicStaffInformation: Staff member information
 * - DoctorInformation: Detailed doctor information
 * - CodeVerification: Verification codes for email and password reset
 *
 * Architecture:
 * - Repositories: Handles all database operations for each entity
 * - AccountsService: Contains business logic, uses repositories for data access
 *
 * Exported Services:
 * - AccountsService: Used by AuthModule for account operations during authentication
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Account,
      GeneralAccount,
      Address,
      GoogleIframe,
      ClinicsLegalDocuments,
      ClinicManagerInformation,
      ClinicStaffInformation,
      DoctorInformation,
      ClinicAdminInformation,
      CodeVerification,

    ]),
    forwardRef(() => MailerModule),
    forwardRef(() => SubscriptionsModule),
    forwardRef(() => TransactionsModule),
    HttpModule,
  ],
  controllers: [
    AccountsController,
    ClinicManagerController,
  ],
  providers: [
    AccountRepository,
    GeneralAccountRepository,
    AddressRepository,
    GoogleIframeRepository,
    ClinicsLegalDocumentsRepository,
    ClinicManagerInformationRepository,
    ClinicStaffInformationRepository,
    DoctorInformationRepository,
    ClinicAdminInformationRepository,
    CodeVerificationRepository,

    TransactionRepository,
    AccountsService,
    ClinicManagerService,
    ZaloWebhookService,
  ],
  exports: [
    AccountsService,
    ClinicManagerService,
    CodeVerificationRepository,
    AccountRepository,
    GeneralAccountRepository,
    AddressRepository,
    GoogleIframeRepository,
    ClinicsLegalDocumentsRepository,
    ClinicManagerInformationRepository,
    ClinicStaffInformationRepository,
    DoctorInformationRepository,
    ClinicAdminInformationRepository,
    TransactionRepository,
    ZaloWebhookService,
  ],
})
export class AccountsModule { }
