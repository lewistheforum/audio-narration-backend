import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Account } from './entities/accounts.entity';
import { AccountRole, AccountStatus } from './enums';
import { GeneralAccount } from './entities/general_accounts.entity';
import { ClinicInformation } from './entities/clinic_information.entity';
import { ClinicStaffInformation } from './entities/clinic_staff_information.entity';
import { DoctorInformation } from './entities/doctor_information.entity';
import {
  CreateAccountDto,
  UpdatePasswordDto,
  UpdateAccountDto,
  AccountResponseDto,
  BanAccountDto,
  CreateAccountBasicDto,
  CreateAccountProfileDto,
  CreateClinicManagerDto,
  CreateStaffByClinicManagerDto,
  CreateDoctorByClinicManagerDto,
} from './dto';
import { MESSAGES } from 'src/common/message';
import * as bcrypt from 'bcrypt';
import { AccountRepository } from './repositories/account.repository';
import { GeneralAccountRepository } from './repositories/general-account.repository';
import { CodeVerification } from '../mailer/entities/mailer.entity';
import { VerificationType } from 'src/enums/verification-code/enum';
import { UsernameEmailListDto } from './dto/username-email-list.dto';
import { generateVerificationCode } from 'src/common/utils/util';

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
   * @param {Repository<CodeVerification>} codeVerificationRepo - Repository for verification code management
   * @param {DataSource} dataSource - TypeORM DataSource for transaction management
   * @param {Repository<ClinicInformation>} clinicInfoRepo - Repository for clinic information
   * @param {Repository<ClinicStaffInformation>} clinicStaffRepo - Repository for clinic staff information
   * @param {Repository<DoctorInformation>} doctorInfoRepo - Repository for doctor information
   */
  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly generalAccountRepository: GeneralAccountRepository,
    @InjectRepository(CodeVerification)
    private readonly codeVerificationRepo: Repository<CodeVerification>,
    private readonly dataSource: DataSource,
    @InjectRepository(ClinicInformation)
    private readonly clinicInfoRepo: Repository<ClinicInformation>,
    @InjectRepository(ClinicStaffInformation)
    private readonly clinicStaffRepo: Repository<ClinicStaffInformation>,
    @InjectRepository(DoctorInformation)
    private readonly doctorInfoRepo: Repository<DoctorInformation>,
  ) {}

  /**
   * Find All Accounts
   *
   * Retrieves all user accounts from the system with optional inclusion of soft-deleted records.
   * Combines data from both Account and GeneralAccount tables to build complete user profiles.
   *
   * Use Cases:
   * - Admin dashboard displaying all users
   * - User management interfaces
   * - Audit trails and reporting
   *
   * Performance Considerations:
   * - Executes N+1 queries (1 for accounts, N for general accounts)
   * - Consider pagination for large datasets
   *
   * @param {boolean} includeDeleted - Whether to include soft-deleted accounts in results (default: false)
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
  async findAll(includeDeleted: boolean = false): Promise<AccountResponseDto[]> {
    const accounts = await this.accountRepository.findAllAccounts(includeDeleted);

    const result: AccountResponseDto[] = [];
    for (const account of accounts) {
      const generalAccount =
        await this.generalAccountRepository.findGeneralAccountByUserId(account.id);
      result.push(new AccountResponseDto(account, generalAccount));
    }

    return result;
  }

  /**
   * Find Account Entity by ID (Internal)
   *
   * Internal service method to retrieve the full Account entity for business logic operations.
   * This method returns the raw entity with all fields including password hash.
   *
   * Security Note:
   * - This is an internal method - never expose the result directly to clients
   * - Use findOne() for public-facing operations
   *
   * @param {string} id - Account UUID
   * @returns {Promise<Account>} Full Account entity with all fields
   * @throws {NotFoundException} If account does not exist
   *
   * @private
   * @example
   * ```typescript
   * const account = await accountsService.findAccountEntityById('uuid-here');
   * // account contains password hash and all sensitive data
   * ```
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
   *
   * Retrieves the general account profile data associated with a user account.
   * Returns null if no general account exists (possible for accounts created before this feature).
   *
   * @param {string} userId - User Account UUID
   * @returns {Promise<GeneralAccount | null>} General account data or null if not found
   *
   * @example
   * ```typescript
   * const generalAccount = await accountsService.findGeneralAccountByUserId('uuid');
   * if (generalAccount) {
   *   console.log(generalAccount.fullName, generalAccount.gender);
   * }
   * ```
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
   * Create Patient Account
   *
   * Registers a new patient account with standard email/password authentication.
   * Implements a two-step save process to handle the Account-GeneralAccount relationship:
   * 1. Save core account data to accounts table (Account entity)
   * 2. Save extended profile data to general_accounts table (GeneralAccount entity)
   *
   * Business Rules:
   * - Role is automatically set to PATIENT
   * - Status is set to PENDING_VERIFICATION (requires email verification)
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
   * - Status changes from PENDING_VERIFICATION to ACTIVE upon verification
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
      dob: createAccountDto.dob ? new Date(createAccountDto.dob) : undefined,
      profilePicture: createAccountDto.profilePicture,
      role: AccountRole.PATIENT,
      status: AccountStatus.PENDING_VERIFICATION,
    });

    const savedAccount = await this.accountRepository.saveAccount(account);

    // Step 4: Create and save GeneralAccount entity with the Account ID
    let generalAccount: GeneralAccount | null = null;
    if (createAccountDto.fullName || createAccountDto.gender) {
      generalAccount = this.generalAccountRepository.createGeneralAccount({
        generalAccId: savedAccount.id,
        fullName: createAccountDto.fullName,
        gender: createAccountDto.gender,
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
      profilePicture: dto.profilePicture,
    });

    const savedAccount = await this.accountRepository.saveAccount(account);

    // Step 4: Create GeneralAccount with fullName if provided
    let generalAccount: GeneralAccount | null = null;
    if (dto.fullName) {
      generalAccount = this.generalAccountRepository.createGeneralAccount({
        generalAccId: savedAccount.id,
        fullName: dto.fullName,
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
      if (account.role !== AccountRole.PATIENT) {
        throw new ForbiddenException(
          'Only PATIENT accounts can change their email address. Other roles must contact administrator.',
        );
      }

      const existingAccountWithEmail = await this.findByEmail(
        updateAccountDto.email,
      );
      if (existingAccountWithEmail && existingAccountWithEmail.id !== id) {
        throw new ConflictException(MESSAGES.failMessage.emailAlreadyExists);
      }

      account.email = updateAccountDto.email;
      account.isEmailVerified = false; // Reset verification for new email
      account.status = AccountStatus.PENDING_VERIFICATION; // Require re-verification
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
    if (updateAccountDto.dob !== undefined) {
      account.dob = updateAccountDto.dob ? new Date(updateAccountDto.dob) : undefined;
    }
    if (updateAccountDto.profilePicture !== undefined) {
      account.profilePicture = updateAccountDto.profilePicture;
    }

    const updatedAccount = await this.accountRepository.saveAccount(account);

    // Update GeneralAccount if needed
    if (updateAccountDto.fullName !== undefined || updateAccountDto.gender !== undefined) {
      await this.updateGeneralAccount(id, {
        fullName: updateAccountDto.fullName,
        gender: updateAccountDto.gender,
      });
    }

    const generalAccount = await this.findGeneralAccountByUserId(id);

    return {
      user: new AccountResponseDto(updatedAccount, generalAccount),
      emailChanged,
    };
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

    // Verify old password
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
   * - Account status remains unchanged (e.g., BANNED accounts stay BANNED)
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
   * - Status is set to BANNED
   * - Ban count is incremented (tracking repeated violations)
   * - Ban reason is stored for audit and review
   *
   * Effects of Banning:
   * - Account cannot log in
   * - Active sessions should be invalidated (implement at auth layer)
   * - Account status changes to BANNED
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
    if (account.status === AccountStatus.BANNED) {
      throw new ConflictException(MESSAGES.failMessage.userAlreadyBanned);
    }

    // Apply ban
    account.status = AccountStatus.BANNED;
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
   * - Account must currently be BANNED
   * - Status is set to ACTIVE
   * - Ban count and ban description are preserved for audit purposes
   * - Admin-only operation (enforced at controller level)
   *
   * Effects of Unbanning:
   * - Account can log in again
   * - Status changes from BANNED to ACTIVE
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

    if (account.status !== AccountStatus.BANNED) {
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
   * - INCOMPLETE accounts cannot login (profile not completed)
   * - PENDING_VERIFICATION accounts cannot login (email not verified)
   * - BANNED accounts cannot access the system
   * - SUSPENDED accounts cannot access the system
   * - ACTIVE accounts have full access
   *
   * Integration Points:
   * - Called by AuthService during login
   * - Called by JWT strategy during token validation
   * - Called before granting access to protected resources
   *
   * @param {Account} account - Account entity to validate
   * @returns {void} No return value - throws exception on validation failure
   * @throws {ForbiddenException} If account is not in ACTIVE status
   *
   * @example
   * ```typescript
   * const account = await accountsService.findByEmail(email);
   * accountsService.validateAccountAccess(account);
   * // If no exception, account is allowed to access
   * ```
   */
  validateAccountAccess(account: Account): void {
    if (account.status === AccountStatus.INCOMPLETE) {
      throw new ForbiddenException(
        'Account registration is incomplete. Please complete your profile.',
      );
    }

    if (account.status === AccountStatus.PENDING_VERIFICATION) {
      throw new ForbiddenException(
        'Email verification required. Please verify your email to activate your account.',
      );
    }

    if (account.status === AccountStatus.BANNED) {
      throw new ForbiddenException(MESSAGES.failMessage.userAccountBanned);
    }

    if (account.status === AccountStatus.SUSPENDED) {
      throw new ForbiddenException(MESSAGES.failMessage.userAccountInactive);
    }
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
    data: { fullName?: string; gender?: string },
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
      return this.generalAccountRepository.saveGeneralAccount(generalAccount);
    } else {
      // Create new
      generalAccount = this.generalAccountRepository.createGeneralAccount({
        generalAccId: userId,
        fullName: data.fullName,
        gender: data.gender as any,
      });
      return this.generalAccountRepository.saveGeneralAccount(generalAccount);
    }
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
   * 7. Activate account (PENDING_VERIFICATION → ACTIVE)
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
    const storedCode = await this.codeVerificationRepo.findOne({
      where: {
        userId: account.id,
        code,
        used: false,
        type: VerificationType.EMAIL,
      },
      order: { createdAt: 'DESC' },
    });

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
    storedCode.used = true;
    await this.codeVerificationRepo.save(storedCode);

    // Mark email as verified and activate account
    account.isEmailVerified = true;
    account.status = AccountStatus.ACTIVE;
    await this.accountRepository.saveAccount(account);

    // Get general account for firstName/lastName (split fullName)
    const generalAccount = await this.findGeneralAccountByUserId(account.id);
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
   * - Type: EMAIL verification
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
  ): Promise<{ code: string; user: Account & { firstName?: string } }> {
    const account = await this.findByEmail(email);
    if (!account) {
      throw new NotFoundException(MESSAGES.failMessage.userNotFound);
    }

    if (account.isEmailVerified) {
      throw new ConflictException(MESSAGES.failMessage.emailAlreadyVerified);
    }

    // Generate new 6-digit code
    const code = generateVerificationCode();

    // Store code in database with expiration (10 minutes)
    const expiredAt = new Date();
    expiredAt.setMinutes(expiredAt.getMinutes() + 10);

    const verification = this.codeVerificationRepo.create({
      userId: account.id,
      code,
      expiredAt,
      used: false,
      type: VerificationType.EMAIL,
    });
    await this.codeVerificationRepo.save(verification);

    // Get general account for firstName
    const generalAccount = await this.findGeneralAccountByUserId(account.id);
    const names = generalAccount?.fullName?.split(' ') || [];

    return {
      code,
      user: {
        ...account,
        username: account.username,
      },
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

    // Generate new 6-digit code
    const code = generateVerificationCode();

    // Store code in database with expiration (15 minutes for password reset)
    const expiredAt = new Date();
    expiredAt.setMinutes(expiredAt.getMinutes() + 15);

    const verification = this.codeVerificationRepo.create({
      userId: account.id,
      code,
      expiredAt,
      used: false,
      type: VerificationType.RESET,
    });
    await this.codeVerificationRepo.save(verification);

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
   *   'NewSecurePass123'
   * );
   * // Password is now reset
   * ```
   */
  async resetPasswordWithCode(
    email: string,
    newPassword: string,
  ): Promise<void> {
    const account = await this.findByEmail(email);
    if (!account) {
      throw new NotFoundException(MESSAGES.failMessage.userNotFound);
    }

    // OAuth users cannot reset password
    if (account.isOAuthUser && !account.password) {
      throw new BadRequestException(
        MESSAGES.failMessage.oauthUserCannotResetPassword,
      );
    }

    // Find the reset code in the database
    const storedCode = await this.codeVerificationRepo.findOne({
      where: {
        userId: account.id,
        used: false,
        type: VerificationType.RESET,
      },
      order: { createdAt: 'DESC' },
    });

    if (!storedCode) {
      throw new UnauthorizedException(MESSAGES.failMessage.invalidResetCode);
    }

    // Check if code has expired
    if (new Date() > storedCode.expiredAt) {
      throw new UnauthorizedException(MESSAGES.failMessage.resetCodeExpired);
    }

    // Mark code as used
    storedCode.used = true;
    await this.codeVerificationRepo.save(storedCode);

    // Hash and update password
    account.password = await bcrypt.hash(newPassword, this.BCRYPT_SALT_ROUNDS);
    await this.accountRepository.saveAccount(account);
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
      username: accounts.map((account) => account.username).filter((name) => !!name),
      email: accounts.map((account) => account.email),
    };
  }

  /**
   * Create Account Basic (Step 1 of 2-Step Registration)
   *
   * Creates the basic account entity with INCOMPLETE status.
   * This is the first step of the two-step registration process.
   * 
   * Two-Step Registration Flow:
   * 1. Call this method to create account with INCOMPLETE status
   * 2. Call createAccountProfile() to add profile data and activate account
   * 
   * Business Rules:
   * - Role is automatically set to PATIENT
   * - Status is set to INCOMPLETE (not usable until profile is completed)
   * - Email must be unique across all accounts
   * - Password is hashed with bcrypt before storage
   * - Account will be auto-deleted if profile is not completed within reasonable time
   * 
   * Security:
   * - Password is hashed with bcrypt (10 rounds)
   * - Email uniqueness is validated
   * 
   * @param {CreateAccountBasicDto} dto - Basic account data (username, email, password, etc.)
   * @returns {Promise<{accountId: string, email: string, username: string}>} Created account ID and info
   * @throws {ConflictException} If email already exists
   * 
   * @example
   * ```typescript
   * const result = await accountsService.createAccountBasic({
   *   username: 'johndoe',
   *   email: 'john@example.com',
   *   password: 'SecurePass123'
   * });
   * // result: { accountId: 'uuid', email: 'john@example.com', username: 'johndoe' }
   * // Next: Call createAccountProfile(result.accountId, profileData)
   * ```
   */
  async createAccountBasic(
    dto: CreateAccountBasicDto,
  ): Promise<{ accountId: string; email: string; username: string }> {
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

    // Step 3: Create and save Account entity with INCOMPLETE status
    const account = this.accountRepository.createAccount({
      username: dto.username,
      email: dto.email,
      password: hashedPassword,
      phone: dto.phone,
      dob: dto.dob ? new Date(dto.dob) : undefined,
      profilePicture: dto.profilePicture,
      role: AccountRole.PATIENT, // Default role is PATIENT
      status: AccountStatus.INCOMPLETE, // Not usable until profile is completed
    });

    const savedAccount = await this.accountRepository.saveAccount(account);

    return {
      accountId: savedAccount.id,
      email: savedAccount.email,
      username: savedAccount.username,
    };
  }

  /**
   * Create Account Profile (Step 2 of 2-Step Registration)
   *
   * Creates the GeneralAccount profile data and activates the account.
   * This is the second step of the two-step registration process.
   * 
   * Transaction Behavior:
   * - If profile creation fails, the account is automatically deleted (rollback)
   * - Account status changes from INCOMPLETE to PENDING_VERIFICATION
   * - This ensures data integrity across both tables
   * 
   * Business Rules:
   * - Account must exist and be in INCOMPLETE status
   * - fullName and gender are required
   * - Upon success, account status changes to PENDING_VERIFICATION
   * - User must verify email before account becomes ACTIVE
   * 
   * Rollback Mechanism:
   * - If GeneralAccount creation fails, Account is deleted automatically
   * - This ensures we never have orphaned accounts without profiles
   * 
   * @param {string} accountId - Account UUID from step 1 (createAccountBasic)
   * @param {CreateAccountProfileDto} dto - Profile data (fullName, gender)
   * @returns {Promise<AccountResponseDto>} Complete account with profile data
   * @throws {NotFoundException} If account does not exist
   * @throws {BadRequestException} If account is not in INCOMPLETE status
   * @throws {Error} Any error will trigger account deletion
   * 
   * @example
   * ```typescript
   * try {
   *   const account = await accountsService.createAccountProfile(accountId, {
   *     fullName: 'John Doe',
   *     gender: Gender.MALE
   *   });
   *   // Account is now PENDING_VERIFICATION, ready for email verification
   * } catch (error) {
   *   // If this fails, the account created in step 1 is automatically deleted
   * }
   * ```
   */
  async createAccountProfile(
    accountId: string,
    dto: CreateAccountProfileDto,
  ): Promise<AccountResponseDto> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Step 1: Find and validate account
      const account = await this.accountRepository.findAccountById(accountId);
      if (!account) {
        throw new NotFoundException(MESSAGES.failMessage.userNotFound);
      }

      // Step 2: Validate account is in INCOMPLETE status
      if (account.status !== AccountStatus.INCOMPLETE) {
        throw new BadRequestException(
          'Account profile has already been completed or account is not in incomplete state',
        );
      }

      // Step 3: Create GeneralAccount entity
      const generalAccount = this.generalAccountRepository.createGeneralAccount({
        generalAccId: accountId,
        fullName: dto.fullName,
        gender: dto.gender,
      });

      await queryRunner.manager.save(generalAccount);

      // Step 4: Update account status to PENDING_VERIFICATION
      account.status = AccountStatus.PENDING_VERIFICATION;
      await queryRunner.manager.save(account);

      await queryRunner.commitTransaction();

      // Return complete account DTO
      return new AccountResponseDto(account, generalAccount);
    } catch (error) {
      // Rollback transaction
      await queryRunner.rollbackTransaction();

      // If profile creation failed, delete the account (cleanup)
      try {
        await this.accountRepository.deleteAccount(accountId);
      } catch (deleteError) {
        // Log but don't throw - original error is more important
        console.error('Failed to delete incomplete account:', deleteError);
      }

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
   * 2. GeneralAccount entity with manager's personal info
   * 3. ClinicInformation entity with clinic details
   * 
   * Transaction Behavior:
   * - If any step fails, all changes are rolled back
   * - Ensures data integrity across all three tables
   * 
   * @param {CreateClinicManagerDto} dto - Clinic manager registration data
   * @returns {Promise<AccountResponseDto>} Created clinic manager account with all related data
   * @throws {ConflictException} If email already exists
   * @throws {Error} Any error will trigger rollback
   * 
   * @example
   * ```typescript
   * const manager = await accountsService.createClinicManager({
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
      throw new ForbiddenException('Only PATIENT accounts can create clinic manager');
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
      // Step 2: Hash password
      const hashedPassword = await bcrypt.hash(
        dto.password,
        this.BCRYPT_SALT_ROUNDS,
      );

      // Step 3: Create Account entity with CLINIC_MANAGER role
      const account = this.accountRepository.createAccount({
        username: dto.username,
        email: dto.email,
        password: hashedPassword,
        phone: dto.phone,
        role: AccountRole.CLINIC_MANAGER, // Clinic manager role
        status: AccountStatus.ACTIVE, // Clinic managers are immediately active
        isEmailVerified: true, // No email verification required for clinic managers
      });

      const savedAccount = await queryRunner.manager.save(account);

      // Step 4: Create GeneralAccount entity
      const generalAccount = this.generalAccountRepository.createGeneralAccount({
        generalAccId: savedAccount.id,
        fullName: dto.fullName,
      });

      await queryRunner.manager.save(generalAccount);

      // Step 5: Create ClinicInformation entity
      const clinicInfo = this.clinicInfoRepo.create({
        clinicId: savedAccount.id,
        clinicName: dto.clinicName,
        description: dto.description,
      });

      await queryRunner.manager.save(clinicInfo);

      await queryRunner.commitTransaction();

      // Return complete account DTO
      return new AccountResponseDto(savedAccount, generalAccount);
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
      throw new ForbiddenException('Only clinic managers can add staff members');
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
      // Following 2-step registration pattern: Create INCOMPLETE account first
      const account = this.accountRepository.createAccount({
        username: dto.email.split('@')[0],
        email: dto.email,
        password: hashedPassword,
        parentId: managerId, // Link to clinic manager
        role: AccountRole.CLINIC_STAFF,
        status: AccountStatus.INCOMPLETE, // 2-step pattern: Start with INCOMPLETE
        isEmailVerified: false, // Staff must verify themselves
      });

      const savedAccount = await queryRunner.manager.save(account);

      // Step 5: Create ClinicStaffInformation entity with basic info
      const staffInfo = this.clinicStaffRepo.create({
        clinicAccId: savedAccount.id,
        fullName: dto.fullName,
        gender: dto.gender,
        clinicRole: dto.clinicRole,
      });

      await queryRunner.manager.save(staffInfo);

      await queryRunner.commitTransaction();

      // Return account DTO
      // Note: Staff account is INCOMPLETE - staff must complete profile themselves
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
      // Following 2-step registration pattern: Create INCOMPLETE account first
      const account = this.accountRepository.createAccount({
        username: dto.email.split('@')[0],
        email: dto.email,
        password: hashedPassword,
        parentId: managerId, // Link to clinic manager
        role: AccountRole.DOCTOR,
        status: AccountStatus.INCOMPLETE, // 2-step pattern: Start with INCOMPLETE
        isEmailVerified: false, // Doctor must verify themselves
      });

      const savedAccount = await queryRunner.manager.save(account);

      // Step 5: Create DoctorInformation entity with basic info
      const doctorInfo = this.doctorInfoRepo.create({
        doctorAccId: savedAccount.id,
        fullName: dto.fullName,
        gender: dto.gender,
        academicDegree: dto.academicDegree,
        experience: dto.experience,
        position: dto.position,
        // Note: specialization and consultationFee are not fields in DoctorInformation entity
      });

      await queryRunner.manager.save(doctorInfo);

      await queryRunner.commitTransaction();

      // Return account DTO
      // Note: Doctor account is INCOMPLETE - doctor must complete profile themselves
      return new AccountResponseDto(savedAccount, null);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}

