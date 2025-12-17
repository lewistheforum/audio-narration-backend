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
import { Repository } from 'typeorm';
import { User } from './entities/accounts.entity';
import { UserRole, UserStatus } from 'src/enums/client/enum';
import { GeneralAccount } from './entities/general_accounts.entity';
import {
  CreateClientDto,
  UpdatePasswordDto,
  UpdateClientDto,
  ClientResponseDto,
  BanClientDto,
} from './dto';
import { MESSAGES } from 'src/common/message';
import * as bcrypt from 'bcrypt';
import { ClientRepository } from './client.repository';
import { CodeVerification } from '../mailer/entities/mailer.entity';
import { VerificationType } from 'src/enums/verification-code/enum';
import { UsernameEmailListDto } from './dto/username-email-list.dto';
import { generateVerificationCode } from 'src/common/utils/util';

/**
 * Client Service
 *
 * Handles all business logic for client management including:
 * - Client CRUD operations (using two tables: users + general_accounts)
 * - Patient registration with two-step save
 * - OAuth client creation
 * - Password management
 * - Email uniqueness validation
 * - Soft delete and account restoration
 * - Client status management
 */
@Injectable()
export class ClientService {
  private readonly BCRYPT_SALT_ROUNDS = 10;

  constructor(
    private readonly clientRepository: ClientRepository,
    @InjectRepository(CodeVerification)
    private readonly codeVerificationRepo: Repository<CodeVerification>,
  ) {}

  /**
   * Get All Clients
   *
   * Retrieves all clients (excluding soft-deleted) with their general account data
   *
   * @param includeDeleted - Whether to include soft-deleted clients (default: false)
   * @returns Array of client DTOs with sensitive data excluded
   */
  async findAll(includeDeleted: boolean = false): Promise<ClientResponseDto[]> {
    const clients = await this.clientRepository.findAllUsers(includeDeleted);

    const result: ClientResponseDto[] = [];
    for (const client of clients) {
      const generalAccount =
        await this.clientRepository.findGeneralAccountByUserId(client.id);
      result.push(new ClientResponseDto(client, generalAccount));
    }

    return result;
  }

  /**
   * Find Client Entity by ID
   *
   * Internal method to retrieve full client entity
   * Used by service methods that need to manipulate client data
   *
   * @param id - Client UUID
   * @returns Client entity
   * @throws NotFoundException if client doesn't exist
   */
  async findUserEntityById(id: string): Promise<User> {
    const client = await this.clientRepository.findUserById(id);
    if (!client) {
      throw new NotFoundException(MESSAGES.failMessage.userNotFound);
    }
    return client;
  }

  /**
   * Find General Account by User ID
   *
   * @param userId - User UUID
   * @returns GeneralAccount or null
   */
  async findGeneralAccountByUserId(
    userId: string,
  ): Promise<GeneralAccount | null> {
    return this.clientRepository.findGeneralAccountByUserId(userId);
  }

  /**
   * Find Client by ID
   *
   * Public method to retrieve client data as DTO
   *
   * @param id - Client UUID
   * @returns Client DTO with sensitive data excluded
   */
  async findOne(id: string): Promise<ClientResponseDto> {
    const client = await this.findUserEntityById(id);
    const generalAccount = await this.findGeneralAccountByUserId(id);
    return new ClientResponseDto(client, generalAccount);
  }

  /**
   * Create Client (Legacy Method)
   *
   * Defaults to patient registration for backward compatibility
   *
   * @deprecated Use createPatient() instead for clarity
   * @param createClientDto - Client registration data
   * @returns Created client DTO
   */
  async create(
    createClientDto: CreateClientDto,
  ): Promise<{ user: ClientResponseDto }> {
    return this.createPatient(createClientDto);
  }

  /**
   * Create Patient Account
   *
   * Registers a new patient with standard authentication using two-step save:
   * 1. Save common account data to users table (User entity)
   * 2. Save client-specific data to general_accounts table (GeneralAccount entity)
   *
   * Business Rules:
   * - Role is automatically set to PATIENT
   * - Status is set to PENDING_VERIFICATION
   * - Email must be unique across all clients
   * - Password is hashed with bcrypt before storage
   *
   * @param createClientDto - Patient registration data
   * @returns Created patient client DTO
   * @throws ConflictException if email already exists
   */
  async createPatient(
    createClientDto: CreateClientDto,
  ): Promise<{ user: ClientResponseDto }> {
    const existingClient = await this.findByEmail(createClientDto.email);
    if (existingClient) {
      throw new ConflictException(MESSAGES.failMessage.userEmailAlreadyExists);
    }

    const hashedPassword = await bcrypt.hash(
      createClientDto.password,
      this.BCRYPT_SALT_ROUNDS,
    );

    // Step 1: Create and save User entity
    const client = this.clientRepository.createUser({
      username: createClientDto.username,
      email: createClientDto.email,
      password: hashedPassword,
      phone: createClientDto.phone,
      dob: createClientDto.dob ? new Date(createClientDto.dob) : undefined,
      profilePicture: createClientDto.profilePicture,
      role: UserRole.PATIENT,
      status: UserStatus.PENDING_VERIFICATION,
    });

    const savedClient = await this.clientRepository.saveUser(client);

    // Step 2: Create and save GeneralAccount entity with the User ID
    let generalAccount: GeneralAccount | null = null;
    if (createClientDto.fullName || createClientDto.gender) {
      generalAccount = this.clientRepository.createGeneralAccount({
        generalAccId: savedClient.id,
        fullName: createClientDto.fullName,
        gender: createClientDto.gender,
      });
      await this.clientRepository.saveGeneralAccount(generalAccount);
    }

    return {
      user: new ClientResponseDto(savedClient, generalAccount),
    };
  }

  /**
   * Create Patient via OAuth
   *
   * Creates a patient account using OAuth provider (currently Google only)
   * Uses two-step save for User and GeneralAccount entities
   *
   * OAuth-Specific Behavior:
   * - Role is automatically set to PATIENT (business rule)
   * - Status is set to ACTIVE (OAuth providers handle email verification)
   * - isOAuthUser flag is set to true
   * - isEmailVerified is set to true
   * - profilePicture from OAuth provider is stored
   * - Password is a hashed random value (not used for OAuth login)
   *
   * @param dto - OAuth client data from provider
   * @returns Created OAuth client DTO
   * @throws ConflictException if email already exists
   */
  async createPatientViaOAuth(dto: {
    email: string;
    password: string;
    username?: string;
    fullName?: string;
    profilePicture?: string;
  }): Promise<ClientResponseDto> {
    const existingClient = await this.findByEmail(dto.email);
    if (existingClient) {
      throw new ConflictException(MESSAGES.failMessage.userEmailAlreadyExists);
    }

    const hashedPassword = await bcrypt.hash(
      dto.password,
      this.BCRYPT_SALT_ROUNDS,
    );

    // Step 1: Create and save User entity
    const client = this.clientRepository.createUser({
      username: dto.username || dto.email.split('@')[0], // Use email prefix as username
      email: dto.email,
      password: hashedPassword,
      role: UserRole.PATIENT,
      status: UserStatus.ACTIVE,
      isOAuthUser: true,
      isEmailVerified: true,
      profilePicture: dto.profilePicture,
    });

    const savedClient = await this.clientRepository.saveUser(client);

    // Step 2: Create GeneralAccount with fullName if provided
    let generalAccount: GeneralAccount | null = null;
    if (dto.fullName) {
      generalAccount = this.clientRepository.createGeneralAccount({
        generalAccId: savedClient.id,
        fullName: dto.fullName,
      });
      await this.clientRepository.saveGeneralAccount(generalAccount);
    }

    return new ClientResponseDto(savedClient, generalAccount);
  }

  /**
   * Update Client Entity
   *
   * Internal method to save client entity changes
   *
   * @param client - Client entity with changes to persist
   * @returns Updated client entity
   */
  async updateUserEntity(client: User): Promise<User> {
    return this.clientRepository.saveUser(client);
  }

  /**
   * Update Client Profile
   *
   * Updates client information with validation
   *
   * Business Rules:
   * - Email must remain unique if changed
   * - If email changes, isEmailVerified is set to false
   *
   * @param id - Client UUID
   * @param updateClientDto - Updated client data
   * @returns Updated client DTO
   * @throws ConflictException if email conflict
   */
  async update(
    id: string,
    updateClientDto: UpdateClientDto,
  ): Promise<{ user: ClientResponseDto; emailChanged?: boolean }> {
    const client = await this.findUserEntityById(id);
    let emailChanged = false;

    // Validate email uniqueness if changed
    if (updateClientDto.email && updateClientDto.email !== client.email) {
      const existingClientWithEmail = await this.findByEmail(
        updateClientDto.email,
      );
      if (existingClientWithEmail && existingClientWithEmail.id !== id) {
        throw new ConflictException(MESSAGES.failMessage.emailAlreadyExists);
      }

      client.email = updateClientDto.email;
      client.isEmailVerified = false;
      emailChanged = true;
    }

    // Handle role updates
    if (updateClientDto.role) {
      client.role = updateClientDto.role;
    }

    // Update basic fields
    if (updateClientDto.username !== undefined) {
      client.username = updateClientDto.username;
    }
    if (updateClientDto.phone !== undefined) {
      client.phone = updateClientDto.phone;
    }

    const updatedClient = await this.clientRepository.saveUser(client);
    const generalAccount = await this.findGeneralAccountByUserId(id);

    return {
      user: new ClientResponseDto(updatedClient, generalAccount),
      emailChanged,
    };
  }

  /**
   * Update Client Password
   *
   * Changes client password after verifying old password
   *
   * Security Rules:
   * - Old password must match current password
   * - New password cannot be the same as old password
   * - Password is hashed before storage
   *
   * @param clientId - Client UUID
   * @param updatePasswordDto - Old and new password data
   * @throws UnauthorizedException if old password is incorrect
   * @throws ConflictException if new password matches old password
   */
  async updatePassword(
    clientId: string,
    updatePasswordDto: UpdatePasswordDto,
  ): Promise<void> {
    const { oldPassword, newPassword } = updatePasswordDto;
    const client = await this.findUserEntityById(clientId);

    const isPasswordMatching = await bcrypt.compare(
      oldPassword,
      client.password,
    );
    if (!isPasswordMatching) {
      throw new UnauthorizedException(MESSAGES.failMessage.incorrectPassword);
    }

    if (oldPassword === newPassword) {
      throw new ConflictException(MESSAGES.failMessage.newPasswordSameAsOld);
    }

    client.password = await bcrypt.hash(newPassword, this.BCRYPT_SALT_ROUNDS);
    await this.clientRepository.saveUser(client);
  }

  /**
   * Delete Client
   *
   * Soft deletes a client from the system (sets deletedAt timestamp)
   * Data is retained for audit trails and potential recovery
   *
   * @param id - Client UUID to delete
   * @throws NotFoundException if client doesn't exist
   */
  async delete(id: string): Promise<void> {
    const client = await this.findUserEntityById(id);
    await this.clientRepository.softDeleteUser(id);
    // Also soft delete the general account
    await this.clientRepository.softDeleteGeneralAccount(id);
  }

  /**
   * Restore Soft-Deleted Client
   *
   * Restores a previously soft-deleted client account
   *
   * @param id - Client UUID to restore
   * @throws NotFoundException if client doesn't exist or wasn't deleted
   */
  async restore(id: string): Promise<ClientResponseDto> {
    const client = await this.clientRepository.findUserByIdWithDeleted(id);

    if (!client) {
      throw new NotFoundException(MESSAGES.failMessage.userNotFound);
    }

    if (!client.deletedAt) {
      throw new BadRequestException(MESSAGES.failMessage.userNotDeleted);
    }

    await this.clientRepository.restoreUser(id);
    await this.clientRepository.restoreGeneralAccount(id);

    const restoredClient = await this.findUserEntityById(id);
    const generalAccount = await this.findGeneralAccountByUserId(id);
    return new ClientResponseDto(restoredClient, generalAccount);
  }

  /**
   * Permanently Delete Client
   *
   * Permanently removes client from database (hard delete)
   * This action cannot be undone
   *
   * @param id - Client UUID to permanently delete
   * @throws NotFoundException if client doesn't exist
   */
  async permanentDelete(id: string): Promise<void> {
    // Delete GeneralAccount first (foreign key constraint)
    await this.clientRepository.deleteGeneralAccount(id);
    const affected = await this.clientRepository.deleteUser(id);
    if (affected === 0) {
      throw new NotFoundException(MESSAGES.failMessage.userNotFound);
    }
  }

  /**
   * Ban Client Account
   *
   * Bans a client account, preventing login and access to system
   *
   * Business Rules:
   * - Cannot ban admin users
   * - Cannot ban already banned clients
   * - Sets status to BANNED
   *
   * @param clientId - Client ID to ban
   * @param banDto - Ban reason
   * @param adminId - Admin ID performing the ban
   * @throws NotFoundException if client doesn't exist
   * @throws ForbiddenException if trying to ban admin
   * @throws ConflictException if client already banned
   */
  async banUser(
    clientId: string,
    banDto: BanClientDto,
    adminId: string,
  ): Promise<ClientResponseDto> {
    const client = await this.findUserEntityById(clientId);

    if (client.role === UserRole.ADMIN) {
      throw new ForbiddenException(MESSAGES.failMessage.cannotBanAdmin);
    }

    if (clientId === adminId) {
      throw new ForbiddenException(MESSAGES.failMessage.cannotBanSelf);
    }

    if (client.status === UserStatus.BANNED) {
      throw new ConflictException(MESSAGES.failMessage.userAlreadyBanned);
    }

    client.status = UserStatus.BANNED;
    const bannedClient = await this.clientRepository.saveUser(client);
    const generalAccount = await this.findGeneralAccountByUserId(clientId);
    return new ClientResponseDto(bannedClient, generalAccount);
  }

  /**
   * Unban Client Account
   *
   * Removes ban from client account, allowing access again
   * Sets status back to ACTIVE
   *
   * @param clientId - Client ID to unban
   * @throws NotFoundException if client doesn't exist
   * @throws BadRequestException if client is not banned
   */
  async unbanUser(clientId: string): Promise<ClientResponseDto> {
    const client = await this.findUserEntityById(clientId);

    if (client.status !== UserStatus.BANNED) {
      throw new BadRequestException(MESSAGES.failMessage.userNotBanned);
    }

    client.status = UserStatus.ACTIVE;
    const unbannedClient = await this.clientRepository.saveUser(client);
    const generalAccount = await this.findGeneralAccountByUserId(clientId);
    return new ClientResponseDto(unbannedClient, generalAccount);
  }

  /**
   * Check Client Status and Access
   *
   * Validates if client can access the system based on status
   * Called during authentication to prevent banned/inactive clients from logging in
   *
   * @param client - Client entity
   * @throws ForbiddenException if client is banned or inactive
   */
  validateUserAccess(client: User): void {
    if (client.status === UserStatus.BANNED) {
      throw new ForbiddenException(MESSAGES.failMessage.userAccountBanned);
    }

    if (client.status === UserStatus.INACTIVE) {
      throw new ForbiddenException(MESSAGES.failMessage.userAccountInactive);
    }
  }

  /**
   * Find Client by Email
   *
   * Used for authentication and duplicate email validation
   *
   * @param email - Client email address (plaintext)
   * @returns Client entity or null if not found
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.clientRepository.findUserByEmail(email);
  }

  /**
   * Find Multiple Clients by IDs
   *
   * Batch retrieval for conversation participants or other multi-client queries
   *
   * @param ids - Array of client UUIDs
   * @returns Array of client entities (empty array if no IDs provided)
   */
  async findUsersByIds(ids: string[]): Promise<User[]> {
    return this.clientRepository.findUsersByIds(ids);
  }

  /**
   * Update GeneralAccount
   *
   * Updates client-specific data in GeneralAccount table
   *
   * @param userId - User UUID
   * @param data - Data to update (fullName, gender)
   * @returns Updated GeneralAccount
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
      return this.clientRepository.saveGeneralAccount(generalAccount);
    } else {
      // Create new
      generalAccount = this.clientRepository.createGeneralAccount({
        generalAccId: userId,
        fullName: data.fullName,
        gender: data.gender as any,
      });
      return this.clientRepository.saveGeneralAccount(generalAccount);
    }
  }

  /**
   * Verify Email Code
   *
   * Verifies user's email using the 6-digit verification code
   *
   * @param email - User email
   * @param code - 6-digit verification code
   * @returns User entity with updated verification status
   * @throws NotFoundException if user not found
   * @throws UnauthorizedException if code is invalid or expired
   * @throws ConflictException if email already verified
   */
  async verifyEmailCode(
    email: string,
    code: string,
  ): Promise<User & { firstName?: string; lastName?: string }> {
    const client = await this.findByEmail(email);
    if (!client) {
      throw new NotFoundException(MESSAGES.failMessage.userNotFound);
    }

    if (client.isEmailVerified) {
      throw new ConflictException(MESSAGES.failMessage.emailAlreadyVerified);
    }

    // Find the verification code in the database
    const storedCode = await this.codeVerificationRepo.findOne({
      where: {
        userId: client.id,
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

    // Mark code as used
    storedCode.used = true;
    await this.codeVerificationRepo.save(storedCode);

    // Mark email as verified and activate account
    client.isEmailVerified = true;
    client.status = UserStatus.ACTIVE;
    await this.clientRepository.saveUser(client);

    // Get general account for firstName/lastName (using fullName split)
    const generalAccount = await this.findGeneralAccountByUserId(client.id);
    const names = generalAccount?.fullName?.split(' ') || [];

    return {
      ...client,
      firstName: names[0] || client.username,
      lastName: names.slice(1).join(' ') || undefined,
    };
  }

  /**
   * Resend Verification Code
   *
   * Generates a new verification code and returns it for email sending
   *
   * @param email - User email
   * @returns Object with code and user data
   * @throws NotFoundException if user not found
   * @throws ConflictException if email already verified
   */
  async resendVerificationCode(
    email: string,
  ): Promise<{ code: string; user: User & { firstName?: string } }> {
    const client = await this.findByEmail(email);
    if (!client) {
      throw new NotFoundException(MESSAGES.failMessage.userNotFound);
    }

    if (client.isEmailVerified) {
      throw new ConflictException(MESSAGES.failMessage.emailAlreadyVerified);
    }

    // Generate new 6-digit code
    const code = generateVerificationCode();

    // Store code in database with expiration (10 minutes)
    const expiredAt = new Date();
    expiredAt.setMinutes(expiredAt.getMinutes() + 10);

    const verification = this.codeVerificationRepo.create({
      userId: client.id,
      code,
      expiredAt,
      used: false,
      type: VerificationType.EMAIL,
    });
    await this.codeVerificationRepo.save(verification);

    // Get general account for firstName
    const generalAccount = await this.findGeneralAccountByUserId(client.id);
    const names = generalAccount?.fullName?.split(' ') || [];

    return {
      code,
      user: {
        ...client,
        username: client.username,
      },
    };
  }

  /**
   * Initiate Password Reset
   *
   * Generates a password reset code and returns it for email sending
   *
   * @param email - User email
   * @returns Object with code and user data
   * @throws NotFoundException if user not found
   * @throws BadRequestException if user is OAuth-only
   */
  async initiatePasswordReset(
    email: string,
  ): Promise<{ code: string; user: User }> {
    const client = await this.findByEmail(email);

    console.log('check email user: ', client);

    if (!client) {
      throw new NotFoundException(MESSAGES.failMessage.userNotFound);
    }

    if (client.isOAuthUser && !client.password) {
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
      userId: client.id,
      code,
      expiredAt,
      used: false,
      type: VerificationType.RESET,
    });
    await this.codeVerificationRepo.save(verification);

    // Get general account for firstName
    const generalAccount = await this.findGeneralAccountByUserId(client.id);
    const names = generalAccount?.fullName?.split(' ') || [];

    return {
      code,
      user: {
        ...client,
        username: client.username,
      },
    };
  }

  /**
   * Reset Password With Code
   *
   * Resets user password using the verification code
   *
   * @param email - User email
   * @param code - 6-digit reset code
   * @param newPassword - New password
   * @throws NotFoundException if user not found
   * @throws UnauthorizedException if code is invalid or expired
   * @throws BadRequestException if user is OAuth-only
   */
  async resetPasswordWithCode(
    email: string,
    // code: string,
    newPassword: string,
  ): Promise<void> {
    const client = await this.findByEmail(email);
    if (!client) {
      throw new NotFoundException(MESSAGES.failMessage.userNotFound);
    }

    if (client.isOAuthUser && !client.password) {
      throw new BadRequestException(
        MESSAGES.failMessage.oauthUserCannotResetPassword,
      );
    }

    // Find the reset code in the database
    const storedCode = await this.codeVerificationRepo.findOne({
      where: {
        userId: client.id,
        // code,
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

    // Update password
    client.password = await bcrypt.hash(newPassword, this.BCRYPT_SALT_ROUNDS);
    await this.clientRepository.saveUser(client);
  }

  /**
   * Create Clinic Staff Account
   *
   * Creates a clinic staff account linked to an existing patient account
   *
   * @param patientId - UUID of the parent patient account
   * @param dto - Clinic staff registration data
   * @returns Created clinic staff DTO
   * @throws NotFoundException if patient not found
   * @throws ConflictException if email already exists
   */
  async createClinicStaff(
    patientId: string,
    dto: any,
  ): Promise<ClientResponseDto> {
    // Validate parent patient exists
    const parentPatient = await this.findUserEntityById(patientId);

    // Check email uniqueness
    const existingClient = await this.findByEmail(dto.email);
    if (existingClient) {
      throw new ConflictException(MESSAGES.failMessage.userEmailAlreadyExists);
    }

    const hashedPassword = await bcrypt.hash(
      dto.password,
      this.BCRYPT_SALT_ROUNDS,
    );

    // Create clinic staff account linked to patient
    const clinicStaff = this.clientRepository.createUser({
      username: dto.username || dto.email.split('@')[0],
      email: dto.email,
      password: hashedPassword,
      parentId: patientId,
      role: UserRole.CLINIC_STAFF,
      status: UserStatus.ACTIVE, // Clinic staff is auto-activated
      isEmailVerified: true, // Auto-verified since created by authenticated user
    });

    const savedStaff = await this.clientRepository.saveUser(clinicStaff);

    // Create GeneralAccount for clinic staff
    let generalAccount: GeneralAccount | null = null;
    const fullName =
      dto.fullName || [dto.firstName, dto.lastName].filter(Boolean).join(' ');
    if (fullName) {
      generalAccount = this.clientRepository.createGeneralAccount({
        generalAccId: savedStaff.id,
        fullName: fullName,
      });
      await this.clientRepository.saveGeneralAccount(generalAccount);
    }

    return new ClientResponseDto(savedStaff, generalAccount);
  }

  /**
   * Get username and email list
   *
   * @returns List of username and email
   */
  async getUserEmailList(): Promise<UsernameEmailListDto> {
    const users = await this.clientRepository.findAllUsers();

    return {
      username: users.map((u) => u.username).filter((name) => !!name),
      email: users.map((u) => u.email),
    };
  }
}
