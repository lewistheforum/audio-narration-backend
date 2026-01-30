import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
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
    SubscriptionsModule,
  ],
  controllers: [AccountsController],
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

    AccountsService,
  ],
  exports: [
    AccountsService,
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

  ],
})
export class AccountsModule { }
