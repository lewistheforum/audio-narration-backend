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
import { AccountRole, AccountStatus, VerificationType } from './enums';
import * as crypto from 'crypto';
import { GeneralAccount } from './entities/general_accounts.entity';
import { ClinicAdminInformation } from './entities/clinic-admin-information.entity';
import { ClinicManagerInformation } from './entities/clinic_manager_information.entity';
import { ClinicStaffInformation } from './entities/clinic_staff_information.entity';
import { DoctorInformation } from './entities/doctor_information.entity';
import {
  CreateAccountDto,
  UpdatePasswordDto,
  UpdateAccountDto,
  AccountResponseDto,
  BanAccountDto,
  CreateClinicManagerDto,
  CreateStaffByClinicManagerDto,
  CreateDoctorByClinicManagerDto,
  CreateClinicAdminProfileDto,
  UpdateClinicAdminProfileDto,
} from './dto';
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
import { generateVerificationCode } from 'src/common/utils/util';
import { MailerService } from '../mailer/mailer.service';
import {
  ClinicSubscriptionRepository,
  SubscriptionServiceRepository,
} from '../subscriptions/repositories';

/**
 * Accounts Service
 *
 * Centralized service layer for managing all account-related operations in the Medicare system.
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
    private readonly subscriptionServiceRepository: SubscriptionServiceRepository,
    private readonly mailerService: MailerService,
  ) { }

  private generateKeyPair(): { publicKey: string; encryptedPrivateKey: string } {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });

    return { publicKey, encryptedPrivateKey: privateKey };
  }

  async generateUserKeys(userId: string): Promise<{ publicKey: string; encryptedPrivateKey: string }> {
    const { publicKey, encryptedPrivateKey } = this.generateKeyPair();
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
      status: AccountStatus.PENDING,
    });

    const savedAccount = await this.accountRepository.saveAccount(account);

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
   *   phone: '+84987654321'
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
      account.status = AccountStatus.PENDING; // Require re-verification
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
    return {
      user: await this.getAccountInformationByRole(id),
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

    // PENDING: Throw 401 Unauthorized - email verification required
    if (account.status === AccountStatus.PENDING) {
      throw new UnauthorizedException(
        'Email verification required. Please verify your email to activate your account.',
      );
    }

    // INACTIVE: Throw 401 Unauthorized - account suspended
    if (account.status === AccountStatus.INACTIVE) {
      throw new UnauthorizedException(
        'Your account is inactive. Please contact support for assistance.',
      );
    }

    // DELETED: Throw 401 Unauthorized - account deleted
    if (account.status === AccountStatus.DELETED) {
      throw new UnauthorizedException(
        'Your account has been deleted. Please contact support for assistance.',
      );
    }

    // EXPIRED: Throw 403 Forbidden - subscription expired
    if (account.status === AccountStatus.EXPIRED) {
      throw new ForbiddenException(
        'Your subscription has expired. Please renew your subscription to continue.',
      );
    }

    // REFILL: Throw 403 Forbidden - subscription refill required
    if (account.status === AccountStatus.REFILL) {
      throw new ForbiddenException(
        'Your account needs a refill. Please refill your subscription to continue.',
      );
    }

    // ACTIVE: Allow access (no exception thrown)
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
    if (new Date() > storedCode.expiredAt) {
      throw new UnauthorizedException(
        MESSAGES.failMessage.verificationCodeExpired,
      );
    }

    // Mark code as used (prevent reuse)
    await this.codeVerificationRepository.markAsUsed(storedCode._id);

    // Mark email as verified and activate account
    account.isEmailVerified = true;
    account.status = AccountStatus.ACTIVE;
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
    const expiredAt = new Date();
    expiredAt.setMinutes(expiredAt.getMinutes() + 10);

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
    const expiredAt = new Date();
    expiredAt.setMinutes(expiredAt.getMinutes() + 15);

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
    if (new Date() > storedCode.expiredAt) {
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
        status: AccountStatus.PENDING,
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

      // Generate new 6-digit code
      const code = generateVerificationCode();

      // Store code in database with expiration (15 minutes for password reset)
      const expiredAt = new Date();
      expiredAt.setMinutes(expiredAt.getMinutes() + 15);

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
  async createClinicManager(
    patientId: string,
    dto: CreateClinicManagerDto,
  ): Promise<AccountResponseDto> {
    // Step 1: Validate patient exists and has PATIENT role
    const patient = await this.findAccountEntityById(patientId);
    if (patient.role !== AccountRole.PATIENT) {
      throw new ForbiddenException(
        'Only PATIENT accounts can create clinic manager',
      );
    }

    // TODO: Add validation for clinic service purchase/subscription
    // if (!patient.hasClinicServiceSubscription) {
    //   throw new ForbiddenException('You must purchase clinic service first');
    // }

    // Step 2: Validate email uniqueness
    const existingAccount = await this.findByEmail(dto.email);
    if (existingAccount) {
      throw new ConflictException(MESSAGES.failMessage.userEmailAlreadyExists);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Step 3: Hash password
      const hashedPassword = await bcrypt.hash(
        dto.password,
        this.BCRYPT_SALT_ROUNDS,
      );

      // Step 4: Create Account entity with CLINIC_MANAGER role
      const account = this.accountRepository.createAccount({
        username: dto.username,
        email: dto.email,
        password: hashedPassword,
        phone: dto.phone,
        role: AccountRole.CLINIC_MANAGER, // Clinic manager role
        status: AccountStatus.ACTIVE, // Clinic managers are immediately active
        isOAuthUser: false,
        isEmailVerified: true, // No email verification required for clinic managers
        banCounts: 0,
        banDescription: '',
      });



      const savedAccount = await queryRunner.manager.save(account);

      // Step 5: Validate account has CLINIC_MANAGER role before creating ClinicManagerInformation
      // This ensures data integrity - only CLINIC_MANAGER accounts can have clinic manager information
      this.validateClinicManagerRole(savedAccount);

      // Step 6: Create ClinicManagerInformation entity
      const clinicManagerInfo = this.clinicManagerInfoRepository.create({
        accountId: savedAccount._id,
        clinicBranchName: dto.clinicName,
        fullName: dto.clinicName, // Use clinicName as fullName
        gender: 'OTHER' as any, // Default to OTHER
        dob: dto.dob ? new Date(dto.dob) : undefined,
        profilePicture: dto.profilePicture,
      });

      await queryRunner.manager.save(clinicManagerInfo);

      await queryRunner.commitTransaction();

      // Return complete account DTO
      return new AccountResponseDto(savedAccount);
    } catch (error) {
      // Rollback transaction
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

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

    // Step 2: Validate email uniqueness
    const existingAccount = await this.findByEmail(dto.email);
    if (existingAccount) {
      throw new ConflictException(MESSAGES.failMessage.userEmailAlreadyExists);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Step 3: Hash password
      const hashedPassword = await bcrypt.hash(
        dto.password,
        this.BCRYPT_SALT_ROUNDS,
      );

      // Step 4: Create Account entity with CLINIC_STAFF role
      // Following 2-step registration pattern: Create PENDING account first
      const account = this.accountRepository.createAccount({
        username: dto.email.split('@')[0],
        email: dto.email,
        password: hashedPassword,
        parentId: managerId, // Link to clinic manager
        role: AccountRole.CLINIC_STAFF,
        status: AccountStatus.PENDING, // 2-step pattern: Start with PENDING
        isEmailVerified: false, // Staff must verify themselves
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

    // Step 2: Validate email uniqueness
    const existingAccount = await this.findByEmail(dto.email);
    if (existingAccount) {
      throw new ConflictException(MESSAGES.failMessage.userEmailAlreadyExists);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Step 3: Hash password
      const hashedPassword = await bcrypt.hash(
        dto.password,
        this.BCRYPT_SALT_ROUNDS,
      );

      // Step 4: Create Account entity with DOCTOR role
      // Following 2-step registration pattern: Create PENDING account first
      const account = this.accountRepository.createAccount({
        username: dto.email.split('@')[0],
        email: dto.email,
        password: hashedPassword,
        parentId: managerId, // Link to clinic manager
        role: AccountRole.DOCTOR,
        status: AccountStatus.PENDING, // 2-step pattern: Start with PENDING
        isEmailVerified: false, // Doctor must verify themselves
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
  async findAllClinics(
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

      if (clinicInfo && address) {
        clinicItems.push(
          new ClinicItemDto(clinic, clinicInfo, address, clinicAdminInfo),
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
      doctors.push(new DoctorSummaryDto(doctor, doctorInfo));
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

    return new ClinicDetailResponseDto(
      clinic,
      clinicInfo,
      addressDetails,
      doctors,
      subscription,
      clinicAdmin,
      clinicAdminInfo,
      finalClinicName,
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
    const [doctors, total] = await this.accountRepository.findDoctorsWithFilters(
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
      const doctorInfo =
        await this.doctorInfoRepository.findByAccountId(doctor._id);

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
  async findAllEmployeesByClinic(
    clinicId: string,
    role?: AccountRole,
    search?: string,
  ): Promise<Account[]> {
    return this.accountRepository.findEmployeesByClinicWithFilters(
      clinicId,
      role,
      search,
    );
  }



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

    // Create PublicDoctorDetailData with modified account and doctor info
    const publicDoctorDetailData = new PublicDoctorDetailData(
      modifiedAccount,
      doctorInfo,
      clinicInfo,
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
   * Find Clinic Admin Profile by Account ID
   *
   * Retrieves the clinic admin profile information for a specific account.
   * Only accounts with CLINIC_ADMIN role can have clinic admin profiles.
   *
   * Business Rules:
   * - Account must have CLINIC_ADMIN role
   * - Only returns profile if account exists and has CLINIC_ADMIN role
   * - Returns null if profile not found
   *
   * @param {string} accountId - Account UUID
   * @returns {Promise<ClinicAdminInformation | null>} Clinic admin profile or null
   * @throws {BadRequestException} If account does not have CLINIC_ADMIN role
   *
   * @example
   * ```typescript
   * const profile = await accountsService.findClinicAdminProfile('account-uuid');
   * if (profile) {
   *   console.log(profile.clinicName);
   * }
   * ```
   */
  async findClinicAdminProfile(
    accountId: string,
  ): Promise<ClinicAdminInformation | null> {
    const account = await this.findAccountEntityById(accountId);
    this.validateClinicAdminRole(account);

    return this.clinicAdminInfoRepository.findByAccountId(accountId);
  }

  /**
   * Create Clinic Admin Profile
   *
   * Creates a new clinic admin profile for an account.
   * This method is used to create the profile after the account is created.
   *
   * Business Rules:
   * - Account must have CLINIC_ADMIN role
   * - Profile is created with provided data
   * - All fields are optional except clinicName
   *
   * @param {string} accountId - Account UUID
   * @param {CreateClinicAdminProfileDto} dto - Clinic admin profile data
   * @returns {Promise<ClinicAdminInformation>} Created clinic admin profile
   * @throws {BadRequestException} If account does not have CLINIC_ADMIN role
   *
   * @example
   * ```typescript
   * const profile = await accountsService.createClinicAdminProfile('account-uuid', {
   *   clinicName: 'City Medical Clinic',
   *   description: 'A modern healthcare facility'
   * });
   * ```
   */
  async createClinicAdminProfile(
    accountId: string,
    dto: CreateClinicAdminProfileDto,
  ): Promise<ClinicAdminInformation> {
    const account = await this.findAccountEntityById(accountId);
    this.validateClinicAdminRole(account);

    const profile = this.clinicAdminInfoRepository.create({
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

    return this.clinicAdminInfoRepository.save(profile);
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
      return this.clinicAdminInfoRepository.save(profile);
    } else {
      // Create new profile if doesn't exist
      const profile = this.clinicAdminInfoRepository.create({
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

      return this.clinicAdminInfoRepository.save(profile);
    }
  }
}
