import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Account } from './entities/accounts.entity';
import {
  AccountRole,
  AccountStatus,
  VerificationType,
  ClinicRole,
} from './enums';
import { generateRSAKeyPair } from 'src/common/utils/util';
import * as crypto from 'crypto';
import {
  getCurrentVietnamTime,
  addToVietnamTime,
  getVietnamTimestamp,
} from 'src/common/utils/date.util';
import { GeneralAccount } from './entities/general_accounts.entity';
import { ClinicAdminInformation } from './entities/clinic-admin-information.entity';
import { ClinicManagerInformation } from './entities/clinic_manager_information.entity';
import { ClinicStaffInformation } from './entities/clinic_staff_information.entity';
import { DoctorInformation } from './entities/doctor_information.entity';
import { ClinicsLegalDocuments } from './entities/clinics_legal_documents.entity';
import { LegalDocumentVerificationStatus } from './enums/legal-document-verification-status.enum';
import {
  CreateAccountDto,
  UpdatePasswordDto,
  UpdateAccountDto,
  AccountResponseDto,
  BanAccountDto,
  CreateStaffByClinicManagerDto,
  CreateDoctorByClinicManagerDto,
  UpdateClinicAdminProfileDto,
  RegisterClinicAdminDto,
  CheckRegistrationStatusResponseDto,
  CreateClinicManagerForRegistrationDto,
  UploadLegalDocumentDto,
  UpdateLegalDocumentsDto,
  CancelRegistrationResponseDto,
  CancelSubscriptionDto,
  CancelSubscriptionResponseDto,
  SearchPatientQueryDto,
  PatientSearchResponseDto,
  PatientDataDto,
} from './dto';
import { RegistrationStatus } from '../subscriptions/enums/subscription-status.enum';
import {
  ClinicListResponseDto,
  ClinicItemDto,
  ClinicDetailResponseDto,
  AddressDetailDto,
  DoctorSummaryDto,
  SubscriptionDto,
  PublicDoctorDetailResponseDto,
  PublicDoctorDetailData,
  DoctorListResponseDto,
  DoctorItemDto,
  DoctorPaginationDto,
  StaffListResponseDto,
  StaffItemDto,
} from './dto';
import { MESSAGES } from 'src/common/message';
import * as bcrypt from 'bcrypt';
import { AccountRepository } from './repositories/account.repository';
import { GeneralAccountRepository } from './repositories/general-account.repository';
import {
  CodeVerificationRepository,
  ClinicManagerInformationRepository,
  ClinicStaffInformationRepository,
  DoctorInformationRepository,
  ClinicAdminInformationRepository,
  AddressRepository,
  GoogleIframeRepository,
} from './repositories';
import { UsernameEmailListDto } from './dto/username-email-list.dto';
import { GetEmployeesByClinicDto } from './dto/get-employees-by-clinic.dto';

import { generateVerificationCode } from 'src/common/utils/util';
import { ZaloWebhookService } from './zalo-webhook.service';
import { MailerService } from '../mailer/mailer.service';
import {
  ClinicSubscriptionRepository,
  ClinicSubscriptionHistoryRepository,
  SubscriptionServiceRepository,
} from '../subscriptions/repositories';
import { ClinicsLegalDocumentsRepository } from './repositories';
import { TransactionRepository } from '../transactions/repositories/transaction.repository';
import {
  Transaction,
  PaymentStatus,
} from '../transactions/entities/transaction.entity';
import { ClinicSubscription } from '../subscriptions/entities/clinic-subscription.entity';

/**
 * Accounts Service
 *
 * Centralized service layer for managing all account-related operations in the Bonix system.
 * This service implements the business logic layer between controllers and the data access layer (repository).
 *
 * Core Responsibilities:
 * - Account lifecycle management (CRUD operations)
 * - Patient registration with two-step save process (Account + GeneralAccount entities)
 * - OAuth-based account creation (currently Google)
 * - Password management and security (bcrypt hashing)
 * - Email verification workflow
 * - Password reset workflow
 * - Account status management (activation, banning, suspension)
 * - Soft delete and restoration
 * - Email uniqueness validation
 * - Role-based account creation (Patient, Clinic Staff, Doctor, Admin)
 *
 * Database Architecture:
 * - accounts table: Core account data (credentials, authentication, role, status)
 * - general_accounts table: Extended profile data (fullName, gender)
 *
 * Design Patterns:
 * - Repository Pattern: All database operations delegated to AccountsRepository
 * - DTO Pattern: Data transformation via AccountResponseDto
 * - Service Layer Pattern: Business logic separation from controllers
 *
 * Security Features:
 * - bcrypt password hashing (10 rounds)
 * - Email verification system
 * - Password reset with verification codes
 * - Account status validation
 * - Role-based authorization support
 *
 * @class AccountsService
 * @injectable
 */
@Injectable()
export class AccountsService {
  /**
   * Number of bcrypt salt rounds for password hashing
   * Higher value = more secure but slower
   * @private
   * @readonly
   */
  private readonly BCRYPT_SALT_ROUNDS = 10;

  /**
   * Constructs the AccountsService with required dependencies
   *
   * @param {AccountsRepository} accountsRepository - Repository for Account and GeneralAccount data access
   * @param {CodeVerificationRepository} codeVerificationRepository - Repository for verification code management
   * @param {DataSource} dataSource - TypeORM DataSource for transaction management
   * @param {ClinicManagerInformationRepository} clinicManagerInfoRepository - Repository for clinic manager information
   * @param {ClinicStaffInformationRepository} clinicStaffRepository - Repository for clinic staff information
   * @param {DoctorInformationRepository} doctorInfoRepository - Repository for doctor information
   */
  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly generalAccountRepository: GeneralAccountRepository,
    private readonly codeVerificationRepository: CodeVerificationRepository,
    private readonly dataSource: DataSource,
    private readonly clinicManagerInfoRepository: ClinicManagerInformationRepository,
    private readonly clinicStaffRepository: ClinicStaffInformationRepository,
    private readonly doctorInfoRepository: DoctorInformationRepository,
    private readonly clinicAdminInfoRepository: ClinicAdminInformationRepository,
    private readonly addressRepository: AddressRepository,
    private readonly googleIframeRepository: GoogleIframeRepository,
    private readonly clinicSubscriptionRepository: ClinicSubscriptionRepository,
    private readonly clinicSubscriptionHistoryRepository: ClinicSubscriptionHistoryRepository,
    private readonly subscriptionServiceRepository: SubscriptionServiceRepository,
    private readonly mailerService: MailerService,
    private readonly clinicLegalDocsRepository: ClinicsLegalDocumentsRepository,
    private readonly transactionRepository: TransactionRepository,
    private readonly zaloWebhookService: ZaloWebhookService,
  ) {}



  async generateUserKeys(
    userId: string,
  ): Promise<{ publicKey: string; encryptedPrivateKey: string }> {
    const { publicKey, privateKey: encryptedPrivateKey } = generateRSAKeyPair();
    const account = await this.findAccountEntityById(userId);
    account.publicKey = publicKey;
    account.encryptedPrivateKey = encryptedPrivateKey;
    await this.accountRepository.saveAccount(account);
    return { publicKey, encryptedPrivateKey };
  }

  /**
   * Find All Accounts
   *
   * Retrieves all user accounts from the system with optional inclusion of soft-deleted records.
   * Combines data from both Account and GeneralAccount tables to build complete user profiles.
   *
   * Use Cases:
   * - Admin dashboard
   * - User management
   * - Reporting
   *
   * @param {boolean} includeDeleted - Include soft-deleted accounts (default: false)
   * @returns {Promise<AccountResponseDto[]>} Array of account DTOs with sensitive data excluded
   *
   * @example
   * ```typescript
   * // Get all active accounts
   * const accounts = await accountsService.findAll();
   *
   * // Get all accounts including soft-deleted
   * const allAccounts = await accountsService.findAll(true);
   * ```
   */
  async findAll(
    includeDeleted: boolean = false,
  ): Promise<AccountResponseDto[]> {
    const accounts =
      await this.accountRepository.findAllAccounts(includeDeleted);

    const result: AccountResponseDto[] = [];
    for (const account of accounts) {
      const generalAccount =
        await this.generalAccountRepository.findGeneralAccountByUserId(
          account._id,
        );
      result.push(new AccountResponseDto(account, generalAccount));
    }

    return result;
  }

  /**
   * Find Account Entity by ID (Internal Use Only)
   * Returns full Account entity including sensitive data
   * WARNING: Never expose directly to clients
   *
   * @param {string} id - Account UUID
   * @returns {Promise<Account>} Full Account entity
   * @throws {NotFoundException} If account not found
   */
  async findAccountEntityById(id: string): Promise<Account> {
    const account = await this.accountRepository.findAccountById(id);
    if (!account) {
      throw new NotFoundException(MESSAGES.failMessage.userNotFound);
    }
    return account;
  }

  /**
   * Find General Account by User ID
   * Returns profile data (fullName, gender) or null if not found
   *
   * @param {string} userId - User Account UUID
   * @returns {Promise<GeneralAccount | null>} General account or null
   */
  async findGeneralAccountByUserId(
    userId: string,
  ): Promise<GeneralAccount | null> {
    return this.generalAccountRepository.findGeneralAccountByUserId(userId);
  }

  /**
   * Find Account by ID (Public)
   *
   * Public method to retrieve account data as a DTO with sensitive data excluded.
   * Combines Account and GeneralAccount data into a single response object.
   *
   * Use Cases:
   * - User profile retrieval
   * - Account detail pages
   * - Public account information display
   *
   * @param {string} id - Account UUID
   * @returns {Promise<AccountResponseDto>} Account DTO with password and other sensitive data excluded
   * @throws {NotFoundException} If account does not exist
   *
   * @example
   * ```typescript
   * const accountDto = await accountsService.findOne('uuid-here');
   * // Safe to return to client - password is excluded
   * ```
   */
  async findOne(id: string): Promise<AccountResponseDto> {
    const account = await this.findAccountEntityById(id);
    const generalAccount = await this.findGeneralAccountByUserId(id);
    return new AccountResponseDto(account, generalAccount);
  }

  /**
   * Search Patient by Phone, Email, or Full Name
   *
   * Searches for existing patient accounts by phone number (primary), email, or full name.
   * Used by clinic staff to check if a patient already exists before creating walk-in appointments.
   *
   * Search Priority:
   * 1. Phone number (unique identifier, exact match)
   * 2. Email (exact match, case-insensitive)
   * 3. Full name (fuzzy search, case-insensitive)
   *
   * Returns:
   * - If found: Patient data with account information
   * - If not found: Suggested action to create new account
   *
   * @param {SearchPatientQueryDto} query - Search parameters (phone, email, or fullName)
   * @returns {Promise<PatientSearchResponseDto>} Search result with patient data or not found message
   *
   * @example
   * ```typescript
   * const result = await accountsService.searchPatientByPhone({ phone: '0912345678' });
   * if (result.found) {
   *   console.log('Patient found:', result.patient);
   * } else {
   *   console.log('Create new account suggested');
   * }
   * ```
   */
  async searchPatientByPhone(
    query: SearchPatientQueryDto,
  ): Promise<PatientSearchResponseDto> {
    const { phone, email, fullName } = query;
    const invalidRoleMessage =
      'This account can not book appointment, Please enter different information';

    // Validate at least one search parameter is provided
    if (!phone && !email && !fullName) {
      throw new BadRequestException(
        'At least one search parameter (phone, email, or fullName) is required',
      );
    }

    let account: Account | null = null;

    // Priority 1: Search by phone (primary key, exact match)
    if (phone) {
      account = await this.accountRepository.findByPhone(phone);
      if (account && account.role !== AccountRole.PATIENT) {
        return {
          found: false,
          message: invalidRoleMessage,
        };
      }
    }

    // Priority 2: Search by email (exact match) if phone search failed
    if (!account && email) {
      account = await this.accountRepository.findByEmail(email);
      if (account && account.role !== AccountRole.PATIENT) {
        return {
          found: false,
          message: invalidRoleMessage,
        };
      }
    }

    // Priority 3: Search by full name (fuzzy search) if both phone and email failed
    if (!account && fullName) {
      const generalAccount =
        await this.generalAccountRepository.findByFullNameFuzzy(fullName);
      if (generalAccount) {
        account = await this.accountRepository.findAccountById(
          generalAccount.accountId,
        );
        if (account && account.role !== AccountRole.PATIENT) {
          return {
            found: false,
            message: invalidRoleMessage,
          };
        }
      }
    }

    // Patient not found
    if (!account) {
      return {
        found: false,
        message: 'Không tìm thấy bệnh nhân với thông tin này',
        suggestedAction: 'CREATE_NEW_ACCOUNT',
      };
    }

    // Patient found - get additional information
    const generalAccount = await this.generalAccountRepository.findByAccountId(
      account._id,
    );
    const address = await this.addressRepository.findByAccountId(account._id);

    // Check if email is temporary (generated by system)
    const isTempEmail = account.email?.endsWith('@tempemail.clinic') || false;

    // Format date of birth (handle both Date object and string from DB)
    let formattedDob: string | undefined = undefined;
    if (generalAccount?.dob) {
      try {
        // TypeORM may return date as string or Date object depending on driver
        const dobValue = generalAccount.dob as Date | string;
        formattedDob =
          typeof dobValue === 'string'
            ? dobValue.split('T')[0]
            : new Date(dobValue).toISOString().split('T')[0];
      } catch (error) {
        // If date parsing fails, leave as undefined
        formattedDob = undefined;
      }
    }

    // Build patient data response
    const patientData: PatientDataDto = {
      accountId: account._id,
      email: account.email,
      phone: account.phone,
      fullName: generalAccount?.fullName || '',
      dateOfBirth: formattedDob,
      gender: generalAccount?.gender,
      address: address
        ? `${address.address || ''}, ${address.wardName || ''}, ${address.districtName || ''}, ${address.provinceName || ''}`.trim()
        : undefined,
      createdAt: account.createdAt.toISOString(),
      isTempEmail,
    };

    return {
      found: true,
      patient: patientData,
    };
  }

  /**
   * Find Accounts by Role and Status
   *
   * Exposes the repository method to find accounts by role and status with pagination.
   *
   * @param {AccountRole} role - Account role to filter
   * @param {AccountStatus} status - Account status to filter
   * @param {number} skip - Number of records to skip
   * @param {number} take - Number of records to return
   * @returns {Promise<[Account[], number]>} Array of accounts and total count
   */
  async findByRoleAndStatus(
    role: AccountRole,
    status: AccountStatus,
    skip: number = 0,
    take: number = 10,
  ): Promise<[Account[], number]> {
    return this.accountRepository.findByRoleAndStatus(role, status, skip, take);
  }

  async getAccountInformationByRole(id: string): Promise<AccountResponseDto> {
    const account = await this.findAccountEntityById(id);

    const address = await this.addressRepository.findByAccountId(id);

    const googleIframe = await this.googleIframeRepository.findByAddressId(
      address?._id,
    );

    switch (account.role) {
      case AccountRole.ADMIN:
      case AccountRole.PATIENT:
        const generalAccount =
          await this.generalAccountRepository.findByAccountId(id);
        return new AccountResponseDto(
          account,
          generalAccount,
          undefined,
          undefined,
          undefined,
          undefined,
          address,
          googleIframe,
        );

      case AccountRole.CLINIC_MANAGER:
        const managerInfo =
          await this.clinicManagerInfoRepository.findByAccountId(id);
        return new AccountResponseDto(
          account,
          undefined,
          undefined,
          undefined,
          managerInfo,
          undefined,
          address,
          googleIframe,
        );

      case AccountRole.DOCTOR:
        const doctorInfo = await this.doctorInfoRepository.findByAccountId(id);
        return new AccountResponseDto(
          account,
          undefined,
          undefined,
          doctorInfo,
          undefined,
          undefined,
          address,
          googleIframe,
        );

      case AccountRole.CLINIC_ADMIN:
        const clinicAdminInfo =
          await this.clinicAdminInfoRepository.findByAccountId(id);
        return new AccountResponseDto(
          account,
          undefined,
          undefined,
          undefined,
          undefined,
          clinicAdminInfo,
          address,
          googleIframe,
        );

      case AccountRole.CLINIC_STAFF:
        const staffInfo = await this.clinicStaffRepository.findByAccountId(id);
        return new AccountResponseDto(
          account,
          undefined,
          staffInfo,
          undefined,
          undefined,
          undefined,
          address,
          googleIframe,
        );

      default:
        throw new NotFoundException(MESSAGES.failMessage.userNotFound);
    }
  }

  /**
   * Create Patient Account
   *
   * Registers a new patient account with standard email/password authentication.
   * Implements a two-step save process to handle the Account-GeneralAccount relationship:
   * 1. Save core account data to accounts table (Account entity)
   * 2. Save extended profile data to general_accounts table (GeneralAccount entity)
   *
   * Business Rules:
   * - Role is automatically set to PATIENT
   * - Status is set to PENDING (requires email verification)
   * - Email must be unique across all accounts in the system
   * - Password is hashed with bcrypt (10 rounds) before storage
   * - Username must be unique and at least 3 characters
   * - Phone number format is validated by DTO
   *
   * Workflow:
   * 1. Validate email uniqueness
   * 2. Hash password using bcrypt
   * 3. Create and save Account entity
   * 4. Create and save GeneralAccount entity (if fullName or gender provided)
   * 5. Return combined DTO
   *
   * Post-Registration Steps:
   * - System should send verification email
   * - Patient must verify email to activate account
   * - Status changes from PENDING to ACTIVE upon verification
   *
   * @param {CreateAccountDto} createAccountDto - Patient registration data including credentials and profile
   * @returns {Promise<{user: AccountResponseDto}>} Created patient account DTO with sensitive data excluded
   * @throws {ConflictException} If email already exists in the system
   *
   * @example
   * ```typescript
   * const result = await accountsService.createPatient({
   *   username: 'johndoe',
   *   email: 'john@example.com',
   *   password: 'SecurePass123',
   *   fullName: 'John Doe',
   *   gender: Gender.MALE
   * });
   * // result.user contains AccountResponseDto without password
   * ```
   */
  async createPatient(
    createAccountDto: CreateAccountDto,
  ): Promise<{ user: AccountResponseDto }> {
    // Step 1: Validate email uniqueness
    const existingAccount = await this.findByEmail(createAccountDto.email);
    if (existingAccount) {
      throw new ConflictException(MESSAGES.failMessage.userEmailAlreadyExists);
    }

    // Step 2: Hash password for secure storage
    const hashedPassword = await bcrypt.hash(
      createAccountDto.password,
      this.BCRYPT_SALT_ROUNDS,
    );

    // Step 3: Create and save Account entity
    const account = this.accountRepository.createAccount({
      username: createAccountDto.username,
      email: createAccountDto.email,
      password: hashedPassword,
      phone: createAccountDto.phone,
      role: AccountRole.PATIENT,
      status: AccountStatus.UNVERIFIED,
    });

    const savedAccount = await this.accountRepository.saveAccount(account);

    // Call Zalo webhook to send friend request
    await this.zaloWebhookService.sendFriendRequest(savedAccount.phone, 'Patient Registration');

    // Step 4: Create and save GeneralAccount entity with the Account ID
    let generalAccount: GeneralAccount | null = null;
    if (
      createAccountDto.fullName ||
      createAccountDto.gender ||
      createAccountDto.dob ||
      createAccountDto.profilePicture
    ) {
      generalAccount = this.generalAccountRepository.createGeneralAccount({
        accountId: savedAccount._id,
        fullName: createAccountDto.fullName,
        gender: createAccountDto.gender,
        dob: createAccountDto.dob ? new Date(createAccountDto.dob) : undefined,
        profilePicture: createAccountDto.profilePicture,
      });
      await this.generalAccountRepository.saveGeneralAccount(generalAccount);
    }

    // Step 5: Return combined DTO
    return {
      user: new AccountResponseDto(savedAccount, generalAccount),
    };
  }

  /**
   * Create Patient Account via OAuth
   *
   * Creates a patient account using OAuth authentication provider (currently supports Google).
   * Implements the same two-step save process as standard registration but with OAuth-specific defaults.
   *
   * OAuth-Specific Behavior:
   * - Role is automatically set to PATIENT (business rule)
   * - Status is set to ACTIVE (OAuth providers handle email verification)
   * - isOAuthUser flag is set to true
   * - isEmailVerified is set to true (pre-verified by OAuth provider)
   * - profilePicture from OAuth provider is stored if provided
   * - Password is a hashed random value (not used for OAuth login)
   * - Username defaults to email prefix if not provided by OAuth
   *
   * Security Considerations:
   * - Email is pre-verified by OAuth provider (Google, etc.)
   * - Password is stored but never used for OAuth users
   * - Account activation is immediate (no email verification needed)
   *
   * @param {Object} dto - OAuth account creation data
   * @param {string} dto.email - Email from OAuth provider (pre-verified)
   * @param {string} dto.password - Random password hash (not used for OAuth login)
   * @param {string} [dto.username] - Username from OAuth provider (defaults to email prefix)
   * @param {string} [dto.fullName] - Full name from OAuth provider
   * @param {string} [dto.profilePicture] - Profile picture URL from OAuth provider
   * @returns {Promise<AccountResponseDto>} Created OAuth account DTO
   * @throws {ConflictException} If email already exists in the system
   *
   * @example
   * ```typescript
   * const account = await accountsService.createPatientViaOAuth({
   *   email: 'user@gmail.com',
   *   password: randomSecurePassword,
   *   fullName: 'John Doe',
   *   profilePicture: 'https://google.com/photo.jpg'
   * });
   * ```
   */
  async createPatientViaOAuth(dto: {
    email: string;
    password: string;
    username?: string;
    fullName?: string;
    profilePicture?: string;
  }): Promise<AccountResponseDto> {
    // Step 1: Validate email uniqueness
    const existingAccount = await this.findByEmail(dto.email);
    if (existingAccount) {
      throw new ConflictException(MESSAGES.failMessage.userEmailAlreadyExists);
    }

    // Step 2: Hash password (even though it won't be used for OAuth login)
    const hashedPassword = await bcrypt.hash(
      dto.password,
      this.BCRYPT_SALT_ROUNDS,
    );

    // Step 3: Create and save Account entity with OAuth flags
    const account = this.accountRepository.createAccount({
      username: dto.username || dto.email.split('@')[0], // Use email prefix as default username
      email: dto.email,
      password: hashedPassword,
      role: AccountRole.PATIENT,
      status: AccountStatus.ACTIVE, // OAuth accounts are immediately active
      isOAuthUser: true,
      isEmailVerified: true, // Email pre-verified by OAuth provider
    });

    const savedAccount = await this.accountRepository.saveAccount(account);

    // Call Zalo webhook to send friend request
    await this.zaloWebhookService.sendFriendRequest(savedAccount.phone, 'OAuth Registration');

    // Step 4: Create GeneralAccount with fullName and profilePicture if provided
    let generalAccount: GeneralAccount | null = null;
    if (dto.fullName || dto.profilePicture) {
      generalAccount = this.generalAccountRepository.createGeneralAccount({
        accountId: savedAccount._id,
        fullName: dto.fullName,
        profilePicture: dto.profilePicture,
      });
      await this.generalAccountRepository.saveGeneralAccount(generalAccount);
    }

    return new AccountResponseDto(savedAccount, generalAccount);
  }

  /**
   * Update Account Entity (Internal)
   *
   * Internal method to persist changes to an Account entity.
   * This is a low-level data access method - use update() for business logic operations.
   *
   * @param {Account} account - Account entity with changes to persist
   * @returns {Promise<Account>} Updated account entity from database
   *
   * @private
   * @example
   * ```typescript
   * const account = await accountsService.findAccountEntityById(id);
   * account.status = AccountStatus.ACTIVE;
   * await accountsService.updateAccountEntity(account);
   * ```
   */
  async updateAccountEntity(account: Account): Promise<Account> {
    return this.accountRepository.saveAccount(account);
  }

  /**
   * Update Account Profile
   *
   * Updates account profile information with comprehensive validation.
   * Handles updates to both Account and GeneralAccount tables.
   *
   * Business Rules:
   * - Email must remain unique across all accounts if changed
   * - Email change triggers verification reset (isEmailVerified set to false)
   * - Role can be updated (admin privilege required at controller level)
   * - Username can be updated
   * - Phone number can be updated
   * - GeneralAccount fields (fullName, gender) are handled separately via updateGeneralAccount()
   *
   * Email Change Workflow:
   * 1. New email uniqueness is validated
   * 2. isEmailVerified is set to false
   * 3. Controller should trigger new verification email
   * 4. User must verify new email to reactivate account
   *
   * @param {string} id - Account UUID
   * @param {UpdateAccountDto} updateAccountDto - Account fields to update
   * @returns {Promise<{user: AccountResponseDto, emailChanged?: boolean}>} Updated account DTO and email change flag
   * @throws {NotFoundException} If account does not exist
   * @throws {ConflictException} If new email already exists for different account
   *
   * @example
   * ```typescript
   * const result = await accountsService.update(id, {
   *   email: 'newemail@example.com',
   *   phone: '0987654321'
   * });
   * if (result.emailChanged) {
   *   // Send verification email to new address
   * }
   * ```
   */
  async update(
    id: string,
    updateAccountDto: UpdateAccountDto,
  ): Promise<{ user: AccountResponseDto; emailChanged?: boolean }> {
    const account = await this.findAccountEntityById(id);

    let emailChanged = false;
    const oldPhone = account.phone;

    // Validate email change permission - only PATIENT can change their own email
    if (updateAccountDto.email && updateAccountDto.email !== account.email) {
      // if (account.role !== AccountRole.PATIENT) {
      //   throw new ForbiddenException(
      //     'Only PATIENT accounts can change their email address. Other roles must contact administrator.',
      //   );
      // }

      // const existingAccountWithEmail = await this.findByEmail(
      //   updateAccountDto.email,
      // );
      // if (existingAccountWithEmail && existingAccountWithEmail._id !== id) {
      //   throw new ConflictException(MESSAGES.failMessage.emailAlreadyExists);
      // }

      account.email = updateAccountDto.email;
      account.isEmailVerified = false; // Reset verification for new email
      account.status = AccountStatus.ACTIVE; // Keep account active
      emailChanged = true;
    }

    // Handle role updates
    if (updateAccountDto.role) {
      account.role = updateAccountDto.role;
    }

    // Update basic fields
    if (updateAccountDto.username !== undefined) {
      account.username = updateAccountDto.username;
    }
    if (updateAccountDto.phone !== undefined) {
      account.phone = updateAccountDto.phone;
    }

    const updatedAccount = await this.accountRepository.saveAccount(account);

    // Update Role Specific Information
    switch (account.role) {
      case AccountRole.ADMIN:
      case AccountRole.PATIENT:
        if (
          updateAccountDto.fullName !== undefined ||
          updateAccountDto.gender !== undefined ||
          updateAccountDto.dob !== undefined ||
          updateAccountDto.profilePicture !== undefined
        ) {
          await this.updateGeneralAccount(id, {
            fullName: updateAccountDto.fullName,
            gender: updateAccountDto.gender,
            dob: updateAccountDto.dob
              ? new Date(updateAccountDto.dob)
              : undefined,
            profilePicture: updateAccountDto.profilePicture,
          });
        }
        break;

      case AccountRole.CLINIC_ADMIN:
        await this.updateClinicAdminInformation(id, {
          clinicName: updateAccountDto.clinicName,
          description: updateAccountDto.description,
          specializedIn: updateAccountDto.specializedIn,
          pros: updateAccountDto.pros,
          paraclinical: updateAccountDto.paraclinical,
          dob: updateAccountDto.dob
            ? new Date(updateAccountDto.dob)
            : undefined,
          profilePicture: updateAccountDto.profilePicture,
          bankName: updateAccountDto.bankName,
          bankNumber: updateAccountDto.bankNumber,
          bankBranch: updateAccountDto.bankBranch,
          sepayVa: updateAccountDto.sepayVa,
        });
        break;

      case AccountRole.CLINIC_MANAGER:
        await this.updateClinicManagerInformation(id, {
          clinicBranchName: updateAccountDto.clinicBranchName,
          fullName: updateAccountDto.fullName,
          gender: updateAccountDto.gender,
          profilePicture: updateAccountDto.profilePicture,
          dob: updateAccountDto.dob
            ? new Date(updateAccountDto.dob)
            : undefined,
        });
        break;

      case AccountRole.CLINIC_STAFF:
        await this.updateClinicStaffInformation(id, {
          fullName: updateAccountDto.fullName,
          gender: updateAccountDto.gender,
          clinicRole: updateAccountDto.clinicRole,
          dob: updateAccountDto.dob
            ? new Date(updateAccountDto.dob)
            : undefined,
          profilePicture: updateAccountDto.profilePicture,
        });
        break;

      case AccountRole.DOCTOR:
        await this.updateDoctorInformation(id, {
          fullName: updateAccountDto.fullName,
          gender: updateAccountDto.gender,
          dob: updateAccountDto.dob
            ? new Date(updateAccountDto.dob)
            : undefined,
          profilePicture: updateAccountDto.profilePicture,
          academicDegree: updateAccountDto.academicDegree,
          experience: updateAccountDto.experience,
          position: updateAccountDto.position,
          introduction1: updateAccountDto.introduction1,
          workProcess2: updateAccountDto.workProcess2,
          studyProcess3: updateAccountDto.studyProcess3,
          members4: updateAccountDto.members4,
          scientificWork5: updateAccountDto.scientificWork5,
          papers6: updateAccountDto.papers6,
          introductionImage: updateAccountDto.introductionImage,
          professionalLicense: updateAccountDto.professionalLicense,
          certificatePracticalTraining:
            updateAccountDto.certificatePracticalTraining,
          medicalLicense: updateAccountDto.medicalLicense,
          identityNumber: updateAccountDto.identityNumber,
          placeIdentityCard: updateAccountDto.placeIdentityCard,
          identityDate: updateAccountDto.identityDate
            ? new Date(updateAccountDto.identityDate)
            : undefined,
          bankNumber: updateAccountDto.bankNumber,
          bankName: updateAccountDto.bankName,
          bankBranch: updateAccountDto.bankBranch,
        });
        break;
    }

    // Update Address and Google Iframe
    await this.updateAddressAndGoogleIframe(id, updateAccountDto);

    // Retrieve updated information for response
    const updatedUser = await this.getAccountInformationByRole(id);

    // If phone number changed, call Zalo webhook
    if (updateAccountDto.phone && updateAccountDto.phone !== oldPhone) {
      await this.zaloWebhookService.sendFriendRequest(updateAccountDto.phone, 'Profile Update (Phone Change)');
    }

    return {
      user: updatedUser,
      emailChanged,
    };
  }

  /**
   * Encrypt Bank Account Information
   *
   * Manually triggers encryption for bank-related fields.
   * Useful for migrating existing plain-text data to encrypted format.
   *
   * @param {string} id - Account UUID
   * @returns {Promise<any>} Updated profile
   */
  async encryptBankAccount(id: string): Promise<any> {
    const account = await this.findAccountEntityById(id);

    if (account.role === AccountRole.CLINIC_ADMIN) {
      const profile = await this.clinicAdminInfoRepository.findByAccountId(id);
      if (!profile) return;

      // Saving the entity triggers the encryption transformer
      await this.clinicAdminInfoRepository.save(profile);
      return profile;
    } else if (account.role === AccountRole.DOCTOR) {
      const profile = await this.doctorInfoRepository.findByAccountId(id);
      if (!profile) return;

      // Saving the entity triggers the encryption transformer
      await this.doctorInfoRepository.save(profile);
      return profile;
    }

    throw new BadRequestException(
      'Account role does not support bank information',
    );
  }

  /**
   * Get Decrypted Bank Information
   *
   * Retrieves bank information for an account.
   * Since the entity columns use the encryptionTransformer,
   * fetching the entity automatically decrypts the data.
   *
   * @param {string} id - Account UUID
   * @returns {Promise<any>} Object containing decrypted bank details
   */
  async getDecryptedBankInfo(id: string): Promise<any> {
    const account = await this.findAccountEntityById(id);

    if (account.role === AccountRole.CLINIC_ADMIN) {
      const profile = await this.clinicAdminInfoRepository.findByAccountId(id);
      if (!profile) return null;

      return {
        bankName: profile.bankName,
        bankNumber: profile.bankNumber,
        bankBranch: profile.bankBranch,
        sepayVa: profile.sepayVa,
      };
    } else if (account.role === AccountRole.DOCTOR) {
      const profile = await this.doctorInfoRepository.findByAccountId(id);
      if (!profile) return null;

      return {
        bankName: profile.bankName,
        bankNumber: profile.bankNumber,
        bankBranch: profile.bankBranch,
      };
    }

    throw new BadRequestException(
      'Account role does not support bank information',
    );
  }

  /**
   * Update GeneralAccount Entity (Internal)
   *
   * Internal method to persist changes to a GeneralAccount entity.
   * This is a low-level data access method.
   *
   * @param {GeneralAccount} generalAccount - GeneralAccount entity with changes to persist
   * @returns {Promise<GeneralAccount>} Updated general account entity from database
   *
   * @private
   * @example
   * ```typescript
   * const generalAccount = await accountsService.findGeneralAccountByUserId(id);
   * generalAccount.profilePicture = 'new-url';
   * await accountsService.updateGeneralAccountEntity(generalAccount);
   * ```
   */
  async updateGeneralAccountEntity(
    generalAccount: GeneralAccount,
  ): Promise<GeneralAccount> {
    return this.generalAccountRepository.saveGeneralAccount(generalAccount);
  }

  /**
   * Update General Account Profile
   *
   * Updates or creates the GeneralAccount entity associated with an account.
   * This method handles extended profile data (fullName, gender) stored separately from core account data.
   *
   * Behavior:
   * - If GeneralAccount exists: Updates provided fields
   * - If GeneralAccount doesn't exist: Creates new GeneralAccount with provided data
   *
   * Use Cases:
   * - Updating user profile information
   * - Adding profile data to accounts created before GeneralAccount feature
   * - Synchronizing profile data from external sources
   *
   * @param {string} userId - Account UUID
   * @param {Object} data - Profile data to update
   * @param {string} [data.fullName] - Full name of the user
   * @param {string} [data.gender] - Gender (MALE, FEMALE, OTHER)
   * @returns {Promise<GeneralAccount>} Updated or created GeneralAccount entity
   *
   * @example
   * ```typescript
   * const generalAccount = await accountsService.updateGeneralAccount(
   *   'account-uuid',
   *   {
   *     fullName: 'John Doe',
   *     gender: 'MALE'
   *   }
   * );
   * ```
   */
  async updateGeneralAccount(
    userId: string,
    data: {
      fullName?: string;
      gender?: string;
      dob?: Date;
      profilePicture?: string;
    },
  ): Promise<GeneralAccount> {
    let generalAccount = await this.findGeneralAccountByUserId(userId);

    if (generalAccount) {
      // Update existing
      if (data.fullName !== undefined) {
        generalAccount.fullName = data.fullName;
      }
      if (data.gender !== undefined) {
        generalAccount.gender = data.gender as any;
      }
      if (data.dob !== undefined) {
        generalAccount.dob = data.dob;
      }
      if (data.profilePicture !== undefined) {
        generalAccount.profilePicture = data.profilePicture;
      }
      return this.generalAccountRepository.saveGeneralAccount(generalAccount);
    } else {
      // Create new
      generalAccount = this.generalAccountRepository.createGeneralAccount({
        accountId: userId,
        fullName: data.fullName,
        gender: data.gender as any,
        dob: data.dob,
        profilePicture: data.profilePicture,
      });
      return this.generalAccountRepository.saveGeneralAccount(generalAccount);
    }
  }

  /**
   * Update Address and Google Iframe Information
   *
   * @param {string} accountId - The ID of the account
   * @param {UpdateAccountDto} dto - Data transfer object containing address and google iframe info
   * @private
   */
  private async updateAddressAndGoogleIframe(
    accountId: string,
    dto: UpdateAccountDto,
  ): Promise<void> {
    // 1. Update Address
    if (
      dto.address !== undefined ||
      dto.ward !== undefined ||
      dto.district !== undefined ||
      dto.province !== undefined ||
      dto.provinceName !== undefined ||
      dto.districtName !== undefined ||
      dto.wardName !== undefined
    ) {
      let address = await this.addressRepository.findByAccountId(accountId);
      if (address) {
        // Update existing address
        if (dto.address !== undefined) address.address = dto.address;
        if (dto.ward !== undefined) address.ward = dto.ward;
        if (dto.district !== undefined) address.district = dto.district;
        if (dto.province !== undefined) address.province = dto.province;
        if (dto.provinceName !== undefined)
          address.provinceName = dto.provinceName;
        if (dto.districtName !== undefined)
          address.districtName = dto.districtName;
        if (dto.wardName !== undefined) address.wardName = dto.wardName;
        await this.addressRepository.save(address);
      } else {
        // Create new address
        address = this.addressRepository.create({
          accountId,
          address: dto.address,
          ward: dto.ward,
          district: dto.district,
          province: dto.province,
          provinceName: dto.provinceName,
          districtName: dto.districtName,
          wardName: dto.wardName,
        });
        await this.addressRepository.save(address);
      }

      // 2. Update Google Iframe (Only if address exists or was created)
      if (
        address &&
        (dto.location !== undefined ||
          dto.mapStyle !== undefined ||
          dto.zoomLevel !== undefined ||
          dto.mapHeight !== undefined ||
          dto.mapWidth !== undefined ||
          dto.responsive !== undefined ||
          dto.googleMapIframe !== undefined)
      ) {
        let googleIframe = await this.googleIframeRepository.findByAddressId(
          address._id,
        );
        if (googleIframe) {
          // Update existing iframe
          if (dto.location !== undefined) googleIframe.location = dto.location;
          if (dto.mapStyle !== undefined) googleIframe.mapStyle = dto.mapStyle;
          if (dto.zoomLevel !== undefined)
            googleIframe.zoomLevel = dto.zoomLevel;
          if (dto.mapHeight !== undefined)
            googleIframe.mapHeight = dto.mapHeight;
          if (dto.mapWidth !== undefined) googleIframe.mapWidth = dto.mapWidth;
          if (dto.responsive !== undefined)
            googleIframe.responsive = dto.responsive;
          if (dto.googleMapIframe !== undefined)
            googleIframe.googleMapIframe = dto.googleMapIframe;
          await this.googleIframeRepository.save(googleIframe);
        } else {
          // Create new iframe
          googleIframe = this.googleIframeRepository.create({
            addressId: address._id,
            location: dto.location,
            mapStyle: dto.mapStyle,
            zoomLevel: dto.zoomLevel,
            mapHeight: dto.mapHeight,
            mapWidth: dto.mapWidth,
            responsive: dto.responsive !== undefined ? dto.responsive : true,
            googleMapIframe: dto.googleMapIframe,
          });
          await this.googleIframeRepository.save(googleIframe);
        }
      }
    }
  }

  /**
   * Update Clinic Admin Information
   *
   * Updates or creates clinic admin information for an account.
   * If the clinic admin information doesn't exist, it will be created.
   *
   * @param {string} accountId - Account UUID
   * @param {Partial<ClinicAdminInformation>} data - Clinic admin data to update
   * @returns {Promise<ClinicAdminInformation>} Updated or created clinic admin information
   *
   * @example
   * ```typescript
   * await accountsService.updateClinicAdminInformation(accountId, {
   *   clinicName: 'New Clinic Name',
   *   description: 'Updated description',
   *   specializedIn: ['Cardiology', 'Neurology']
   * });
   * ```
   */
  async updateClinicAdminInformation(
    accountId: string,
    data: {
      clinicName?: string;
      description?: string;
      specializedIn?: string[];
      pros?: string[];
      paraclinical?: string[];
      dob?: Date;
      profilePicture?: string;
      bankName?: string;
      bankNumber?: string;
      bankBranch?: string;
      sepayVa?: string;
      isVerify?: boolean;
    },
  ): Promise<ClinicAdminInformation> {
    let clinicAdminInfo =
      await this.clinicAdminInfoRepository.findByAccountId(accountId);

    if (clinicAdminInfo) {
      // Update existing
      if (data.clinicName !== undefined) {
        clinicAdminInfo.clinicName = data.clinicName;
      }
      if (data.description !== undefined) {
        clinicAdminInfo.description = data.description;
      }
      if (data.specializedIn !== undefined) {
        clinicAdminInfo.specializedIn = data.specializedIn;
      }
      if (data.pros !== undefined) {
        clinicAdminInfo.pros = data.pros;
      }
      if (data.paraclinical !== undefined) {
        clinicAdminInfo.paraclinical = data.paraclinical;
      }
      if (data.dob !== undefined) {
        clinicAdminInfo.dob = data.dob;
      }
      if (data.profilePicture !== undefined) {
        clinicAdminInfo.profilePicture = data.profilePicture;
      }
      if (data.bankName !== undefined) {
        clinicAdminInfo.bankName = data.bankName;
      }
      if (data.bankNumber !== undefined) {
        clinicAdminInfo.bankNumber = data.bankNumber;
      }
      if (data.bankBranch !== undefined) {
        clinicAdminInfo.bankBranch = data.bankBranch;
      }
      if (data.sepayVa !== undefined) {
        clinicAdminInfo.sepayVa = data.sepayVa;
      }
      if (data.isVerify !== undefined) {
        clinicAdminInfo.isVerify = data.isVerify;
      }
      return this.clinicAdminInfoRepository.save(clinicAdminInfo);
    } else {
      // Create new
      clinicAdminInfo = this.clinicAdminInfoRepository.create({
        accountId,
        ...data,
      });
      return this.clinicAdminInfoRepository.save(clinicAdminInfo);
    }
  }

  /**
   * Update Clinic Manager Information
   *
   * Updates or creates clinic manager information for an account.
   * If the clinic manager information doesn't exist, it will be created.
   *
   * @param {string} accountId - Account UUID
   * @param {Partial<ClinicManagerInformation>} data - Clinic manager data to update
   * @returns {Promise<ClinicManagerInformation>} Updated or created clinic manager information
   *
   * @example
   * ```typescript
   * await accountsService.updateClinicManagerInformation(accountId, {
   *   clinicBranchName: 'Branch 1',
   *   fullName: 'John Doe',
   *   gender: Gender.MALE
   * });
   * ```
   */
  async updateClinicManagerInformation(
    accountId: string,
    data: {
      clinicBranchName?: string;
      fullName?: string;
      gender?: string;
      profilePicture?: string;
      dob?: Date;
    },
  ): Promise<ClinicManagerInformation> {
    let managerInfo =
      await this.clinicManagerInfoRepository.findByAccountId(accountId);

    if (managerInfo) {
      // Update existing
      if (data.clinicBranchName !== undefined) {
        managerInfo.clinicBranchName = data.clinicBranchName;
      }
      if (data.fullName !== undefined) {
        managerInfo.fullName = data.fullName;
      }
      if (data.gender !== undefined) {
        managerInfo.gender = data.gender as any;
      }
      if (data.profilePicture !== undefined) {
        managerInfo.profilePicture = data.profilePicture;
      }
      if (data.dob !== undefined) {
        managerInfo.dob = data.dob;
      }
      return this.clinicManagerInfoRepository.save(managerInfo);
    } else {
      // Create new
      managerInfo = this.clinicManagerInfoRepository.create({
        accountId,
        clinicBranchName: data.clinicBranchName || '',
        fullName: data.fullName || '',
        gender: data.gender as any,
        profilePicture: data.profilePicture,
        dob: data.dob,
      });
      return this.clinicManagerInfoRepository.save(managerInfo);
    }
  }

  /**
   * Update Clinic Staff Information
   *
   * Updates or creates clinic staff information for an account.
   * If the clinic staff information doesn't exist, it will be created.
   *
   * @param {string} accountId - Account UUID
   * @param {Partial<ClinicStaffInformation>} data - Clinic staff data to update
   * @returns {Promise<ClinicStaffInformation>} Updated or created clinic staff information
   *
   * @example
   * ```typescript
   * await accountsService.updateClinicStaffInformation(accountId, {
   *   fullName: 'Jane Smith',
   *   gender: Gender.FEMALE,
   *   clinicRole: ClinicRole.NURSE
   * });
   * ```
   */
  async updateClinicStaffInformation(
    accountId: string,
    data: {
      fullName?: string;
      gender?: string;
      clinicRole?: string;
      dob?: Date;
      profilePicture?: string;
    },
  ): Promise<ClinicStaffInformation> {
    let staffInfo = await this.clinicStaffRepository.findByAccountId(accountId);

    if (staffInfo) {
      // Update existing
      if (data.fullName !== undefined) {
        staffInfo.fullName = data.fullName;
      }
      if (data.gender !== undefined) {
        staffInfo.gender = data.gender as any;
      }
      if (data.clinicRole !== undefined) {
        staffInfo.clinicRole = data.clinicRole as any;
      }
      if (data.dob !== undefined) {
        staffInfo.dob = data.dob;
      }
      if (data.profilePicture !== undefined) {
        staffInfo.profilePicture = data.profilePicture;
      }
      return this.clinicStaffRepository.save(staffInfo);
    } else {
      // Create new
      staffInfo = this.clinicStaffRepository.create({
        accountId,
        fullName: data.fullName || '',
        gender: data.gender as any,
        clinicRole: data.clinicRole as any,
        dob: data.dob,
        profilePicture: data.profilePicture,
      });
      return this.clinicStaffRepository.save(staffInfo);
    }
  }

  /**
   * Update Doctor Information
   *
   * Updates or creates doctor information for an account.
   * If the doctor information doesn't exist, it will be created.
   *
   * @param {string} accountId - Account UUID
   * @param {Partial<DoctorInformation>} data - Doctor data to update
   * @returns {Promise<DoctorInformation>} Updated or created doctor information
   *
   * @example
   * ```typescript
   * await accountsService.updateDoctorInformation(accountId, {
   *   fullName: 'Dr. John Smith',
   *   academicDegree: 'MD, PhD',
   *   experience: '10 years',
   *   position: 'Senior Cardiologist'
   * });
   * ```
   */
  async updateDoctorInformation(
    accountId: string,
    data: {
      fullName?: string;
      gender?: string;
      dob?: Date;
      profilePicture?: string;
      academicDegree?: string;
      experience?: string;
      position?: string;
      introduction1?: string;
      workProcess2?: Record<string, any>;
      studyProcess3?: Record<string, any>;
      members4?: Record<string, any>;
      scientificWork5?: Record<string, any>;
      papers6?: Record<string, any>;
      introductionImage?: string;
      professionalLicense?: Record<string, any>;
      certificatePracticalTraining?: Record<string, any>;
      medicalLicense?: Record<string, any>;
      identityNumber?: string;
      placeIdentityCard?: string;
      identityDate?: Date;
      bankNumber?: string;
      bankName?: string;
      bankBranch?: string;
    },
  ): Promise<DoctorInformation> {
    let doctorInfo = await this.doctorInfoRepository.findByAccountId(accountId);

    if (doctorInfo) {
      // Update existing
      if (data.fullName !== undefined) {
        doctorInfo.fullName = data.fullName;
      }
      if (data.gender !== undefined) {
        doctorInfo.gender = data.gender as any;
      }
      if (data.dob !== undefined) {
        doctorInfo.dob = data.dob;
      }
      if (data.profilePicture !== undefined) {
        doctorInfo.profilePicture = data.profilePicture;
      }
      if (data.academicDegree !== undefined) {
        doctorInfo.academicDegree = data.academicDegree;
      }
      if (data.experience !== undefined) {
        doctorInfo.experience = data.experience;
      }
      if (data.position !== undefined) {
        doctorInfo.position = data.position;
      }
      if (data.introduction1 !== undefined) {
        doctorInfo.introduction1 = data.introduction1;
      }
      if (data.workProcess2 !== undefined) {
        doctorInfo.workProcess2 = data.workProcess2;
      }
      if (data.studyProcess3 !== undefined) {
        doctorInfo.studyProcess3 = data.studyProcess3;
      }
      if (data.members4 !== undefined) {
        doctorInfo.members4 = data.members4;
      }
      if (data.scientificWork5 !== undefined) {
        doctorInfo.scientificWork5 = data.scientificWork5;
      }
      if (data.papers6 !== undefined) {
        doctorInfo.papers6 = data.papers6;
      }
      if (data.introductionImage !== undefined) {
        doctorInfo.introductionImage = data.introductionImage;
      }
      if (data.professionalLicense !== undefined) {
        doctorInfo.professionalLicense = data.professionalLicense;
      }
      if (data.certificatePracticalTraining !== undefined) {
        doctorInfo.certificatePracticalTraining =
          data.certificatePracticalTraining;
      }
      if (data.medicalLicense !== undefined) {
        doctorInfo.medicalLicense = data.medicalLicense;
      }
      if (data.identityNumber !== undefined) {
        doctorInfo.identityNumber = data.identityNumber;
      }
      if (data.placeIdentityCard !== undefined) {
        doctorInfo.placeIdentityCard = data.placeIdentityCard;
      }
      if (data.identityDate !== undefined) {
        doctorInfo.identityDate = data.identityDate;
      }
      if (data.bankNumber !== undefined) {
        doctorInfo.bankNumber = data.bankNumber;
      }
      if (data.bankName !== undefined) {
        doctorInfo.bankName = data.bankName;
      }
      if (data.bankBranch !== undefined) {
        doctorInfo.bankBranch = data.bankBranch;
      }
      return this.doctorInfoRepository.save(doctorInfo);
    } else {
      // Create new
      const { gender, ...restData } = data;
      doctorInfo = this.doctorInfoRepository.create({
        accountId,
        fullName: data.fullName || '',
        gender: gender as any,
        ...restData,
      });
      return this.doctorInfoRepository.save(doctorInfo);
    }
  }

  /**
   * Update Account Password
   *
   * Changes account password after verifying the current password.
   * Implements security best practices for password changes.
   *
   * Security Rules:
   * - Old password must match current password hash
   * - New password cannot be the same as old password (prevents accidental reuse)
   * - New password is hashed with bcrypt before storage
   * - Password requirements are enforced by DTO validation
   *
   * Password Requirements (enforced by UpdatePasswordDto):
   * - Minimum 6 characters
   * - Maximum 50 characters
   * - Must contain at least one letter
   * - Must contain at least one number
   *
   * Use Cases:
   * - User-initiated password change from settings
   * - Security-conscious password rotation
   * - Recovery from suspected account compromise
   *
   * @param {string} accountId - Account UUID
   * @param {UpdatePasswordDto} updatePasswordDto - Old and new password data
   * @returns {Promise<void>} No return value (204 No Content in controller)
   * @throws {NotFoundException} If account does not exist
   * @throws {UnauthorizedException} If old password is incorrect
   * @throws {ConflictException} If new password matches old password
   *
   * @example
   * ```typescript
   * await accountsService.updatePassword(accountId, {
   *   oldPassword: 'OldPass123',
   *   newPassword: 'NewSecurePass456'
   * });
   * // Password updated successfully
   * ```
   */
  async updatePassword(
    accountId: string,
    updatePasswordDto: UpdatePasswordDto,
  ): Promise<void> {
    const { oldPassword, newPassword } = updatePasswordDto;
    const account = await this.findAccountEntityById(accountId);

    const isPasswordMatching = await bcrypt.compare(
      oldPassword,
      account.password,
    );
    if (!isPasswordMatching) {
      throw new UnauthorizedException(MESSAGES.failMessage.incorrectPassword);
    }

    // Prevent reusing the same password
    if (oldPassword === newPassword) {
      throw new ConflictException(MESSAGES.failMessage.newPasswordSameAsOld);
    }

    // Hash and save new password
    account.password = await bcrypt.hash(newPassword, this.BCRYPT_SALT_ROUNDS);
    await this.accountRepository.saveAccount(account);
  }

  /**
   * Delete Account (Soft Delete)
   *
   * Performs a soft delete on an account by setting the deletedAt timestamp.
   * The account data is retained in the database for:
   * - Audit trails and compliance
   * - Potential account restoration
   * - Historical data integrity (e.g., past conversations, prescriptions)
   *
   * What is Soft Deleted:
   * - Account entity (accounts table)
   * - GeneralAccount entity (general_accounts table)
   *
   * What is NOT Deleted:
   * - Related entities (conversations, messages, prescriptions) remain intact
   * - Historical data is preserved
   *
   * Recovery:
   * - Use restore() method to recover soft-deleted accounts
   * - Admin-only operation (enforced at controller level)
   *
   * @param {string} id - Account UUID to delete
   * @returns {Promise<void>} No return value
   * @throws {NotFoundException} If account does not exist
   *
   * @see restore For account recovery
   * @see permanentDelete For irreversible deletion
   *
   * @example
   * ```typescript
   * await accountsService.delete('account-uuid');
   * // Account is soft-deleted but data is retained
   * ```
   */
  async delete(id: string): Promise<void> {
    const account = await this.findAccountEntityById(id);
    await this.accountRepository.softDeleteAccount(id);
    // Also soft delete the general account
    await this.generalAccountRepository.softDeleteGeneralAccount(id);
  }

  /**
   * Delete Employee Account (Soft Delete) - For Clinic Admin/Manager
   *
   * Performs a soft delete on an employee (Doctor or Staff) account.
   * Ensures the employee belongs to the exact same clinic as the requesting Admin/Manager.
   *
   * @param id Employee Account UUID
   * @param requestorId The UUID of the Admin or Manager making the request
   */
  async deleteEmployee(id: string, requestorId: string): Promise<void> {
    const employee = await this.findAccountEntityById(id);

    if (
      employee.role !== AccountRole.DOCTOR &&
      employee.role !== AccountRole.CLINIC_STAFF
    ) {
      throw new ForbiddenException(
        'Only doctors and clinic staff can be removed by clinic management',
      );
    }

    const requestor = await this.accountRepository.findAccountById(requestorId);
    if (!requestor)
      throw new NotFoundException(MESSAGES.failMessage.userNotFound);

    // Simplified Security Check: employee's parentId must strictly match the requestor's ID
    if (employee.parentId !== requestorId) {
      console.log('\n--- [DEBUG] DELETE EMPLOYEE LOGIC ---');
      console.log(`[REQUESTOR ID] (Manager): ${requestorId}`);
      console.log(
        `[EMPLOYEE PARENT ID] (Boss of this Staff): ${employee.parentId}`,
      );
      console.log(
        `[CHECK] Do they match? -> ${employee.parentId === requestorId}`,
      );
      console.log(`[RESULT] Access Denied because IDs do NOT match!`);
      console.log('-------------------------------------\n');

      throw new ForbiddenException(
        'You only have permission to delete employees that were created under your account (matching Parent ID).',
      );
    }

    console.log('\n--- [DEBUG] DELETE EMPLOYEE LOGIC ---');
    console.log(`[REQUESTOR ID] (Manager): ${requestorId}`);
    console.log(
      `[EMPLOYEE PARENT ID] (Boss of this Staff): ${employee.parentId}`,
    );
    console.log(
      `[CHECK] Do they match? -> ${employee.parentId === requestorId}`,
    );
    console.log(`[RESULT] Approved! Executing soft delete...`);
    console.log('-------------------------------------\n');

    // Pass access check, perform soft delete natively
    await this.accountRepository.softDeleteAccount(id);
    await this.generalAccountRepository.softDeleteGeneralAccount(id);
  }

  /**
   * Restore Soft-Deleted Account
   *
   * Restores a previously soft-deleted account by clearing the deletedAt timestamp.
   * This operation recovers both the Account and GeneralAccount entities.
   *
   * Business Rules:
   * - Account must have been soft-deleted (deletedAt is not null)
   * - Admin-only operation (enforced at controller level)
   * - Restores account to its previous state before deletion
   *
   * Restoration Scope:
   * - Account entity is restored
   * - GeneralAccount entity is restored
   * - Account status remains unchanged (e.g., BAN accounts stay BAN)
   *
   * Post-Restoration:
   * - Account can immediately log in (if status is ACTIVE)
   * - All historical data associations are intact
   *
   * @param {string} id - Account UUID to restore
   * @returns {Promise<AccountResponseDto>} Restored account DTO
   * @throws {NotFoundException} If account does not exist
   * @throws {BadRequestException} If account is not deleted
   *
   * @example
   * ```typescript
   * const restoredAccount = await accountsService.restore('account-uuid');
   * // Account is now active again
   * ```
   */
  async restore(id: string): Promise<AccountResponseDto> {
    const account = await this.accountRepository.findAccountByIdWithDeleted(id);

    if (!account) {
      throw new NotFoundException(MESSAGES.failMessage.userNotFound);
    }

    if (!account.deletedAt) {
      throw new BadRequestException(MESSAGES.failMessage.userNotDeleted);
    }

    await this.accountRepository.restoreAccount(id);
    await this.generalAccountRepository.restoreGeneralAccount(id);

    const restoredAccount = await this.findAccountEntityById(id);
    const generalAccount = await this.findGeneralAccountByUserId(id);
    return new AccountResponseDto(restoredAccount, generalAccount);
  }

  /**
   * Permanently Delete Account (Hard Delete)
   *
   * Permanently removes account from the database. This action is irreversible.
   *
   * WARNING:
   * - This is a destructive operation that cannot be undone
   * - All account data is permanently lost
   * - Use with extreme caution
   * - Consider soft delete (delete()) for most use cases
   *
   * Deletion Order (respects foreign key constraints):
   * 1. GeneralAccount entity is deleted first
   * 2. Account entity is deleted second
   *
   * Use Cases:
   * - Compliance with data deletion regulations (GDPR, etc.)
   * - User-requested data removal
   * - Database cleanup of test accounts
   *
   * @param {string} id - Account UUID to permanently delete
   * @returns {Promise<void>} No return value
   * @throws {NotFoundException} If account does not exist
   *
   * @see delete For reversible soft deletion
   *
   * @example
   * ```typescript
   * await accountsService.permanentDelete('account-uuid');
   * // Account is permanently removed from database
   * ```
   */
  async permanentDelete(id: string): Promise<void> {
    // Delete GeneralAccount first (foreign key constraint)
    await this.generalAccountRepository.deleteGeneralAccount(id);
    const affected = await this.accountRepository.deleteAccount(id);
    if (affected === 0) {
      throw new NotFoundException(MESSAGES.failMessage.userNotFound);
    }
  }

  /**
   * Ban Account
   *
   * Bans an account, preventing login and access to the system.
   * Implements administrative control over account access.
   *
   * Business Rules:
   * - Cannot ban ADMIN role accounts (system protection)
   * - Admin cannot ban themselves (prevents self-lockout)
   * - Cannot ban already banned accounts (prevents duplicate banning)
   * - Status is set to BAN
   * - Ban count is incremented (tracking repeated violations)
   * - Ban reason is stored for audit and review
   *
   * Effects of Banning:
   * - Account cannot log in
   * - Active sessions should be invalidated (implement at auth layer)
   * - Account status changes to BAN
   * - Ban metadata is recorded (reason, count)
   *
   * @param {string} accountId - Account UUID to ban
   * @param {BanAccountDto} banDto - Ban reason and metadata
   * @param {string} adminId - UUID of admin performing the ban
   * @returns {Promise<AccountResponseDto>} Banned account DTO
   * @throws {NotFoundException} If account does not exist
   * @throws {ForbiddenException} If attempting to ban admin or self
   * @throws {ConflictException} If account is already banned
   *
   * @example
   * ```typescript
   * const bannedAccount = await accountsService.banAccount(
   *   'user-uuid',
   *   { reason: 'Violation of terms of service' },
   *   'admin-uuid'
   * );
   * ```
   */
  async banAccount(
    accountId: string,
    banDto: BanAccountDto,
    adminId: string,
  ): Promise<AccountResponseDto> {
    const account = await this.findAccountEntityById(accountId);

    // Prevent banning admin accounts (system protection)
    if (account.role === AccountRole.ADMIN) {
      throw new ForbiddenException(MESSAGES.failMessage.cannotBanAdmin);
    }

    // Prevent admin from banning themselves (self-lockout protection)
    if (accountId === adminId) {
      throw new ForbiddenException(MESSAGES.failMessage.cannotBanSelf);
    }

    // Prevent duplicate banning
    if (account.status === AccountStatus.BAN) {
      throw new ConflictException(MESSAGES.failMessage.userAlreadyBanned);
    }

    // Apply ban
    account.status = AccountStatus.BAN;
    account.banCounts = (account.banCounts || 0) + 1;
    account.banDescription = banDto.reason;

    const bannedAccount = await this.accountRepository.saveAccount(account);
    const generalAccount = await this.findGeneralAccountByUserId(accountId);
    return new AccountResponseDto(bannedAccount, generalAccount);
  }

  /**
   * Unban Account
   *
   * Removes ban from an account, restoring access to the system.
   * This operation allows previously banned accounts to log in again.
   *
   * Business Rules:
   * - Account must currently be BAN
   * - Status is set to ACTIVE
   * - Ban count and ban description are preserved for audit purposes
   * - Admin-only operation (enforced at controller level)
   *
   * Effects of Unbanning:
   * - Account can log in again
   * - Status changes from BAN to ACTIVE
   * - Full access to system is restored
   * - Ban history is preserved (banCounts, banDescription)
   *
   * @param {string} accountId - Account UUID to unban
   * @returns {Promise<AccountResponseDto>} Unbanned account DTO
   * @throws {NotFoundException} If account does not exist
   * @throws {BadRequestException} If account is not currently banned
   *
   * @example
   * ```typescript
   * const unbannedAccount = await accountsService.unbanAccount('user-uuid');
   * // Account can now log in
   * ```
   */
  async unbanAccount(accountId: string): Promise<AccountResponseDto> {
    const account = await this.findAccountEntityById(accountId);

    if (account.status !== AccountStatus.BAN) {
      throw new BadRequestException(MESSAGES.failMessage.userNotBanned);
    }

    account.status = AccountStatus.ACTIVE;
    const unbannedAccount = await this.accountRepository.saveAccount(account);
    const generalAccount = await this.findGeneralAccountByUserId(accountId);
    return new AccountResponseDto(unbannedAccount, generalAccount);
  }

  /**
   * Update Account Status
   *
   * Directly updates the status of an account. 
   * This is used for security incidents like contract tampering.
   *
   * @param accountId - UUID of the account
   * @param status - New AccountStatus
   */
  async updateStatus(accountId: string, status: AccountStatus): Promise<void> {
    const account = await this.accountRepository.findAccountById(accountId);
    if (!account) {
      throw new NotFoundException('Account not found');
    }
    account.status = status;
    await this.accountRepository.saveAccount(account);
  }

  /**
   * Validate Account Access
   *
   * Validates whether an account is allowed to access the system based on its status.
   * This method is called during authentication to enforce account status rules.
   *
   * Access Rules:
   * - ACTIVE accounts have full access
   * - PENDING accounts cannot login (email verification required)
   * - BAN accounts cannot access the system (403 Forbidden)
   * - INACTIVE or DELETED accounts cannot access the system (401 Unauthorized)
   * - EXPIRED accounts cannot login (subscription renewal required)
   * - REFILL accounts cannot login (subscription refill required)
   *
   * Integration Points:
   * - Called by AuthService during login
   * - Called by JWT strategy during token validation
   * - Called before granting access to protected resources
   *
   * @param {Account} account - Account entity to validate
   * @returns {void} No return value - throws exception on validation failure
   * @throws {ForbiddenException} If account is BAN, EXPIRED, or REFILL
   * @throws {UnauthorizedException} If account is PENDING, INACTIVE, or DELETED
   *
   * @example
   * ```typescript
   * const account = await accountsService.findByEmail(email);
   * accountsService.validateAccountAccess(account);
   * // If no exception, account is allowed to access
   * ```
   */
  validateAccountAccess(account: Account): void {
    // BAN: Throw 403 Forbidden
    if (account.status === AccountStatus.BAN) {
      throw new ForbiddenException('Your account has been banned.');
    }

    // DELETED: Throw 401 Unauthorized - account deleted
    if (account.status === AccountStatus.DELETED) {
      throw new UnauthorizedException(
        'Your account has been deleted. Please contact support for assistance.',
      );
    }

    // UNVERIFIED and ACTIVE: Allow access (no exception thrown)
  }

  /**
   * Validate Manager Status for Operations
   *
   * Checks if a CLINIC_MANAGER account is in a valid state to allow:
   * - Creating Staff/Doctor accounts
   * - Being enabled/disabled by Admin
   *
   * @param managerId - UUID of CLINIC_MANAGER account
   * @param operation - Type of operation being performed
   * @throws {NotFoundException} If manager not found
   * @throws {ForbiddenException} If manager status blocks the operation
   * @throws {BadRequestException} If operation is invalid for current status
   * @returns {Promise<Account>} Validated manager account entity
   */
  private async validateManagerStatus(
    managerId: string,
    operation: 'CREATE_STAFF' | 'ENABLE' | 'DISABLE',
  ): Promise<Account> {
    const manager = await this.accountRepository.findAccountById(managerId);

    if (!manager) {
      throw new NotFoundException('Manager account not found');
    }

    if (manager.role !== AccountRole.CLINIC_MANAGER) {
      throw new ForbiddenException('Account is not a clinic manager');
    }

    // Block staff/doctor creation if manager is not ACTIVE
    if (operation === 'CREATE_STAFF') {
      if (manager.status === AccountStatus.PENDING_APPROVAL) {
        throw new ForbiddenException(
          'Cannot create staff. Manager legal documents pending approval. ' +
            'Please complete document verification first.',
        );
      }
      if (manager.status === AccountStatus.MANAGER_DISABLED) {
        throw new ForbiddenException(
          'Cannot create staff. Manager account is disabled. ' +
            'Please contact your clinic administrator.',
        );
      }
      if (manager.status !== AccountStatus.ACTIVE) {
        throw new ForbiddenException(
          'Manager account must be ACTIVE to create staff members.',
        );
      }
    }

    // Validate enable/disable operations
    if (
      operation === 'ENABLE' &&
      manager.status !== AccountStatus.MANAGER_DISABLED
    ) {
      throw new BadRequestException(
        'Can only enable managers with MANAGER_DISABLED status',
      );
    }

    if (operation === 'DISABLE' && manager.status !== AccountStatus.ACTIVE) {
      throw new BadRequestException(
        'Can only disable managers with ACTIVE status',
      );
    }

    return manager;
  }

  /**
   * Validate Parent Manager Status for Login
   *
   * Ensures Staff/Doctor cannot login if their parent Manager is disabled.
   * Implements cascading access control based on account hierarchy.
   *
   * @param account - Account attempting to login
   * @throws {ForbiddenException} If parent manager is disabled or pending approval
   */
  async validateParentManagerStatus(account: Account): Promise<void> {
    // Only check for Staff and Doctor roles
    if (
      account.role !== AccountRole.CLINIC_STAFF &&
      account.role !== AccountRole.DOCTOR
    ) {
      return;
    }

    // Verify parentId exists
    if (!account.parentId) {
      throw new ForbiddenException(
        'Account hierarchy error. No parent manager found.',
      );
    }

    // Fetch parent Manager account
    const parentManager = await this.accountRepository.findAccountById(
      account.parentId,
    );

    if (!parentManager) {
      throw new ForbiddenException(
        'Parent manager not found. Please contact support.',
      );
    }

    // Block login if parent Manager is MANAGER_DISABLED
    if (parentManager.status === AccountStatus.MANAGER_DISABLED) {
      throw new ForbiddenException(
        'Your clinic branch has been temporarily disabled. ' +
          'Please contact your clinic administrator for assistance.',
      );
    }

    // Block login if parent Manager is PENDING_APPROVAL
    if (parentManager.status === AccountStatus.PENDING_APPROVAL) {
      throw new ForbiddenException(
        'Your clinic branch is pending legal document approval. ' +
          'You will be able to login once verification is complete.',
      );
    }

    // Allow login if parent is ACTIVE
  }

  /**
   * Validate Clinic Subscription Status
   *
   * Validates that clinic-related roles have an active subscription before allowing login.
   * This method enforces subscription-based access control for clinic accounts.
   *
   * Hierarchy Resolution:
   * - CLINIC_ADMIN: Direct subscription check (user owns subscription)
   * - CLINIC_MANAGER: Parent is CLINIC_ADMIN (1 level up)
   * - CLINIC_STAFF/DOCTOR: Grandparent is CLINIC_ADMIN (2 levels up: Manager -> Admin)
   *
   * Allowed Subscription Statuses:
   * - ACTIVE: Full subscription access
   * - NON_RENEWING: Cancelled but still valid until expiration
   *
   * Blocked Statuses:
   * - EXPIRED: Subscription period ended
   * - PENDING_*: Registration not completed
   * - REJECTED: Registration rejected
   *
   * @param {Account} account - The account attempting to log in
   * @throws {ForbiddenException} If subscription is not active or has expired
   *
   * @example
   * ```typescript
   * const account = await accountsService.findByEmail(email);
   * await accountsService.validateClinicSubscription(account);
   * ```
   */
  async validateClinicSubscription(account: Account): Promise<void> {
    const clinicRoles = [
      AccountRole.CLINIC_ADMIN,
      AccountRole.CLINIC_MANAGER,
      AccountRole.CLINIC_STAFF,
      AccountRole.DOCTOR,
    ];

    // Skip validation for non-clinic roles
    if (!clinicRoles.includes(account.role)) {
      return;
    }

    let clinicAdminId: string;

    // Determine the root CLINIC_ADMIN based on role hierarchy
    if (account.role === AccountRole.CLINIC_ADMIN) {
      // Direct subscription check
      clinicAdminId = account._id;
    } else if (account.role === AccountRole.CLINIC_MANAGER) {
      // Parent is CLINIC_ADMIN
      if (!account.parentId) {
        throw new ForbiddenException(
          'Clinic subscription validation failed: No parent account found.',
        );
      }
      clinicAdminId = account.parentId;
    } else {
      // CLINIC_STAFF or DOCTOR: Parent is Manager, Grandparent is Admin
      if (!account.parentId) {
        throw new ForbiddenException(
          'Clinic subscription validation failed: No parent account found.',
        );
      }

      const parentAccount = await this.accountRepository.findAccountById(
        account.parentId,
      );

      if (!parentAccount || !parentAccount.parentId) {
        throw new ForbiddenException(
          'Clinic subscription validation failed: Invalid account hierarchy.',
        );
      }

      clinicAdminId = parentAccount.parentId;
    }

    // Retrieve subscription record for the clinic admin
    const subscription =
      await this.clinicSubscriptionRepository.findByClinicId(clinicAdminId);

    if (!subscription) {
      throw new ForbiddenException(
        'Clinic subscription not found. Please contact support.',
      );
    }

    // Role-specific validation logic
    if (account.role === AccountRole.CLINIC_ADMIN) {
      // CLINIC_ADMIN: Allow login even if subscription is EXPIRED 
      // to allow them to pay/renew.
      // Fine-grained access control is handled by ClinicSubscriptionGuard.
      return;
    }

    if (account.role === AccountRole.CLINIC_MANAGER) {
      // CLINIC_MANAGER: Two conditions must be met:
      // 1. Parent subscription must be ACTIVE or NON_RENEWING
      // 2. Manager's legal documents must be APPROVED

      // Check parent subscription status
      const allowedParentStatuses = [
        RegistrationStatus.ACTIVE,
        RegistrationStatus.NON_RENEWING,
      ];

      if (!allowedParentStatuses.includes(subscription.subscriptionStatus)) {
        throw new ForbiddenException(
          'Account is not ready or clinic is not active',
        );
      }

      // Check legal documents verification status
      const legalDocs = await this.clinicLegalDocsRepository.findByAccountId(
        account._id,
      );

      if (
        !legalDocs ||
        legalDocs.verificationStatus !==
          LegalDocumentVerificationStatus.APPROVED
      ) {
        throw new ForbiddenException(
          'Account is not ready or clinic is not active',
        );
      }

      return;
    }

    // CLINIC_STAFF or DOCTOR: Validate parent subscription is ACTIVE or NON_RENEWING
    const allowedStatuses = [
      RegistrationStatus.ACTIVE,
      RegistrationStatus.NON_RENEWING,
    ];

    if (!allowedStatuses.includes(subscription.subscriptionStatus)) {
      throw new ForbiddenException(
        'Clinic subscription is not active or has expired.',
      );
    }
  }

  /**
   * Resolve the root CLINIC_ADMIN ID for any clinic-related account.
   * Handles multi-level hierarchy (Doctor/Staff -> Manager -> Admin).
   * 
   * @param account The account to resolve
   * @returns The account ID of the root Clinic Admin
   */
  async resolveClinicAdminId(account: Account): Promise<string> {
    if (account.role === AccountRole.CLINIC_ADMIN) {
      return account._id;
    }

    if (account.role === AccountRole.CLINIC_MANAGER) {
      if (!account.parentId) {
        throw new ForbiddenException('No parent clinic admin found for this manager.');
      }
      return account.parentId;
    }

    // DOCTOR or STAFF: parent is Manager
    if (!account.parentId) {
      throw new ForbiddenException('No parent clinic manager found for this account.');
    }

    const parentAccount = await this.accountRepository.findAccountById(account.parentId);
    if (!parentAccount || !parentAccount.parentId) {
      throw new ForbiddenException('Invalid account hierarchy: Clinic owner not found.');
    }

    return parentAccount.parentId;
  }

  /**
   * Retrieves the current subscription for a clinic.
   * 
   * @param clinicId The account ID of the Clinic Admin
   * @returns Subscription entity or null if not found
   */
  async getClinicSubscription(clinicId: string): Promise<any> {
    return this.clinicSubscriptionRepository.findByClinicId(clinicId);
  }

  /**
   * Resolve Subscription Payload For JWT
   *
   * Returns subscription metadata for clinic-related roles:
   * - CLINIC_ADMIN: direct subscription
   * - CLINIC_MANAGER: parent CLINIC_ADMIN subscription
   * - CLINIC_STAFF/DOCTOR: manager -> parent CLINIC_ADMIN subscription
   */
  async getSubscriptionPayloadForAccount(account: Account): Promise<{
    subscriptionId?: string;
    subscriptionName?: string;
    subscriptionCode?: string;
  }> {
    const clinicRoles = [
      AccountRole.CLINIC_ADMIN,
      AccountRole.CLINIC_MANAGER,
      AccountRole.CLINIC_STAFF,
      AccountRole.DOCTOR,
    ];

    if (!clinicRoles.includes(account.role)) {
      return {};
    }

    let clinicAdminId: string | undefined;

    if (account.role === AccountRole.CLINIC_ADMIN) {
      clinicAdminId = account._id;
    } else if (account.role === AccountRole.CLINIC_MANAGER) {
      clinicAdminId = account.parentId;
    } else {
      if (!account.parentId) {
        return {};
      }

      const managerAccount = await this.accountRepository.findAccountById(
        account.parentId,
      );

      clinicAdminId = managerAccount?.parentId;
    }

    if (!clinicAdminId) {
      return {};
    }

    const subscription =
      await this.clinicSubscriptionRepository.findByClinicId(clinicAdminId);

    if (!subscription) {
      return {};
    }

    const service = await this.subscriptionServiceRepository.findById(
      subscription.serviceId,
    );

    return {
      subscriptionId: subscription._id,
      subscriptionName: service?.serviceName,
      subscriptionCode: service?.code,
    };
  }

  /**
   * Find Account by Email
   *
   * Retrieves an account by email address. Used for authentication and email uniqueness validation.
   *
   * Use Cases:
   * - Email/password authentication (login)
   * - Email uniqueness check during registration
   * - Password reset workflow
   * - Email verification workflow
   *
   * Security Note:
   * - Returns full Account entity including password hash
   * - Only use internally - never expose result directly to clients
   * - For public-facing operations, use findOne() with DTO transformation
   *
   * @param {string} email - Account email address (case-insensitive)
   * @returns {Promise<Account | null>} Account entity or null if not found
   *
   * @example
   * ```typescript
   * const account = await accountsService.findByEmail('user@example.com');
   * if (account) {
   *   // Verify password, etc.
   * }
   * ```
   */
  async findByEmail(email: string): Promise<Account | null> {
    return this.accountRepository.findAccountByEmail(email);
  }

  /**
   * Find Multiple Accounts by IDs
   *
   * Batch retrieval of accounts by their UUIDs. Useful for populating user data
   * in collections such as conversation participants, message recipients, etc.
   *
   * Performance Characteristics:
   * - Uses SQL IN clause for efficient batch retrieval
   * - Returns accounts in arbitrary order (not necessarily matching input order)
   * - Returns only existing accounts (missing IDs are silently ignored)
   *
   * Use Cases:
   * - Loading conversation participants
   * - Populating user lists for messages
   * - Batch user data retrieval for reports
   *
   * @param {string[]} ids - Array of account UUIDs
   * @returns {Promise<Account[]>} Array of account entities (empty if no IDs or none found)
   *
   * @example
   * ```typescript
   * const accounts = await accountsService.findAccountsByIds([
   *   'uuid-1',
   *   'uuid-2',
   *   'uuid-3'
   * ]);
   * // Returns array of found accounts
   * ```
   */
  async findAccountsByIds(ids: string[]): Promise<Account[]> {
    return this.accountRepository.findAccountsByIds(ids);
  }

  /**
   * Verify Email with Code
   *
   * Verifies user's email address using a 6-digit verification code sent to their email.
   * Updates account status to ACTIVE upon successful verification.
   *
   * Verification Workflow:
   * 1. Find account by email
   * 2. Check if already verified (prevent duplicate verification)
   * 3. Find most recent unused verification code
   * 4. Validate code hasn't expired (10 minutes TTL)
   * 5. Mark code as used (prevent reuse)
   * 6. Set isEmailVerified = true
   * 7. Activate account (PENDING → ACTIVE)
   *
   * Security Features:
   * - Codes expire after 10 minutes
   * - One-time use (marked as used after verification)
   * - Most recent code is used (allows resend)
   *
   * @param {string} email - Account email address
   * @param {string} code - 6-digit verification code
   * @returns {Promise<Account & {firstName?: string, lastName?: string}>} Verified account with name fields
   * @throws {NotFoundException} If account does not exist
   * @throws {ConflictException} If email is already verified
   * @throws {UnauthorizedException} If code is invalid or expired
   *
   * @example
   * ```typescript
   * const account = await accountsService.verifyEmailCode(
   *   'user@example.com',
   *   '123456'
   * );
   * // Account is now verified and active
   * ```
   */
  async verifyEmailCode(
    email: string,
    code: string,
  ): Promise<Account & { firstName?: string; lastName?: string }> {
    const account = await this.findByEmail(email);
    if (!account) {
      throw new NotFoundException(MESSAGES.failMessage.userNotFound);
    }

    if (account.isEmailVerified) {
      throw new ConflictException(MESSAGES.failMessage.emailAlreadyVerified);
    }

    // Find the verification code in the database
    const storedCode =
      await this.codeVerificationRepository.findValidByUserIdAndCode(
        account._id,
        code,
        VerificationType.VERIFY,
      );

    if (!storedCode) {
      throw new UnauthorizedException(
        MESSAGES.failMessage.invalidVerificationCode,
      );
    }

    // Check if code has expired
    if (getCurrentVietnamTime() > storedCode.expiredAt) {
      throw new UnauthorizedException(
        MESSAGES.failMessage.verificationCodeExpired,
      );
    }

    // Mark code as used (prevent reuse)
    await this.codeVerificationRepository.markAsUsed(storedCode._id);

    // Mark email as verified and activate account
    account.isEmailVerified = true;
    // Update account status from UNVERIFIED to ACTIVE
    if (account.status === AccountStatus.UNVERIFIED) {
      account.status = AccountStatus.ACTIVE;
    }
    await this.accountRepository.saveAccount(account);

    // Get general account for firstName/lastName (split fullName)
    const generalAccount = await this.findGeneralAccountByUserId(account._id);
    const names = generalAccount?.fullName?.split(' ') || [];

    return {
      ...account,
      firstName: names[0] || account.username,
      lastName: names.slice(1).join(' ') || undefined,
    };
  }

  /**
   * Resend Email Verification Code
   *
   * Generates a new verification code and stores it in the database.
   * The code should be sent via email by the calling service/controller.
   *
   * Use Cases:
   * - User didn't receive original verification email
   * - Original verification code expired
   * - User needs a fresh code
   *
   * Code Properties:
   * - 6-digit numeric code
   * - Expires in 10 minutes
   * - One-time use
   * - Type: VERIFY (account verification)
   *
   * @param {string} email - Account email address
   * @returns {Promise<{code: string, user: Account & {firstName?: string}}>} Generated code and user data for email
   * @throws {NotFoundException} If account does not exist
   * @throws {ConflictException} If email is already verified
   *
   * @example
   * ```typescript
   * const { code, user } = await accountsService.resendVerificationCode(
   *   'user@example.com'
   * );
   * // Send code via email service
   * await mailerService.sendVerificationEmail(user.email, code, user.username);
   * ```
   */
  async resendVerificationCode(
    email: string,
  ): Promise<{ code: string; user: Account }> {
    const account = await this.findByEmail(email);
    if (!account) {
      throw new NotFoundException(MESSAGES.failMessage.userNotFound);
    }

    if (account.isEmailVerified) {
      throw new ConflictException(MESSAGES.failMessage.emailAlreadyVerified);
    }

    // Invalidate all previous verification codes for this user
    await this.codeVerificationRepository.invalidateAllUserCodes(
      account._id,
      VerificationType.VERIFY,
    );

    // Generate new 6-digit code
    const code = generateVerificationCode();

    // Store code in database with expiration (10 minutes)
    const expiredAt = addToVietnamTime(10, 'minute');

    const verification = this.codeVerificationRepository.create({
      accountId: account._id,
      code,
      expiredAt,
      used: false,
      type: VerificationType.VERIFY,
    });
    await this.codeVerificationRepository.save(verification);

    return {
      code,
      user: account,
    };
  }

  /**
   * Initiate Password Reset
   *
   * Generates a password reset code and stores it for later verification.
   * The code should be sent via email by the calling service/controller.
   *
   * Workflow:
   * 1. Validate account exists
   * 2. Check account is not OAuth-only (OAuth users can't reset password)
   * 3. Generate 6-digit reset code
   * 4. Store code with 15-minute expiration
   * 5. Return code for email transmission
   *
   * Code Properties:
   * - 6-digit numeric code
   * - Expires in 15 minutes (longer than email verification)
   * - One-time use
   * - Type: RESET verification
   *
   * Business Rules:
   * - OAuth-only accounts (no password set) cannot reset password
   * - Code expires after 15 minutes for security
   *
   * @param {string} email - Account email address
   * @returns {Promise<{code: string, user: Account}>} Generated reset code and account data
   * @throws {NotFoundException} If account does not exist
   * @throws {BadRequestException} If account is OAuth-only
   *
   * @example
   * ```typescript
   * const { code, user } = await accountsService.initiatePasswordReset(
   *   'user@example.com'
   * );
   * // Send reset code via email
   * await mailerService.sendPasswordResetEmail(user.email, code, user.username);
   * ```
   */
  async initiatePasswordReset(
    email: string,
  ): Promise<{ code: string; user: Account }> {
    const account = await this.findByEmail(email);

    if (!account) {
      throw new NotFoundException(MESSAGES.failMessage.userNotFound);
    }

    // OAuth users cannot reset password (they don't have one)
    if (account.isOAuthUser && !account.password) {
      throw new BadRequestException(
        MESSAGES.failMessage.oauthUserCannotResetPassword,
      );
    }

    // Invalidate all previous verification codes for this user
    await this.codeVerificationRepository.invalidateAllUserCodes(
      account._id,
      VerificationType.RESET,
    );

    // Generate new 6-digit code
    const code = generateVerificationCode();

    // Store code in database with expiration (15 minutes for password reset)
    const expiredAt = addToVietnamTime(15, 'minute');

    const verification = this.codeVerificationRepository.create({
      accountId: account._id,
      code,
      expiredAt,
      used: false,
      type: VerificationType.RESET,
    });
    await this.codeVerificationRepository.save(verification);

    return {
      code,
      user: {
        ...account,
        username: account.username,
      },
    };
  }

  /**
   * Reset Password with Verification Code
   *
   * Resets account password using a previously sent verification code.
   * Implements secure password reset workflow with code validation.
   *
   * Workflow:
   * 1. Find account by email
   * 2. Validate account is not OAuth-only
   * 3. Find most recent unused RESET code
   * 4. Validate code hasn't expired (15 minutes)
   * 5. Mark code as used
   * 6. Hash and save new password
   *
   * Security Features:
   * - Code expires after 15 minutes
   * - One-time use (prevents code reuse)
   * - Password is hashed with bcrypt before storage
   * - OAuth-only accounts are blocked
   *
   * @param {string} email - Account email address
   * @param {string} newPassword - New password (validated by DTO)
   * @returns {Promise<void>} No return value
   * @throws {NotFoundException} If account does not exist
   * @throws {BadRequestException} If account is OAuth-only
   * @throws {UnauthorizedException} If code is invalid or expired
   *
   * @example
   * ```typescript
   * await accountsService.resetPasswordWithCode(
   *   'user@example.com',
   *   '123456',
   *   'NewSecurePass123'
   * );
   * // Password is now reset
   * ```
   */
  async resetPasswordWithCode(
    email: string,
    code: string,
    newPassword: string,
  ): Promise<void> {
    const account = await this.findByEmail(email);
    if (!account) {
      throw new NotFoundException(MESSAGES.failMessage.userNotFound);
    }

    // OAuth users cannot reset password
    if (account.isOAuthUser) {
      throw new BadRequestException(
        MESSAGES.failMessage.oauthUserCannotResetPassword,
      );
    }

    // Find the reset code in the database
    const storedCode =
      await this.codeVerificationRepository.findValidByUserIdAndCode(
        account._id,
        code,
        VerificationType.RESET,
      );

    if (!storedCode) {
      throw new UnauthorizedException(MESSAGES.failMessage.invalidResetCode);
    }

    // Check if code has expired
    if (getCurrentVietnamTime() > storedCode.expiredAt) {
      throw new UnauthorizedException(MESSAGES.failMessage.resetCodeExpired);
    }

    // Mark code as used
    await this.codeVerificationRepository.markAsUsed(storedCode._id);

    // Hash and update password
    account.password = await bcrypt.hash(newPassword, this.BCRYPT_SALT_ROUNDS);
    await this.accountRepository.saveAccount(account);
  }

  /**
   * Validate Clinic Manager Role
   *
   * Validates that an account has the CLINIC_MANAGER role.
   * This helper method ensures that only accounts with the correct role can have
   * associated ClinicManagerInformation records.
   *
   * Use Cases:
   * - Before creating ClinicManagerInformation records
   * - Before updating ClinicManagerInformation records
   * - Ensuring data integrity between Account role and ClinicManagerInformation
   *
   * @param {Account} account - Account entity to validate
   * @throws {BadRequestException} If account does not have CLINIC_MANAGER role
   *
   * @example
   * ```typescript
   * const account = await this.findAccountEntityById(id);
   * this.validateClinicManagerRole(account);
   * // If no exception, account has CLINIC_MANAGER role
   * ```
   */
  private validateClinicManagerRole(account: Account): void {
    if (account.role !== AccountRole.CLINIC_MANAGER) {
      throw new BadRequestException(
        'Only accounts with CLINIC_MANAGER role can have clinic manager information. ' +
          `Current role: ${account.role}`,
      );
    }
  }

  /**
   * Get Usernames and Emails
   *
   * Retrieves lists of all usernames and emails in the system.
   * Useful for frontend validation to check username/email availability during registration.
   *
   * Use Cases:
   * - Client-side validation of username uniqueness
   * - Client-side validation of email uniqueness
   * - Admin dashboards showing all registered accounts
   * - Data export for analytics
   *
   * Security Consideration:
   * - This endpoint exposes all usernames and emails
   * - Consider rate limiting or authentication requirements
   * - May want to restrict to admin-only in production
   *
   * Performance:
   * - Loads all accounts into memory
   * - Consider pagination for large user bases
   *
   * @returns {Promise<UsernameEmailListDto>} Object containing username and email arrays
   *
   * @example
   * ```typescript
   * const { username, email } = await accountsService.getUsernamesAndEmails();
   * // username: ['john', 'jane', 'admin']
   * // email: ['john@example.com', 'jane@example.com', 'admin@example.com']
   * ```
   */
  async getUsernamesAndEmails(): Promise<UsernameEmailListDto> {
    const accounts = await this.accountRepository.findAllAccounts();

    return {
      username: accounts
        .map((account) => account.username)
        .filter((name) => !!name),
      email: accounts.map((account) => account.email),
    };
  }

  /**
   * Create Account (Single-Step Registration)
   *
   * Creates a complete account with profile in a single transaction.
   * This is the new unified registration method that combines account creation and profile setup.
   *
   * Transaction Behavior:
   * - Creates Account entity with PENDING status
   * - Creates GeneralAccount profile data
   * - If any step fails, entire transaction is rolled back
   * - This ensures data integrity across both tables
   *
   * Business Rules:
   * - Role is automatically set to PATIENT
   * - Status is set to PENDING
   * - Email must be unique across all accounts
   * - Password is hashed with bcrypt before storage
   * - fullName and gender are required for profile
   * - User must verify email before account becomes ACTIVE
   *
   * Security:
   * - Password is hashed with bcrypt (10 rounds)
   * - Email uniqueness is validated
   *
   * @param {CreateAccountDto} dto - Complete account data (credentials + profile)
   * @returns {Promise<AccountResponseDto>} Created account with profile data
   * @throws {ConflictException} If email already exists
   * @throws {Error} Any error will trigger transaction rollback
   *
   * @example
   * ```typescript
   * const account = await accountsService.createAccount({
   *   username: 'johndoe',
   *   email: 'john@example.com',
   *   password: 'SecurePass123',
   *   fullName: 'John Doe',
   *   gender: Gender.MALE
   * });
   * // Account is now PENDING, ready for email verification
   * ```
   */
  async createAccount(dto: CreateAccountDto): Promise<AccountResponseDto> {
    // Step 1: Validate email uniqueness
    const existingAccount = await this.findByEmail(dto.email);
    if (existingAccount) {
      throw new ConflictException(MESSAGES.failMessage.userEmailAlreadyExists);
    }

    // Step 2: Hash password for secure storage
    const hashedPassword = await bcrypt.hash(
      dto.password,
      this.BCRYPT_SALT_ROUNDS,
    );

    // Step 3: Create both Account and GeneralAccount in a transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create Account entity with PENDING status
      const account = this.accountRepository.createAccount({
        username: dto.username,
        email: dto.email,
        password: hashedPassword,
        phone: dto.phone,
        role: AccountRole.PATIENT,
        status: AccountStatus.ACTIVE,
      });

      const savedAccount = await queryRunner.manager.save(account);

      // Create GeneralAccount profile
      const generalAccount = this.generalAccountRepository.createGeneralAccount(
        {
          accountId: savedAccount._id,
          fullName: dto.fullName,
          gender: dto.gender,
          dob: dto.dob ? new Date(dto.dob) : undefined,
          profilePicture: dto.profilePicture,
        },
      );

      const savedGeneralAccount =
        await queryRunner.manager.save(generalAccount);

      await queryRunner.commitTransaction();

      // Call Zalo webhook to send friend request
      await this.zaloWebhookService.sendFriendRequest(savedAccount.phone, 'Patient Registration (Manual)');

      // Generate new 6-digit code
      const code = generateVerificationCode();

      // Store code in database with expiration (15 minutes for password reset)
      const expiredAt = addToVietnamTime(15, 'minute');

      const verification = this.codeVerificationRepository.create({
        accountId: savedAccount._id,
        code,
        expiredAt,
        used: false,
        type: VerificationType.VERIFY,
      });

      await this.codeVerificationRepository.save(verification);

      // Send verification email
      await this.mailerService.sendVerificationCode(
        savedAccount.email,
        code,
        savedAccount.username,
      );

      return new AccountResponseDto(savedAccount, savedGeneralAccount);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Create Clinic Manager Account
   *
   * Creates a clinic manager account with full permissions to manage clinic operations.
   * Clinic managers have the following permissions:
   * - Add CLINIC_STAFF accounts
   * - Add DOCTOR accounts
   * - Update clinic legal documents
   * - Update Google iframe information
   * - Update doctor documents
   *
   * This method creates:
   * 1. Account entity with CLINIC_MANAGER role
   * 2. ClinicManagerInformation entity with manager details
   *
   * Role Enforcement:
   * - Only accounts with CLINIC_MANAGER role can have ClinicManagerInformation records
   * - Before creating ClinicManagerInformation, the account's role is validated
   * - Throws BadRequestException if the account does not have CLINIC_MANAGER role
   *
   * Transaction Behavior:
   * - If any step fails, all changes are rolled back
   * - Ensures data integrity across both tables
   *
   * @param {string} patientId - Patient account ID creating the clinic manager
   * @param {CreateClinicManagerDto} dto - Clinic manager registration data
   * @returns {Promise<AccountResponseDto>} Created clinic manager account with all related data
   * @throws {NotFoundException} If patient account does not exist
   * @throws {ForbiddenException} If patient account does not have PATIENT role
   * @throws {ConflictException} If email already exists
   * @throws {BadRequestException} If account does not have CLINIC_MANAGER role (should not occur in normal flow)
   * @throws {Error} Any error will trigger rollback
   *
   * @example
   * ```typescript
   * const manager = await accountsService.createClinicManager(patientId, {
   *   username: 'clinicmanager',
   *   email: 'manager@clinic.com',
   *   password: 'ManagerPass123',
   *   fullName: 'Dr. John Smith',
   *   clinicName: 'City Medical Clinic',
   *   description: 'A modern healthcare facility'
   * });
   * ```
   */

  /**
   * Create Clinic Staff by Clinic Manager
   *
   * Allows clinic managers to add staff accounts to their clinic.
   * Staff accounts are linked to the clinic manager's clinic.
   *
   * Permission Check:
   * - Validates that the manager has CLINIC_MANAGER role
   * - Only clinic managers can add staff
   *
   * This method creates:
   * 1. Account entity with CLINIC_STAFF role
   * 2. ClinicStaffInformation entity with staff details
   *
   * @param {string} managerId - Clinic manager's account UUID
   * @param {CreateStaffByClinicManagerDto} dto - Staff registration data
   * @returns {Promise<AccountResponseDto>} Created staff account
   * @throws {NotFoundException} If manager account doesn't exist
   * @throws {ForbiddenException} If account is not a clinic manager
   * @throws {ConflictException} If email already exists
   *
   * @example
   * ```typescript
   * const staff = await accountsService.createStaffByClinicManager(managerId, {
   *   email: 'staff@clinic.com',
   *   password: 'StaffPass123',
   *   fullName: 'Jane Doe',
   *   gender: Gender.FEMALE,
   *   clinicRole: ClinicRole.RECEPTIONIST
   * });
   * ```
   */
  async createStaffByClinicManager(
    managerId: string,
    dto: CreateStaffByClinicManagerDto,
  ): Promise<AccountResponseDto> {
    // Step 1: Validate manager exists and has CLINIC_MANAGER role
    const manager = await this.findAccountEntityById(managerId);
    if (manager.role !== AccountRole.CLINIC_MANAGER) {
      throw new ForbiddenException(
        'Only clinic managers can add staff members',
      );
    }

    // Step 1.5: Validate manager status allows staff creation
    await this.validateManagerStatus(managerId, 'CREATE_STAFF');

    // Step 2: Validate email uniqueness
    const existingAccount = await this.findByEmail(dto.email);
    if (existingAccount) {
      throw new ConflictException(MESSAGES.failMessage.userEmailAlreadyExists);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Step 3: Hash password & Generate Keys
      const hashedPassword = await bcrypt.hash(
        dto.password,
        this.BCRYPT_SALT_ROUNDS,
      );
      const { publicKey, privateKey: encryptedPrivateKey } = generateRSAKeyPair();

      // Step 4: Create Account entity with CLINIC_STAFF role
      // Following 2-step registration pattern: Create ACTIVE account first
      const account = this.accountRepository.createAccount({
        username: dto.email.split('@')[0],
        email: dto.email,
        password: hashedPassword,
        parentId: managerId, // Link to clinic manager
        role: AccountRole.CLINIC_STAFF,
        status: AccountStatus.PENDING_APPROVAL, // Account starts in pending approval state
        isEmailVerified: false, // Staff must verify themselves
        publicKey,
        encryptedPrivateKey,
      });

      const savedAccount = await queryRunner.manager.save(account);

      // Step 5: Create ClinicStaffInformation entity with basic info
      const staffInfo = this.clinicStaffRepository.create({
        accountId: savedAccount._id,
        fullName: dto.fullName,
        gender: dto.gender,
        clinicRole: dto.clinicRole,
      });

      await queryRunner.manager.save(staffInfo);

      await queryRunner.commitTransaction();

      // Staff account requires additional profile completion by user
      return new AccountResponseDto(savedAccount, null);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Create Doctor by Clinic Manager
   *
   * Allows clinic managers to add doctor accounts to their clinic.
   * Doctor accounts are linked to the clinic manager's clinic.
   *
   * Permission Check:
   * - Validates that the manager has CLINIC_MANAGER role
   * - Only clinic managers can add doctors
   *
   * This method creates:
   * 1. Account entity with DOCTOR role
   * 2. DoctorInformation entity with doctor details
   *
   * @param {string} managerId - Clinic manager's account UUID
   * @param {CreateDoctorByClinicManagerDto} dto - Doctor registration data
   * @returns {Promise<AccountResponseDto>} Created doctor account
   * @throws {NotFoundException} If manager account doesn't exist
   * @throws {ForbiddenException} If account is not a clinic manager
   * @throws {ConflictException} If email already exists
   *
   * @example
   * ```typescript
   * const doctor = await accountsService.createDoctorByClinicManager(managerId, {
   *   email: 'doctor@clinic.com',
   *   password: 'DoctorPass123',
   *   fullName: 'Dr. John Smith',
   *   gender: Gender.MALE,
   *   academicDegree: 'MD, PhD',
   *   specialization: 'Cardiology',
   *   consultationFee: 500000
   * });
   * ```
   */
  async createDoctorByClinicManager(
    managerId: string,
    dto: CreateDoctorByClinicManagerDto,
  ): Promise<AccountResponseDto> {
    // Step 1: Validate manager exists and has CLINIC_MANAGER role
    const manager = await this.findAccountEntityById(managerId);
    if (manager.role !== AccountRole.CLINIC_MANAGER) {
      throw new ForbiddenException('Only clinic managers can add doctors');
    }

    // Step 1.5: Validate manager status allows doctor creation
    await this.validateManagerStatus(managerId, 'CREATE_STAFF');

    // Step 2: Validate email uniqueness
    const existingAccount = await this.findByEmail(dto.email);
    if (existingAccount) {
      throw new ConflictException(MESSAGES.failMessage.userEmailAlreadyExists);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Step 3: Hash password & Generate Keys
      const hashedPassword = await bcrypt.hash(
        dto.password,
        this.BCRYPT_SALT_ROUNDS,
      );
      const { publicKey, privateKey: encryptedPrivateKey } = generateRSAKeyPair();

      // Step 4: Create Account entity with DOCTOR role
      // Following 2-step registration pattern: Create PENDING account first
      const account = this.accountRepository.createAccount({
        username: dto.email.split('@')[0],
        email: dto.email,
        password: hashedPassword,
        parentId: managerId, // Link to clinic manager
        role: AccountRole.DOCTOR,
        status: AccountStatus.PENDING_APPROVAL, // Account starts in pending approval state
        isEmailVerified: false, // Doctor must verify themselves
        publicKey,
        encryptedPrivateKey,
      });

      const savedAccount = await queryRunner.manager.save(account);

      // Step 5: Create DoctorInformation entity with basic info
      const doctorInfo = this.doctorInfoRepository.create({
        accountId: savedAccount._id,
        fullName: dto.fullName,
        gender: dto.gender,
        academicDegree: dto.academicDegree,
        experience: dto.experience,
        position: dto.position,
      });

      await queryRunner.manager.save(doctorInfo);

      await queryRunner.commitTransaction();

      // Doctor account requires additional profile completion by user
      return new AccountResponseDto(savedAccount, null);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Find All Clinics with Pagination, Search and Filters
   *
   * Retrieves clinic accounts with pagination support and optional search/filter capabilities.
   * Only returns accounts with role: CLINIC_MANAGER and status: ACTIVE
   * Excludes soft-deleted records (deletedAt is null)
   *
   * Data Sources:
   * - accounts table: Core account data
   * - clinic_manager_information table: Clinic manager details
   * - addresses table: Address information
   * - accounts table (parent): CLINIC_ADMIN account linked via parentId
   * - clinic_admin_information table: Clinic admin details
   *
   * Filtering Logic:
   * - search: Case-insensitive match on clinicBranchName AND description
   * - province: Exact match on provinceName or province code
   * - specialty: JSONB containment query on specializedIn array
   * - All filters work together with AND logic
   *
   * @param {number} page - Page number (default: 1)
   * @param {number} limit - Items per page (default: 10)
   * @param {string} [search] - Search keyword for clinic name or description
   * @param {string} [province] - Filter by province name or code
   * @param {string} [specialty] - Filter by medical specialization
   * @returns {Promise<ClinicListResponseDto>} Clinics with pagination
   */
  async findAllClinicsManager(
    page: number = 1,
    limit: number = 10,
    search?: string,
    province?: string,
    specialty?: string,
  ): Promise<ClinicListResponseDto> {
    // Get clinic manager accounts with ACTIVE status and filters
    // The query now includes parent account (CLINIC_ADMIN) and clinic_admin_information
    const [clinics, total] =
      await this.accountRepository.findClinicsWithFilters(
        AccountRole.CLINIC_MANAGER,
        AccountStatus.ACTIVE,
        (page - 1) * limit,
        limit,
        search,
        province,
        specialty,
      );

    const clinicItems: ClinicItemDto[] = [];

    for (const clinic of clinics) {
      // Get clinic manager information
      const clinicInfo = await this.clinicManagerInfoRepository.findByAccountId(
        clinic._id,
      );

      // Get primary address (first address)
      const address = await this.addressRepository.findByAccountId(clinic._id);

      // Get clinic admin information from parent account
      let clinicAdminInfo = null;
      if (clinic.parent && clinic.parent.clinicAdminInformation) {
        clinicAdminInfo = clinic.parent.clinicAdminInformation;
      }

      // Calculate average rating for this clinic
      let averageRating: number | undefined;
      try {
        const ratingResult = await this.dataSource.query(`
          SELECT AVG(f.rating)::NUMERIC(3,2) as avg_rating
          FROM feedbacks f
          WHERE f.clinic_id = $1
            AND f.type = 'CLINIC'
            AND f.deleted_at IS NULL
        `, [clinic._id]);
        averageRating = ratingResult[0]?.avg_rating ? parseFloat(ratingResult[0].avg_rating) : 0;
      } catch {
        averageRating = 0;
      }

      if (clinicInfo && address) {
        clinicItems.push(
          new ClinicItemDto(clinic, clinicInfo, address, clinicAdminInfo, averageRating),
        );
      }
    }

    const totalPages = Math.ceil(total / limit);

    return {
      clinics: clinicItems,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Find All Clinics with Pagination, Search and Filters
   *
   * Retrieves clinic accounts with pagination support and optional search/filter capabilities.
   * Only returns accounts with role: CLINIC_MANAGER and status: ACTIVE
   * Excludes soft-deleted records (deletedAt is null)
   *
   * Data Sources:
   * - accounts table: Core account data
   * - clinic_manager_information table: Clinic manager details
   * - addresses table: Address information
   * - accounts table (parent): CLINIC_ADMIN account linked via parentId
   * - clinic_admin_information table: Clinic admin details
   *
   * Filtering Logic:
   * - search: Case-insensitive match on clinicBranchName AND description
   * - province: Exact match on provinceName or province code
   * - specialty: JSONB containment query on specializedIn array
   * - All filters work together with AND logic
   *
   * @param {number} page - Page number (default: 1)
   * @param {number} limit - Items per page (default: 10)
   * @param {string} [search] - Search keyword for clinic name or description
   * @param {string} [province] - Filter by province name or code
   * @param {string} [specialty] - Filter by medical specialization
   * @returns {Promise<ClinicListResponseDto>} Clinics with pagination
   */
  async findAllClinicsAdmin(
    page: number = 1,
    limit: number = 10,
    search?: string,
    province?: string,
    specialty?: string,
  ): Promise<ClinicListResponseDto> {
    // Get clinic admin accounts with ACTIVE status and filters
    const [clinics, total] =
      await this.accountRepository.findClinicsAdminWithFilters(
        AccountRole.CLINIC_ADMIN,
        AccountStatus.ACTIVE,
        (page - 1) * limit,
        limit,
        search,
        province,
        specialty,
        RegistrationStatus.ACTIVE ||
          RegistrationStatus.NON_RENEWING ||
          RegistrationStatus.EXPIRED,
      );

    const clinicItems: ClinicItemDto[] = [];

    for (const clinic of clinics) {
      // Get clinic admin information
      const clinicAdminInfo =
        await this.clinicAdminInfoRepository.findByAccountId(clinic._id);

      // Get primary address (first address)
      const address = await this.addressRepository.findByAccountId(clinic._id);

      // Calculate average rating for this clinic
      let averageRating: number | undefined;
      try {
        const ratingResult = await this.dataSource.query(`
          SELECT AVG(f.rating)::NUMERIC(3,2) as avg_rating
          FROM feedbacks f
          WHERE f.clinic_id = $1
            AND f.type = 'CLINIC'
            AND f.deleted_at IS NULL
        `, [clinic._id]);
        averageRating = ratingResult[0]?.avg_rating ? parseFloat(ratingResult[0].avg_rating) : 0;
      } catch {
        averageRating = 0;
      }

      // if (clinicAdminInfo && address) {
      // Adapt ClinicAdminInformation to match ClinicItemDto's expected clinicInfo structure
      const adaptedClinicInfo = {
        _id: clinicAdminInfo._id,
        clinicBranchName: clinicAdminInfo.clinicName, // Map clinicName to branchName
        fullName: clinicAdminInfo.clinicName, // Map clinicName to fullName (representing the org)
        gender: 'OTHER', // Default for organization
        profilePicture: clinicAdminInfo.profilePicture,
        dob: clinicAdminInfo.dob,
      };

      // Pass adapted info as clinicInfo (2nd arg) for display compatibility.
      // Pass original clinicAdminInfo as 4th arg for full details.
      clinicItems.push(
        new ClinicItemDto(clinic, adaptedClinicInfo, address, clinicAdminInfo, averageRating),
      );
      // }
    }

    const totalPages = Math.ceil(total / limit);

    return {
      clinics: clinicItems,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Find Clinic by ID with Full Details
   *
   * Retrieves detailed information for a specific clinic.
   * Includes addresses, doctors, and subscription information.
   *
   * Data Sources:
   * - accounts table: Core account data
   * - clinic_manager_information table: Clinic manager details
   * - addresses table: All addresses (branches)
   * - google_iframe table: Google map for each address
   * - accounts table (doctors): Doctors linked to this clinic
   * - doctor_information table: Doctor details
   * - clinic_subcriptions table: Subscription info
   * - subcription_services table: Service details
   *
   * @param {string} id - Clinic account UUID
   * @returns {Promise<ClinicDetailResponseDto>} Full clinic details
   * @throws {NotFoundException} If clinic not found or not active
   */
  async findClinicById(id: string): Promise<ClinicDetailResponseDto> {
    // Get clinic account
    const clinic = await this.accountRepository.findAccountById(id);
    if (!clinic) {
      throw new NotFoundException('Clinic not found');
    }

    // Validate role and status
    if (clinic.role !== AccountRole.CLINIC_MANAGER) {
      throw new NotFoundException('Clinic not found');
    }
    if (clinic.status !== AccountStatus.ACTIVE) {
      throw new NotFoundException('Clinic not found');
    }

    // Get clinic manager information
    const clinicInfo = await this.clinicManagerInfoRepository.findByAccountId(
      clinic._id,
    );
    if (!clinicInfo) {
      throw new NotFoundException('Clinic manager information not found');
    }

    // Get all addresses with Google maps
    const address = await this.addressRepository.findByAccountId(clinic._id);
    const addressDetails: AddressDetailDto[] = [];

    const googleIframe = await this.googleIframeRepository.findByAddressId(
      address._id,
    );
    addressDetails.push(new AddressDetailDto(address, googleIframe));

    // Get doctors (accounts with parentId = clinic id and role = DOCTOR)
    const doctorAccounts = await this.accountRepository.findByParentIdAndRole(
      clinic._id,
      AccountRole.DOCTOR,
    );

    const doctors: DoctorSummaryDto[] = [];
    for (const doctor of doctorAccounts) {
      const doctorInfo = await this.doctorInfoRepository.findByAccountId(
        doctor._id,
      );
      
      // Calculate average rating for this doctor
      let doctorAvgRating: number | undefined;
      try {
        const ratingResult = await this.dataSource.query(`
          SELECT AVG(f.rating)::NUMERIC(3,2) as avg_rating
          FROM feedbacks f
          WHERE f.doctor_id = $1
            AND f.type = 'DOCTOR'
            AND f.deleted_at IS NULL
        `, [doctor._id]);
        doctorAvgRating = ratingResult[0]?.avg_rating ? parseFloat(ratingResult[0].avg_rating) : 0;
      } catch {
        doctorAvgRating = 0;
      }
      
      doctors.push(new DoctorSummaryDto(doctor, doctorInfo, doctorAvgRating));
    }

    // Get subscription information
    const clinicSubscription =
      await this.clinicSubscriptionRepository.findByClinicId(clinic._id);
    let subscription: SubscriptionDto | undefined;

    if (clinicSubscription) {
      const subscriptionService =
        await this.subscriptionServiceRepository.findById(
          clinicSubscription.serviceId,
        );
      if (subscriptionService) {
        subscription = new SubscriptionDto(
          clinicSubscription,
          subscriptionService,
        );
      }
    }

    // Fetch parent CLINIC_ADMIN account and information
    let clinicAdmin = null;
    let clinicAdminInfo = null;
    let finalClinicName: string | null = null;

    if (clinic.parentId) {
      clinicAdmin = await this.accountRepository.findAccountById(
        clinic.parentId,
      );
      if (clinicAdmin) {
        clinicAdminInfo = await this.clinicAdminInfoRepository.findByAccountId(
          clinicAdmin._id,
        );

        // Compute final clinic name using same logic as ClinicItemDto
        if (clinicAdminInfo) {
          const adminName = (clinicAdminInfo.clinicName || '').trim();
          const branchName = (clinicInfo.clinicBranchName || '').trim();

          if (adminName && branchName) {
            finalClinicName = `${adminName} ${branchName}`;
          } else if (adminName) {
            finalClinicName = adminName;
          } else if (branchName) {
            finalClinicName = branchName;
          } else {
            finalClinicName = null;
          }
        }
      }
    }

    // Calculate clinic average rating
    let clinicAvgRating: number | undefined;
    try {
      const ratingResult = await this.dataSource.query(`
        SELECT AVG(f.rating)::NUMERIC(3,2) as avg_rating
        FROM feedbacks f
        WHERE f.clinic_id = $1
          AND f.type = 'CLINIC'
          AND f.deleted_at IS NULL
      `, [clinic._id]);
      clinicAvgRating = ratingResult[0]?.avg_rating ? parseFloat(ratingResult[0].avg_rating) : 0;
    } catch {
      clinicAvgRating = 0;
    }

    // Fetch clinic feedbacks
    let feedbacks: any[] = [];
    try {
      const feedbacksData = await this.dataSource.query(`
        SELECT 
          f._id,
          f.rating,
          f.description,
          f.description_label,
          f.feedback_images,
          f.feedback_images_label,
          f.created_at,
          ga.full_name as patient_name,
          ga.profile_picture as patient_profile_picture
        FROM feedbacks f
        LEFT JOIN appointments apt ON apt._id = f.appointment_id
        LEFT JOIN accounts acc ON acc._id = apt.patient_id
        LEFT JOIN general_accounts ga ON ga.account_id = acc._id
        WHERE f.clinic_id = $1
          AND f.type = 'CLINIC'
          AND f.deleted_at IS NULL
        ORDER BY f.created_at DESC
        LIMIT 10
      `, [clinic._id]);
      
      feedbacks = feedbacksData.map((fb: any) => ({
        _id: fb._id,
        rating: fb.rating,
        description: fb.description,
        descriptionLabel: fb.description_label,
        feedbackImages: fb.feedback_images,
        feedbackImagesLabel: fb.feedback_images_label,
        createdAt: fb.created_at,
        patientName: fb.patient_name,
        patientProfilePicture: fb.patient_profile_picture,
      }));
    } catch {
      feedbacks = [];
    }

    return new ClinicDetailResponseDto(
      clinic,
      clinicInfo,
      addressDetails,
      doctors,
      subscription,
      clinicAdmin,
      clinicAdminInfo,
      finalClinicName,
      clinicAvgRating,
      feedbacks,
    );
  }

  /**
   * Find All Doctors with Pagination and Filters
   *
   * Retrieves doctor accounts with pagination support and optional filtering.
   * Only returns accounts with role: DOCTOR and status: ACTIVE
   * Excludes soft-deleted records (deletedAt is null)
   *
   * Data Sources:
   * - accounts table: Core account data (base table)
   * - doctor_information table: Doctor details
   * - clinic_manager_information table: Parent clinic details
   *
   * Filtering Logic:
   * - clinicId: Filter by parent clinic ID (accounts.parentId)
   * - gender: Filter by doctor gender (doctor_information.gender)
   * - All filters work together with AND logic
   *
   * @param {number} page - Page number (default: 1)
   * @param {number} limit - Items per page (default: 10)
   * @param {string} [clinicId] - Filter by parent clinic ID
   * @param {string} [gender] - Filter by doctor gender (MALE|FEMALE|OTHER)
   * @returns {Promise<DoctorListResponseDto>} Doctors with pagination
   */
  async findAllDoctors(
    page: number = 1,
    limit: number = 10,
    clinicId?: string,
    gender?: string,
  ): Promise<DoctorListResponseDto> {
    // Get doctor accounts with filters
    const [doctors, total] =
      await this.accountRepository.findDoctorsWithFilters(
        AccountRole.DOCTOR,
        AccountStatus.ACTIVE,
        (page - 1) * limit,
        limit,
        clinicId,
        gender,
      );

    const doctorItems: DoctorItemDto[] = [];

    for (const doctor of doctors) {
      // Get doctor information
      const doctorInfo = await this.doctorInfoRepository.findByAccountId(
        doctor._id,
      );

      // Get parent clinic manager information if exists
      let clinicInfo = null;
      if (doctor.parentId) {
        clinicInfo = await this.clinicManagerInfoRepository.findByAccountId(
          doctor.parentId,
        );
      }

      // Only include doctors with valid doctor information
      if (doctorInfo) {
        doctorItems.push(new DoctorItemDto(doctor, doctorInfo, clinicInfo));
      }
    }

    const totalPages = Math.ceil(total / limit);

    return {
      doctors: doctorItems,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      } as DoctorPaginationDto,
    };
  }

  /**
   * Find All Employees (Doctor + Staff) by Clinic
   *
   * Retrieves all employees belonging to a specific clinic.
   * Useful for selecting contract assignees.
   *
   * @param {string} clinicId - Clinic UUID
   * @param {AccountRole} [role] - Optional role filter
   * @param {string} [search] - Optional search filter
   * @returns {Promise<Account[]>} List of employees
   */

  /**
   * Get Doctor by ID with Full Details
   *
   * Retrieves detailed information for a specific doctor.
   * Includes doctor information and clinic manager information (parent clinic).
   *
   * Business Rules:
   * - Only returns doctors with role='DOCTOR' and status='ACTIVE'
   * - Excludes soft-deleted records (accounts.deletedAt IS NULL and doctor_information.deleted_at IS NULL)
   * - Returns 404 Not Found if doctor not found or not eligible
   *
   * Security Controls:
   * - Uses findPublicByDoctorAccountId repository method with explicit select
   * - Only includes permitted encrypted fields (professional_license, certificate_practical_training, medical_license)
   * - Excludes sensitive encrypted fields (identity_number, place_identity_card, identity_date, bank_number, bank_name, bank_branch)
   *
   * Data Sources:
   * - accounts table: Core account data
   * - doctor_information table: Doctor details (public view only)
   * - accounts table (clinic): Parent clinic account (via parentId)
   * - clinic_manager_information table: Clinic manager details
   *
   * Field Priority:
   * - profilePicture: doctor_information.profilePicture > accounts.profilePicture
   * - dob: doctor_information.dob > accounts.dob (though accounts.dob is not in Account entity)
   * - clinic.phone: comes from clinic account, not clinic_manager_information
   *
   * @param {string} id - Doctor account UUID
   * @returns {Promise<PublicDoctorDetailData>} Public doctor details data with security controls
   * @throws {NotFoundException} If doctor not found or not eligible
   */
  async getPublicDoctorById(id: string): Promise<PublicDoctorDetailData> {
    // Get doctor account
    const doctor = await this.accountRepository.findAccountById(id);
    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    // Validate role and status
    if (doctor.role !== AccountRole.DOCTOR) {
      throw new NotFoundException('Doctor not found');
    }
    if (doctor.status !== AccountStatus.ACTIVE) {
      throw new NotFoundException('Doctor not found');
    }

    // Get doctor information with security controls (allowlist approach)
    const doctorInfo =
      await this.doctorInfoRepository.findPublicByDoctorAccountId(id);
    if (!doctorInfo) {
      throw new NotFoundException('Doctor information not found');
    }

    // Check if doctor information is soft-deleted
    if (doctorInfo.deletedAt) {
      throw new NotFoundException('Doctor not found');
    }

    // Get clinic manager information if exists (via parentId)
    let clinicInfo = null;
    if (doctor.parentId) {
      const clinic = await this.accountRepository.findAccountById(
        doctor.parentId,
      );
      if (clinic && clinic.clinicManagerInformation) {
        // Combine clinic account and clinic manager information for ClinicInfo DTO
        clinicInfo = {
          _id: clinic.clinicManagerInformation._id,
          clinicName: clinic.clinicManagerInformation.clinicBranchName,
          phone: clinic.phone, // Phone comes from clinic account, not clinic_manager_information
        };
      }
    }

    // Create modified account object with field priority handling
    const modifiedAccount = {
      ...doctor,
      // profilePicture comes from doctor_information
      profilePicture: doctorInfo.profilePicture,
      // dob comes from doctor_information
      dob: doctorInfo.dob,
    };

    // Calculate doctor average rating
    let averageRating: number | undefined;
    try {
      const ratingResult = await this.dataSource.query(`
        SELECT AVG(f.rating)::NUMERIC(3,2) as avg_rating
        FROM feedbacks f
        WHERE f.doctor_id = $1
          AND f.type = 'DOCTOR'
          AND f.deleted_at IS NULL
      `, [id]);
      averageRating = ratingResult[0]?.avg_rating ? parseFloat(ratingResult[0].avg_rating) : 0;
    } catch {
      averageRating = 0;
    }

    // Fetch doctor feedbacks
    let feedbacks: any[] = [];
    try {
      const feedbacksData = await this.dataSource.query(`
        SELECT 
          f._id,
          f.rating,
          f.description,
          f.description_label,
          f.feedback_images,
          f.feedback_images_label,
          f.created_at,
          ga.full_name as patient_name,
          ga.profile_picture as patient_profile_picture
        FROM feedbacks f
        LEFT JOIN appointments apt ON apt._id = f.appointment_id
        LEFT JOIN accounts acc ON acc._id = apt.patient_id
        LEFT JOIN general_accounts ga ON ga.account_id = acc._id
        WHERE f.doctor_id = $1
          AND f.type = 'DOCTOR'
          AND f.deleted_at IS NULL
        ORDER BY f.created_at DESC
        LIMIT 10
      `, [id]);
      
      feedbacks = feedbacksData.map((fb: any) => ({
        _id: fb._id,
        rating: fb.rating,
        description: fb.description,
        descriptionLabel: fb.description_label,
        feedbackImages: fb.feedback_images,
        feedbackImagesLabel: fb.feedback_images_label,
        createdAt: fb.created_at,
        patientName: fb.patient_name,
        patientProfilePicture: fb.patient_profile_picture,
      }));
    } catch {
      feedbacks = [];
    }

    // Create PublicDoctorDetailData with modified account and doctor info
    const publicDoctorDetailData = new PublicDoctorDetailData(
      modifiedAccount,
      doctorInfo,
      clinicInfo,
      averageRating,
      feedbacks,
    );

    return publicDoctorDetailData;
  }

  /**
   * Validate Clinic Admin Role
   *
   * Validates that an account has the CLINIC_ADMIN role.
   * This helper method ensures that only accounts with the correct role can have
   * associated ClinicAdminInformation records.
   *
   * Use Cases:
   * - Before creating ClinicAdminInformation records
   * - Before updating ClinicAdminInformation records
   * - Ensuring data integrity between Account role and ClinicAdminInformation
   *
   * @param {Account} account - Account entity to validate
   * @throws {BadRequestException} If account does not have CLINIC_ADMIN role
   *
   * @example
   * ```typescript
   * const account = await this.findAccountEntityById(id);
   * this.validateClinicAdminRole(account);
   * // If no exception, account has CLINIC_ADMIN role
   * ```
   */
  private validateClinicAdminRole(account: Account): void {
    if (account.role !== AccountRole.CLINIC_ADMIN) {
      throw new BadRequestException(
        'Only accounts with CLINIC_ADMIN role can have clinic admin information. ' +
          `Current role: ${account.role}`,
      );
    }
  }

  /**
   * Update Clinic Admin Profile
   *
   * Updates an existing clinic admin profile for an account.
   * This method allows updating all or partial profile fields.
   *
   * Business Rules:
   * - Account must have CLINIC_ADMIN role
   * - Only provided fields are updated
   * - If profile doesn't exist, creates new profile
   *
   * @param {string} accountId - Account UUID
   * @param {UpdateClinicAdminProfileDto} dto - Clinic admin profile data to update
   * @returns {Promise<ClinicAdminInformation>} Updated clinic admin profile
   * @throws {BadRequestException} If account does not have CLINIC_ADMIN role
   *
   * @example
   * ```typescript
   * const profile = await accountsService.updateClinicAdminProfile('account-uuid', {
   *   clinicName: 'Updated Clinic Name',
   *   description: 'Updated description'
   * });
   * ```
   */
  async updateClinicAdminProfile(
    accountId: string,
    dto: UpdateClinicAdminProfileDto,
  ): Promise<ClinicAdminInformation> {
    const account = await this.findAccountEntityById(accountId);
    this.validateClinicAdminRole(account);

    let profile =
      await this.clinicAdminInfoRepository.findByAccountId(accountId);

    if (profile) {
      // Update existing profile
      if (dto.clinicName !== undefined) {
        profile.clinicName = dto.clinicName;
      }
      if (dto.description !== undefined) {
        profile.description = dto.description;
      }
      if (dto.specializedIn !== undefined) {
        profile.specializedIn = dto.specializedIn;
      }
      if (dto.pros !== undefined) {
        profile.pros = dto.pros;
      }
      if (dto.paraclinical !== undefined) {
        profile.paraclinical = dto.paraclinical;
      }
      if (dto.dob !== undefined) {
        profile.dob = dto.dob ? new Date(dto.dob) : undefined;
      }
      if (dto.profilePicture !== undefined) {
        profile.profilePicture = dto.profilePicture;
      }
      if (dto.bankName !== undefined) {
        profile.bankName = dto.bankName;
      }
      if (dto.bankNumber !== undefined) {
        profile.bankNumber = dto.bankNumber;
      }
      if (dto.bankBranch !== undefined) {
        profile.bankBranch = dto.bankBranch;
      }
      if (dto.sepayVa !== undefined) {
        profile.sepayVa = dto.sepayVa;
      }
      if (dto.isVerify !== undefined) {
        profile.isVerify = dto.isVerify;
      }
    } else {
      // Create new profile if doesn't exist
      profile = this.clinicAdminInfoRepository.create({
        accountId,
        clinicName: dto.clinicName,
        description: dto.description,
        specializedIn: dto.specializedIn,
        pros: dto.pros,
        paraclinical: dto.paraclinical,
        dob: dto.dob ? new Date(dto.dob) : undefined,
        profilePicture: dto.profilePicture,
        bankName: dto.bankName,
        bankNumber: dto.bankNumber,
        bankBranch: dto.bankBranch,
        sepayVa: dto.sepayVa,
        isVerify: dto.isVerify ?? false,
      });
    }

    return this.clinicAdminInfoRepository.save(profile);
  }

  /**
   * Check Registration Status
   *
   * Checks if an email has an in-progress clinic admin registration.
   * Returns the current registration status and next action for the user.
   *
   * Business Rules:
   * - Does NOT modify the database
   * - Returns status if email exists and has pending registration
   * - Returns canStart: true if email doesn't exist or no pending registration
   * - Returns managerAccountId for legal document related statuses
   * - Returns notice for NON_RENEWING status
   * - Returns expirationDate for ACTIVE, NON_RENEWING, and EXPIRED statuses
   * - PENDING_SEPAY_SETUP is deprecated - bank config is now part of initial registration
   *
   * @param {string} email - Email address to check
   * @returns {Promise<CheckRegistrationStatusResponseDto>} Registration status information
   *
   * @example
   * ```typescript
   * const status = await accountsService.checkRegistrationStatus('admin@clinic.com');
   * // Returns: { status: 'PENDING_MANAGER_SETUP', canResume: true, ... }
   * ```
   */
  async checkRegistrationStatus(
    email: string,
  ): Promise<CheckRegistrationStatusResponseDto> {
    const account = await this.findByEmail(email);

    if (!account) {
      // Email doesn't exist - user can start registration
      return {
        message: 'You can start a new registration',
        canResume: true,
        currentStep: 'STEP_2',
        nextAction: 'Start clinic admin registration',
      };
    }

    // Check if account has CLINIC_ADMIN role
    if (account.role !== AccountRole.CLINIC_ADMIN) {
      return {
        message: 'Not a clinic admin account',
        canResume: false,
        currentStep: null,
        nextAction: null,
      };
    }

    // Get clinic subscription to check registration status
    const subscription = await this.clinicSubscriptionRepository.findByClinicId(
      account._id,
    );

    if (!subscription) {
      // Account exists but no subscription
      return {
        message: 'No subscription found',
        canResume: false,
        currentStep: null,
        nextAction: null,
      };
    }

    // Query for manager account (linked via parentId)
    const managerAccounts = await this.accountRepository.findByParentIdAndRole(
      account._id,
      AccountRole.CLINIC_MANAGER,
    );
    const managerAccount =
      managerAccounts.length > 0 ? managerAccounts[0] : null;
    const managerAccountId = managerAccount?._id || null;

    // Map registration status to step information
    const status = subscription.subscriptionStatus;
    let currentStep: string;
    let nextAction: string;
    let notice: string | null = null;
    let expirationDate: string | null = null;

    switch (status) {
      // PENDING_SEPAY_SETUP is deprecated - bank config is now part of initial registration
      case RegistrationStatus.PENDING_MANAGER_SETUP:
        currentStep = 'STEP_3';
        nextAction = 'Create clinic manager account';
        break;
      case RegistrationStatus.PENDING_LEGAL_SETUP:
        currentStep = 'STEP_4';
        nextAction = 'Upload legal documents for clinic manager';
        if (!managerAccountId) {
          return {
            status,
            currentStep,
            nextAction,
            canResume: false,
            message:
              'Registration data is inconsistent. Please contact support.',
          };
        }
        break;
      case RegistrationStatus.PENDING_APPROVAL:
        currentStep = 'STEP_5';
        nextAction = 'Waiting for admin approval';
        if (!managerAccountId) {
          return {
            status,
            currentStep,
            nextAction,
            canResume: false,
            message:
              'Registration data is inconsistent. Please contact support.',
          };
        }
        break;
      case RegistrationStatus.PENDING_PAYMENT:
        currentStep = 'STEP_5';
        nextAction = 'Complete payment for subscription';
        break;
      case RegistrationStatus.ACTIVE:
        currentStep = 'COMPLETED';
        nextAction = 'Access your dashboard';
        expirationDate = subscription.expirationDate
          ? subscription.expirationDate.toISOString()
          : null;
        break;
      case RegistrationStatus.NON_RENEWING:
        currentStep = 'COMPLETED';
        nextAction = 'Access your dashboard (subscription will not renew)';
        notice =
          'Your subscription has been cancelled and will not renew automatically. Access retained until expiration date.';
        expirationDate = subscription.expirationDate
          ? subscription.expirationDate.toISOString()
          : null;
        break;
      case RegistrationStatus.EXPIRED:
        currentStep = 'COMPLETED';
        nextAction = 'Renew your subscription';
        expirationDate = subscription.expirationDate
          ? subscription.expirationDate.toISOString()
          : null;
        break;
      default:
        currentStep = 'STEP_2';
        nextAction = 'Complete your registration';
    }

    return {
      status,
      currentStep,
      nextAction,
      canResume: true,
      message: MESSAGES.failMessage.registrationStatusInProgress,
      managerAccountId: managerAccountId || undefined,
      notice: notice || undefined,
      expirationDate: expirationDate || undefined,
    };
  }

  /**
   * Register Clinic Admin (Transactional)
   *
   * Creates a complete clinic admin registration with account, profile, payment config (bank details), and subscription.
   * Uses QueryRunner for transaction safety - all operations succeed or none do.
   *
   * Business Rules:
   * - Email policy: One email can be used max 2 times (1x CLINIC_ADMIN + 1x CLINIC_MANAGER)
   * - Creates Account with CLINIC_ADMIN role and PENDING status
   * - Creates ClinicAdminInformation with clinic details AND bank configuration
   * - Creates ClinicSubscription with PENDING_SEPAY_SETUP status (Step 2: Collects Initial Profile + Payment Data)
   * - Bank fields (bankNumber, bankBranch) are encrypted via encryptionTransformer
   * - Password is hashed with bcrypt before storage
   *
   * @param {RegisterClinicAdminDto} dto - Clinic admin registration data (including bank configuration)
   * @returns {Promise<AccountResponseDto>} Created account with subscription status
   * @throws {ConflictException} If email already exists or exceeds usage limit
   * @throws {BadRequestException} If validation fails
   * @throws {Error} Any error will trigger transaction rollback
   *
   * @example
   * ```typescript
   * const account = await accountsService.registerClinicAdmin({
   *   username: 'clinicadmin',
   *   email: 'admin@clinic.com',
   *   password: 'AdminPass123',
   *   clinicName: 'City Medical Center',
   *   bankName: 'Vietcombank',
   *   bankNumber: '1234567890',
   *   bankBranch: 'Ho Chi Minh City Branch',
   *   sepayVa: '1900123456',
   *   serviceId: '550e8400-e29b-41d4-a716-446655440000'
   * });
   * ```
   */
  async registerClinicAdmin(
    dto: RegisterClinicAdminDto,
  ): Promise<AccountResponseDto> {
    // Step 1: Validate email uniqueness and policy (max 2 uses: 1x CLINIC_ADMIN + 1x CLINIC_MANAGER)
    const existingAccount = await this.findByEmail(dto.email);

    if (existingAccount) {
      // Check if existing account is CLINIC_ADMIN or CLINIC_MANAGER
      if (
        existingAccount.role === AccountRole.CLINIC_ADMIN ||
        existingAccount.role === AccountRole.CLINIC_MANAGER
      ) {
        throw new ConflictException(
          MESSAGES.failMessage.emailUsageLimitExceeded,
        );
      }
      // Email exists but with different role - allow registration
    }

    // Step 2: Validate sepayVa uniqueness to prevent cross-clinic payment conflicts
    if (dto.sepayVa) {
      const existingSepay = await this.clinicAdminInfoRepository.findBySepayVa(
        dto.sepayVa,
      );
      if (existingSepay) {
        throw new ConflictException(
          'Số tài khoản ảo SePay này đã được liên kết với một phòng khám khác.',
        );
      }
    }

    // Step 3: Hash password for secure storage
    const hashedPassword = await bcrypt.hash(
      dto.password,
      this.BCRYPT_SALT_ROUNDS,
    );

    // Step 4: Create all entities in a transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { publicKey, privateKey: encryptedPrivateKey } = generateRSAKeyPair();

      // Create Account entity with CLINIC_ADMIN role and PENDING status
      const account = this.accountRepository.createAccount({
        username: dto.username,
        email: dto.email,
        password: hashedPassword,
        phone: dto.phone,
        role: AccountRole.CLINIC_ADMIN,
        status: AccountStatus.ACTIVE,
        isEmailVerified: false,
        isOAuthUser: false,
        publicKey,
        encryptedPrivateKey,
      });

      const savedAccount = await queryRunner.manager.save(account);

      // Create ClinicAdminInformation entity (including bank configuration)
      const clinicAdminInfo = this.clinicAdminInfoRepository.create({
        accountId: savedAccount._id,
        clinicName: dto.clinicName,
        clinicPhone: dto.phone,
        description: dto.description,
        specializedIn: dto.specializedIn,
        pros: dto.pros,
        paraclinical: dto.paraclinical,
        dob: dto.dob ? new Date(dto.dob) : undefined,
        profilePicture: dto.profilePicture,
        // Bank configuration fields (formerly Step 3, now part of initial registration)
        bankName: dto.bankName,
        bankNumber: dto.bankNumber,
        bankBranch: dto.bankBranch,
        sepayVa: dto.sepayVa,
        sepayKey: dto.sepayKey,
      });

      await queryRunner.manager.save(clinicAdminInfo);

      // Create ClinicSubscription entity with PENDING_SEPAY_SETUP status
      // Step 2: Collects Initial Profile + Payment Data (including bank details)
      // Step 3: Reserved for Payment Verification and Confirmation (PATCH /account/clinic-admin/payment-config)
      const clinicSubscription = this.clinicSubscriptionRepository.create({
        clinicId: savedAccount._id,
        serviceId: dto.serviceId,
        subscriptionStatus: RegistrationStatus.PENDING_SEPAY_SETUP,
        subscriptionDate: getCurrentVietnamTime(),
      });

      await queryRunner.manager.save(clinicSubscription);

      await queryRunner.commitTransaction();

      // Send welcome email after successful transaction (fire-and-forget)
      this.mailerService
        .sendClinicAdminWelcomeEmail(dto.email, dto.clinicName)
        .catch((error) => {
          console.error('Failed to send clinic admin welcome email:', error);
        });

      // Return complete account DTO with subscription status
      return new AccountResponseDto(
        savedAccount,
        null,
        null,
        null,
        null,
        null,
        clinicAdminInfo,
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Create Clinic Manager for Registration (Step 4A)
   *
   * Creates a clinic manager account for a clinic admin during registration flow.
   * Uses QueryRunner for transaction safety - all operations succeed or none do.
   *
   * Business Rules:
   * - Actor must have CLINIC_ADMIN role
   * - Registration/subscription status must be PENDING_MANAGER_SETUP
   * - Only one manager allowed for this clinic admin (validate none exists)
   * - Creates manager Account with CLINIC_MANAGER role and ACTIVE status
   * - Creates ClinicManagerInformation entity
   * - Links via parentId to the clinic admin account
   * - Transitions status to PENDING_LEGAL_SETUP
   *
   * @param {string} clinicAdminId - Clinic admin account UUID
   * @param {CreateClinicManagerForRegistrationDto} dto - Clinic manager registration data
   * @returns {Promise<AccountResponseDto>} Created clinic manager account
   * @throws {NotFoundException} If clinic admin not found
   * @throws {ForbiddenException} If account is not CLINIC_ADMIN or status is not PENDING_MANAGER_SETUP
   * @throws {ConflictException} If manager already exists or email already used
   * @throws {Error} Any error will trigger transaction rollback
   */
  async createClinicManagerForRegistration(
    clinicAdminId: string,
    dto: CreateClinicManagerForRegistrationDto,
  ): Promise<AccountResponseDto> {
    // Step 1: Validate clinic admin exists and has CLINIC_ADMIN role
    const clinicAdmin = await this.findAccountEntityById(clinicAdminId);
    if (clinicAdmin.role !== AccountRole.CLINIC_ADMIN) {
      throw new ForbiddenException(
        'Only clinic admins can create clinic managers during registration',
      );
    }

    // Step 2: Validate subscription status is PENDING_MANAGER_SETUP
    const subscription =
      await this.clinicSubscriptionRepository.findByClinicId(clinicAdminId);
    if (!subscription) {
      throw new NotFoundException('Clinic subscription not found');
    }
    if (
      subscription.subscriptionStatus !==
      RegistrationStatus.PENDING_MANAGER_SETUP
    ) {
      throw new ForbiddenException(
        `Cannot create clinic manager. Current status: ${subscription.subscriptionStatus}. Expected: ${RegistrationStatus.PENDING_MANAGER_SETUP}`,
      );
    }

    // Step 3: Validate only one manager allowed (check if any manager already exists)
    const existingManagers = await this.accountRepository.findByParentIdAndRole(
      clinicAdminId,
      AccountRole.CLINIC_MANAGER,
    );
    if (existingManagers.length > 0) {
      throw new ConflictException(
        'Only one clinic manager is allowed per clinic admin',
      );
    }

    // Step 4: Validate email uniqueness
    const existingAccount = await this.findByEmail(dto.email);
    if (existingAccount) {
      throw new ConflictException(MESSAGES.failMessage.userEmailAlreadyExists);
    }

    // Step 5: Create all entities in a transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Generate default password for manager account
      const defaultPassword = 'Manager' + getVietnamTimestamp();
      const hashedPassword = await bcrypt.hash(
        defaultPassword,
        this.BCRYPT_SALT_ROUNDS,
      );

      // Generate digital signature keys
      const { publicKey, privateKey: encryptedPrivateKey } = generateRSAKeyPair();

      // Create Account entity with CLINIC_MANAGER role and ACTIVE status
      const managerAccount = this.accountRepository.createAccount({
        username: dto.username,
        email: dto.email,
        password: hashedPassword,
        phone: dto.phone,
        parentId: clinicAdminId, // Link to clinic admin
        role: AccountRole.CLINIC_MANAGER,
        status: AccountStatus.ACTIVE,
        isEmailVerified: false,
        isOAuthUser: false,
        publicKey,
        encryptedPrivateKey,
      });

      const savedManagerAccount =
        await queryRunner.manager.save(managerAccount);

      // Create ClinicManagerInformation entity
      const managerInfo = this.clinicManagerInfoRepository.create({
        accountId: savedManagerAccount._id,
        clinicBranchName: dto.clinicBranchName,
        fullName: dto.fullName,
        gender: dto.gender,
        profilePicture: dto.profilePicture,
        dob: dto.dob ? new Date(dto.dob) : undefined,
      });

      await queryRunner.manager.save(managerInfo);

      // Create Address entity for manager
      const address = this.addressRepository.create({
        accountId: savedManagerAccount._id,
        address: dto.addressDetail,
        ward: dto.wardCode,
        wardName: dto.wardName,
        district: dto.districtCode,
        districtName: dto.districtName,
        province: dto.provinceCode,
        provinceName: dto.provinceName,
      });

      await queryRunner.manager.save(address);

      // Update subscription status to PENDING_LEGAL_SETUP
      subscription.subscriptionStatus = RegistrationStatus.PENDING_LEGAL_SETUP;
      await queryRunner.manager.save(subscription);

      await queryRunner.commitTransaction();

      // Send manager credentials email after successful transaction (fire-and-forget)
      // Get clinic name from the clinic admin
      const clinicAdminInfo =
        await this.clinicAdminInfoRepository.findByAccountId(clinicAdminId);
      const clinicName = clinicAdminInfo?.clinicName;

      this.mailerService
        .sendManagerCredentialsEmail(
          dto.email,
          savedManagerAccount.username,
          defaultPassword,
          clinicName,
        )
        .catch((error) => {
          console.error('Failed to send manager credentials email:', error);
        });

      // Return complete account DTO
      return new AccountResponseDto(
        savedManagerAccount,
        null,
        null,
        null,
        managerInfo,
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Upload Legal Documents for Clinic Manager (Step 4B)
   *
   * Uploads legal documents for a specific clinic manager during registration flow.
   * Uses QueryRunner for transaction safety.
   *
   * Business Rules:
   * - Actor must have CLINIC_ADMIN role
   * - Manager exists, has role CLINIC_MANAGER
   * - Ownership: manager.parentId equals current admin account id
   * - Docs stored per manager (FK to manager account)
   * - Status transitions to PENDING_APPROVAL
   * - verificationStatus transitions to PENDING_REVIEW
   *
   * @param {string} clinicAdminId - Clinic admin account UUID
   * @param {string} managerAccountId - Clinic manager account UUID
   * @param {UploadLegalDocumentDto} dto - Legal document data
   * @returns {Promise<ClinicsLegalDocuments>} Created legal documents
   * @throws {NotFoundException} If clinic admin or manager not found
   * @throws {ForbiddenException} If account is not CLINIC_ADMIN or manager is not owned by admin
   * @throws {Error} Any error will trigger transaction rollback
   */
  async uploadLegalDocumentsForManager(
    clinicAdminId: string,
    managerAccountId: string,
    dto: UploadLegalDocumentDto,
  ): Promise<ClinicsLegalDocuments> {
    // Step 1: Validate clinic admin exists and has CLINIC_ADMIN role
    const clinicAdmin = await this.findAccountEntityById(clinicAdminId);
    if (clinicAdmin.role !== AccountRole.CLINIC_ADMIN) {
      throw new ForbiddenException(
        'Only clinic admins can upload legal documents',
      );
    }

    // Step 2: Validate manager exists and has CLINIC_MANAGER role
    const manager = await this.findAccountEntityById(managerAccountId);
    if (manager.role !== AccountRole.CLINIC_MANAGER) {
      throw new NotFoundException('Clinic manager not found');
    }

    // Step 3: Validate ownership (manager.parentId equals admin account id)
    if (manager.parentId !== clinicAdminId) {
      throw new ForbiddenException(
        'You do not have permission to upload documents for this manager',
      );
    }

    // Step 4: Validate subscription status is PENDING_LEGAL_SETUP
    const subscription =
      await this.clinicSubscriptionRepository.findByClinicId(clinicAdminId);
    if (!subscription) {
      throw new NotFoundException('Clinic subscription not found');
    }
    if (
      subscription.subscriptionStatus !== RegistrationStatus.PENDING_LEGAL_SETUP
    ) {
      throw new ForbiddenException(
        `Cannot upload legal documents. Current status: ${subscription.subscriptionStatus}. Expected: PENDING_LEGAL_SETUP`,
      );
    }

    // Step 5: Create or update legal documents in a transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Check if legal documents already exist for this manager
      let legalDocs =
        await this.clinicLegalDocsRepository.findByAccountId(managerAccountId);

      if (legalDocs) {
        // Update existing documents
        legalDocs.operatingLicense = dto.operatingLicense;
        legalDocs.businessLicense = dto.businessLicense;
        legalDocs.taxIdUrl = dto.taxIdUrl;
        legalDocs.otherDocs = dto.otherDocs;
        legalDocs.verificationStatus =
          LegalDocumentVerificationStatus.PENDING_REVIEW;
        legalDocs = await queryRunner.manager.save(legalDocs);
      } else {
        // Create new legal documents
        legalDocs = this.clinicLegalDocsRepository.create({
          accountId: managerAccountId,
          operatingLicense: dto.operatingLicense,
          businessLicense: dto.businessLicense,
          taxIdUrl: dto.taxIdUrl,
          otherDocs: dto.otherDocs,
          verificationStatus: LegalDocumentVerificationStatus.PENDING_REVIEW,
        });
        legalDocs = await queryRunner.manager.save(legalDocs);
      }

      // Update subscription status to PENDING_APPROVAL
      subscription.subscriptionStatus = RegistrationStatus.PENDING_APPROVAL;
      await queryRunner.manager.save(subscription);

      await queryRunner.commitTransaction();

      return legalDocs;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get Legal Documents for Clinic Manager
   *
   * Retrieves legal documents for a specific clinic manager.
   *
   * Business Rules:
   * - Actor must have CLINIC_ADMIN role
   * - Manager exists, has role CLINIC_MANAGER
   * - Ownership: manager.parentId equals current admin account id
   *
   * @param {string} clinicAdminId - Clinic admin account UUID
   * @param {string} managerAccountId - Clinic manager account UUID
   * @returns {Promise<ClinicsLegalDocuments | null>} Legal documents or null
   * @throws {NotFoundException} If clinic admin or manager not found
   * @throws {ForbiddenException} If account is not CLINIC_ADMIN or manager is not owned by admin
   */
  async getLegalDocumentsForManager(
    clinicAdminId: string,
    managerAccountId: string,
  ): Promise<ClinicsLegalDocuments | null> {
    // Step 1: Validate clinic admin exists and has CLINIC_ADMIN role
    const clinicAdmin = await this.findAccountEntityById(clinicAdminId);
    if (clinicAdmin.role !== AccountRole.CLINIC_ADMIN) {
      throw new ForbiddenException(
        'Only clinic admins can view legal documents',
      );
    }

    // Step 2: Validate manager exists and has CLINIC_MANAGER role
    const manager = await this.findAccountEntityById(managerAccountId);
    if (manager.role !== AccountRole.CLINIC_MANAGER) {
      throw new NotFoundException('Clinic manager not found');
    }

    // Step 3: Validate ownership (manager.parentId equals admin account id)
    if (manager.parentId !== clinicAdminId) {
      throw new ForbiddenException(
        'You do not have permission to view documents for this manager',
      );
    }

    // Step 4: Return legal documents
    return this.clinicLegalDocsRepository.findByAccountId(managerAccountId);
  }

  /**
   * Update Legal Documents for Clinic Manager (Rejected Documents)
   *
   * Updates rejected legal documents for a specific clinic manager during registration flow.
   * This endpoint is used when documents have been rejected and need to be resubmitted.
   * Uses QueryRunner for transaction safety.
   *
   * Business Rules:
   * - Actor must have CLINIC_ADMIN role
   * - Manager exists, has role CLINIC_MANAGER
   * - Ownership: manager.parentId equals current admin account id
   * - Documents must be in REJECTED status
   * - verificationStatus transitions to PENDING_REVIEW
   * - Subscription status transitions back to PENDING_APPROVAL
   *
   * @param {string} clinicAdminId - Clinic admin account UUID
   * @param {string} managerAccountId - Clinic manager account UUID
   * @param {UpdateLegalDocumentsDto} dto - Legal document data to update
   * @returns {Promise<ClinicsLegalDocuments>} Updated legal documents
   * @throws {NotFoundException} If clinic admin or manager not found
   * @throws {ForbiddenException} If account is not CLINIC_ADMIN or manager is not owned by admin
   * @throws {BadRequestException} If documents are not in REJECTED status
   * @throws {Error} Any error will trigger transaction rollback
   */
  async updateLegalDocumentsForManager(
    clinicAdminId: string,
    managerAccountId: string,
    dto: UpdateLegalDocumentsDto,
  ): Promise<ClinicsLegalDocuments> {
    // Step 1: Validate clinic admin exists and has CLINIC_ADMIN role
    const clinicAdmin = await this.findAccountEntityById(clinicAdminId);
    if (clinicAdmin.role !== AccountRole.CLINIC_ADMIN) {
      throw new ForbiddenException(
        'Only clinic admins can update legal documents',
      );
    }

    // Step 2: Validate manager exists and has CLINIC_MANAGER role
    const manager = await this.findAccountEntityById(managerAccountId);
    if (manager.role !== AccountRole.CLINIC_MANAGER) {
      throw new NotFoundException('Clinic manager not found');
    }

    // Step 3: Validate ownership (manager.parentId equals admin account id)
    if (manager.parentId !== clinicAdminId) {
      throw new ForbiddenException(
        'You do not have permission to update documents for this manager',
      );
    }

    // Step 4: Validate legal documents exist and are in REJECTED status
    const legalDocs =
      await this.clinicLegalDocsRepository.findByAccountId(managerAccountId);
    if (!legalDocs) {
      throw new NotFoundException('Legal documents not found');
    }
    if (
      legalDocs.verificationStatus !== LegalDocumentVerificationStatus.REJECTED
    ) {
      throw new BadRequestException(
        'Can only update documents that have been rejected',
      );
    }

    // Step 5: Validate subscription status is PENDING_LEGAL_SETUP (documents must be REJECTED)
    const subscription =
      await this.clinicSubscriptionRepository.findByClinicId(clinicAdminId);
    if (!subscription) {
      throw new NotFoundException('Clinic subscription not found');
    }
    if (
      subscription.subscriptionStatus !== RegistrationStatus.PENDING_LEGAL_SETUP
    ) {
      throw new BadRequestException(
        `Cannot update legal documents. Current status: ${subscription.subscriptionStatus}. Expected: PENDING_LEGAL_SETUP`,
      );
    }

    // Step 6: Update legal documents and subscription in a transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Update legal documents
      if (dto.operatingLicense !== undefined) {
        legalDocs.operatingLicense = dto.operatingLicense;
      }
      if (dto.businessLicense !== undefined) {
        legalDocs.businessLicense = dto.businessLicense;
      }
      legalDocs.verificationStatus =
        LegalDocumentVerificationStatus.PENDING_REVIEW;
      const updatedLegalDocs = await queryRunner.manager.save(legalDocs);

      // Update subscription status back to PENDING_APPROVAL
      subscription.subscriptionStatus = RegistrationStatus.PENDING_APPROVAL;
      await queryRunner.manager.save(subscription);

      await queryRunner.commitTransaction();

      return updatedLegalDocs;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Cancel Pending Registration (Hard Delete)
   *
   * Performs a hard delete on a pending clinic admin registration.
   * This is an irreversible operation that completely removes all registration data.
   *
   * Business Rules:
   * - Only CLINIC_ADMIN role can cancel their registration
   * - Cannot cancel if status is PENDING_APPROVAL (documents under review)
   * - Cannot cancel if any SUCCESS transaction exists (payment already made)
   * - Cannot cancel if status is ACTIVE, NON_RENEWING, or EXPIRED (subscription already activated)
   *
   * Deletion Order (respects foreign key constraints):
   * 1. ClinicsLegalDocuments (linked to manager account)
   * 2. ClinicManagerInformation + Account (manager)
   * 3. Pending Transactions
   * 4. ClinicSubscription
   * 5. ClinicAdminInformation
   * 6. Account (admin)
   *
   * @param {string} accountId - Clinic admin account UUID
   * @returns {Promise<CancelRegistrationResponseDto>} Cancellation result
   * @throws {ForbiddenException} If account is not CLINIC_ADMIN
   * @throws {NotFoundException} If subscription not found
   * @throws {BadRequestException} If status is PENDING_APPROVAL
   * @throws {BadRequestException} If SUCCESS transaction exists
   * @throws {BadRequestException} If status is invalid for cancellation
   */
  async cancelPendingRegistration(
    accountId: string,
  ): Promise<CancelRegistrationResponseDto> {
    // Get account with subscription
    const account = await this.findAccountEntityById(accountId);
    if (account.role !== AccountRole.CLINIC_ADMIN) {
      throw new ForbiddenException(
        'Only clinic admin can cancel their registration',
      );
    }

    // Get subscription
    const subscription =
      await this.clinicSubscriptionRepository.findByClinicId(accountId);
    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    // Check if status is PENDING_APPROVAL
    if (
      subscription.subscriptionStatus === RegistrationStatus.PENDING_APPROVAL
    ) {
      throw new BadRequestException(
        MESSAGES.failMessage.pendingApprovalBlocked,
      );
    }

    // Allow cancellation from PENDING_MANAGER_SETUP state (which now includes bank configuration)
    // This ensures all newly created bank data is wiped if the user cancels before moving to manager setup

    // Check for forbidden statuses
    const forbiddenStatuses = [
      RegistrationStatus.ACTIVE,
      RegistrationStatus.NON_RENEWING,
      RegistrationStatus.EXPIRED,
    ];
    if (forbiddenStatuses.includes(subscription.subscriptionStatus)) {
      throw new BadRequestException(MESSAGES.failMessage.invalidStatus);
    }

    // Check for any SUCCESS transaction
    const successTransaction = await this.transactionRepository.findOne({
      where: {
        clinicId: accountId,
        status: PaymentStatus.SUCCESS,
      },
    });
    if (successTransaction) {
      throw new BadRequestException(
        MESSAGES.failMessage.successTransactionExists,
      );
    }

    // Perform hard delete in transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Delete ClinicsLegalDocuments (linked to manager account)
      await queryRunner.manager.delete(ClinicsLegalDocuments, {
        account: { parentId: accountId },
      });

      // 2. Delete ClinicManagerInformation + Account (manager)
      await queryRunner.manager.delete(ClinicManagerInformation, {
        account: { parentId: accountId },
      });
      await queryRunner.manager.delete(Account, {
        parentId: accountId,
        role: AccountRole.CLINIC_MANAGER,
      });

      // 3. Delete pending Transactions
      await queryRunner.manager.delete(Transaction, {
        clinicId: accountId,
        status: PaymentStatus.PENDING,
      });

      // 4. Delete ClinicSubscription
      await queryRunner.manager.delete(ClinicSubscription, {
        clinicId: accountId,
      });

      // 5. Delete ClinicAdminInformation
      await queryRunner.manager.delete(ClinicAdminInformation, {
        accountId: accountId,
      });

      // 6. Delete Account (admin)
      await queryRunner.manager.delete(Account, {
        _id: accountId,
      });

      await queryRunner.commitTransaction();

      return {
        success: true,
        message: MESSAGES.successMessage.registrationCancelled,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Cancel Active Subscription (Churn / Soft Cancel)
   *
   * Cancels an active subscription by changing status to NON_RENEWING.
   * This is a soft cancellation - no data is deleted, user retains access until expirationDate.
   *
   * Business Rules:
   * - Only CLINIC_ADMIN role can cancel their subscription
   * - Subscription must be in ACTIVE status
   * - Creates history record for churn analysis
   * - User retains full access until expirationDate
   * - System will NOT auto-renew after expiration
   *
   * Effects:
   * - Status changes to NON_RENEWING
   * - History record created in clinic_subscriptions_history
   * - Account remains fully functional until expirationDate
   * - After expirationDate passes, status transitions to EXPIRED
   *
   * @param {string} accountId - Clinic admin account UUID
   * @param {CancelSubscriptionDto} dto - Optional cancellation reason
   * @returns {Promise<CancelSubscriptionResponseDto>} Cancellation result
   * @throws {ForbiddenException} If account is not CLINIC_ADMIN
   * @throws {NotFoundException} If subscription not found
   * @throws {BadRequestException} If subscription is not ACTIVE
   */
  async cancelActiveSubscription(
    accountId: string,
    dto?: { reason?: string },
  ): Promise<CancelSubscriptionResponseDto> {
    // Get account
    const account = await this.findAccountEntityById(accountId);
    if (account.role !== AccountRole.CLINIC_ADMIN) {
      throw new ForbiddenException(
        'Only clinic admin can cancel their subscription',
      );
    }

    // Get subscription
    const subscription =
      await this.clinicSubscriptionRepository.findByClinicId(accountId);
    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    // Check if status is ACTIVE
    if (subscription.subscriptionStatus !== RegistrationStatus.ACTIVE) {
      throw new BadRequestException(
        'Can only cancel subscriptions with ACTIVE status',
      );
    }

    // Update status to NON_RENEWING
    subscription.subscriptionStatus = RegistrationStatus.NON_RENEWING;
    await this.clinicSubscriptionRepository.save(subscription);

    // Create history record for churn analysis
    await this.clinicSubscriptionHistoryRepository.createHistoryRecord({
      clinicId: accountId,
      serviceId: subscription.serviceId,
      subscriptionDate: subscription.subscriptionDate,
      expirationDate: subscription.expirationDate,
      subscriptionStatus: RegistrationStatus.NON_RENEWING,
    });

    return {
      message:
        'Subscription cancelled successfully. Access retained until expiration date.',
      newStatus: RegistrationStatus.NON_RENEWING,
    };
  }

  /**
   * Find Staff by ID (Manager Only)
   *
   * Retrieves staff details for a manager, ensuring the staff belongs to the manager's clinic.
   *
   * @param id Staff Account ID
   * @param managerId Manager Account ID
   */
  async findStaffById(
    id: string,
    managerId: string,
  ): Promise<AccountResponseDto> {
    const staff = await this.findAccountEntityById(id);

    const parent = await this.accountRepository.findAccountById(managerId);
    if (!parent)
      throw new ForbiddenException(MESSAGES.failMessage.userNotFound);

    const clinicId = parent.parentId;
    const allManagers = await this.accountRepository.findByParentIdAndRole(
      clinicId,
      AccountRole.CLINIC_MANAGER,
    );
    const validParentIds = [clinicId, ...allManagers.map((m) => m._id)];

    // Security Check: Ensure staff belongs to the manager's clinic
    if (!validParentIds.includes(staff.parentId)) {
      throw new ForbiddenException(
        MESSAGES.failMessage.insufficientPermissions,
      );
    }

    return this.getAccountInformationByRole(id);
  }

  /**
   * Find All Staff by Manager
   *
   * Retrieves paginated list of staff members for a specific clinic manager.
   *
   * @param managerId Manager Account ID
   * @param page Page number
   * @param limit Items per page
   * @param search Search term
   * @param role Filter by clinic role
   * @param fromDate Filter by creation date from
   * @param toDate Filter by creation date to
   */
  async findAllStaffByManager(
    managerId: string,
    page: number = 1,
    limit: number = 10,
    search?: string,
    role?: ClinicRole,
    fromDate?: string,
    toDate?: string,
  ): Promise<StaffListResponseDto> {
    const parent = await this.accountRepository.findAccountById(managerId);
    if (!parent) throw new NotFoundException(MESSAGES.failMessage.userNotFound);

    const clinicId = parent.parentId;
    const allManagers = await this.accountRepository.findByParentIdAndRole(
      clinicId,
      AccountRole.CLINIC_MANAGER,
    );
    const validParentIds = [clinicId, ...allManagers.map((m) => m._id)];

    const [accounts, total] =
      await this.accountRepository.findStaffByClinicWithFilters(
        validParentIds,
        (page - 1) * limit,
        limit,
        search,
        role,
        fromDate,
        toDate,
      );

    const staffItems: StaffItemDto[] = [];
    for (const account of accounts) {
      const staffInfo = account.clinicStaffInformation;
      staffItems.push(new StaffItemDto(account, staffInfo));
    }

    return {
      staff: staffItems,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find All Doctors by Manager (Management View)
   *
   * Retrieves paginated list of doctors for a specific clinic manager.
   *
   * @param managerId Manager Account ID
   * @param page Page number
   * @param limit Items per page
   * @param search Search term
   * @param academicDegree Filter by degree
   * @param fromDate Filter by creation date from
   * @param toDate Filter by creation date to
   */
  async findAllDoctorsByManager(
    managerId: string,
    page: number = 1,
    limit: number = 10,
    search?: string,
    academicDegree?: string,
    fromDate?: string,
    toDate?: string,
  ): Promise<DoctorListResponseDto> {
    const parent = await this.accountRepository.findAccountById(managerId);
    if (!parent) throw new NotFoundException(MESSAGES.failMessage.userNotFound);

    const clinicAdminId = parent.parentId;
    const allManagers = await this.accountRepository.findByParentIdAndRole(
      clinicAdminId,
      AccountRole.CLINIC_MANAGER,
    );
    const validParentIds = [clinicAdminId, ...allManagers.map((m) => m._id)];

    const clinicInfo =
      await this.clinicManagerInfoRepository.findByAccountId(managerId);

    const [accounts, total] =
      await this.accountRepository.findDoctorsWithFilters(
        AccountRole.DOCTOR,
        AccountStatus.ACTIVE,
        (page - 1) * limit,
        limit,
        validParentIds,
        undefined,
        search,
        academicDegree,
        fromDate,
        toDate,
      );

    const doctorItems: DoctorItemDto[] = [];
    for (const account of accounts) {
      const doctorInfo = account.doctorInformation;
      doctorItems.push(new DoctorItemDto(account, doctorInfo, clinicInfo));
    }

    return {
      doctors: doctorItems,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find All Employees by Clinic
   *
   * Retrieves list of employees (doctors and staff) for a specific clinic.
   *
   * @param clinicId Clinic ID
   * @param query Query filters
   */
  async findAllEmployeesByClinic(
    clinicId: string,
    query: GetEmployeesByClinicDto,
  ): Promise<AccountResponseDto[]> {
    const employees =
      await this.accountRepository.findEmployeesByClinicWithFilters(
        clinicId,
        query.role,
        query.search,
      );

    const result: AccountResponseDto[] = [];
    for (const account of employees) {
      result.push(await this.getAccountInformationByRole(account._id));
    }

    return result;
  }
}
