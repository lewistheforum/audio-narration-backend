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
import { Repository, In, IsNull } from 'typeorm';
import { User, UserRole, UserStatus } from './entities/user.entity';
import {
  CreateUserDto,
  UpdatePasswordDto,
  UpdateUserDto,
  UserResponseDto,
  BanUserDto,
} from './dto';
import { MESSAGES } from 'src/common/message';
import * as bcrypt from 'bcrypt';
import { ProfileService } from '../profile/profile.service';

/**
 * User Service
 * 
 * Handles all business logic for user management including:
 * - User CRUD operations
 * - Patient and clinic staff registration
 * - OAuth user creation
 * - Password management
 * - Email uniqueness validation
 * - Soft delete and account restoration
 * - Ban/unban user accounts
 * - User status management
 */
@Injectable()
export class UserService {
  private readonly BCRYPT_SALT_ROUNDS = 10;
  private readonly VERIFICATION_CODE_EXPIRY_MINUTES = 15;

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @Inject(forwardRef(() => ProfileService))
    private profileService?: any, // ProfileService injected for automatic profile creation
  ) {}

  /**
   * Get All Users
   * 
   * Retrieves all users (excluding soft-deleted) with their patient owner relationship loaded
   * 
   * @param includeDeleted - Whether to include soft-deleted users (default: false)
   * @returns Array of user DTOs with sensitive data excluded
   */
  async findAll(includeDeleted: boolean = false): Promise<UserResponseDto[]> {
    const users = await this.userRepository.find({ 
      relations: ['patientOwner'],
      withDeleted: includeDeleted,
    });
    return users.map((user) => new UserResponseDto(user));
  }

  /**
   * Find User Entity by ID
   * 
   * Internal method to retrieve full user entity with relations
   * Used by service methods that need to manipulate user data
   * 
   * @param id - User UUID
   * @returns User entity with patientOwner relation loaded
   * @throws NotFoundException if user doesn't exist
   */
  public async findUserEntityById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ 
      where: { id }, 
      relations: ['patientOwner'] 
    });
    if (!user) {
      throw new NotFoundException(MESSAGES.failMessage.userNotFound);
    }
    return user;
  }

  /**
   * Find User by ID
   * 
   * Public method to retrieve user data as DTO
   * 
   * @param id - User UUID
   * @returns User DTO with sensitive data excluded
   */
  async findOne(id: string): Promise<UserResponseDto> {
    const user = await this.findUserEntityById(id);
    return new UserResponseDto(user);
  }

  /**
   * Create User (Legacy Method)
   * 
   * Defaults to patient registration for backward compatibility
   * 
   * @deprecated Use createPatient() instead for clarity
   * @param createUserDto - User registration data
   * @returns Created user DTO and verification code
   */
  async create(createUserDto: CreateUserDto): Promise<{ user: UserResponseDto; verificationCode: string }> {
    return this.createPatient(createUserDto);
  }

  /**
   * Create Patient Account
   * 
   * Registers a new patient with standard authentication
   * 
   * Business Rules:
   * - Role is automatically set to PATIENT
   * - Status is set to PENDING_VERIFICATION (will change to ACTIVE after email verification)
   * - Email must be unique across all users
   * - Password is hashed with bcrypt before storage
   * - Email verification code is generated but NOT sent here
   *   (Controller/Auth service should send the email)
   * 
   * @param createUserDto - Patient registration data
   * @returns Created patient user DTO and verification code
   * @throws ConflictException if email already exists
   */
  async createPatient(createUserDto: CreateUserDto): Promise<{ user: UserResponseDto; verificationCode: string }> {
    const existingUser = await this.findByEmail(createUserDto.email);
    if (existingUser) {
      throw new ConflictException(MESSAGES.failMessage.userEmailAlreadyExists);
    }

    const hashedPassword = await bcrypt.hash(
      createUserDto.password, 
      this.BCRYPT_SALT_ROUNDS
    );

    const user = this.userRepository.create({
      email: createUserDto.email,
      password: hashedPassword,
      firstName: createUserDto.firstName,
      lastName: createUserDto.lastName,
      role: UserRole.PATIENT,
      status: UserStatus.PENDING_VERIFICATION,
    });

    const savedUser = await this.userRepository.save(user);
    
    // Generate verification code
    const verificationCode = await this.generateAndSaveVerificationCode(savedUser);
    
    // Create empty profile for the new user
    if (this.profileService) {
      try {
        await this.profileService.createEmptyProfile(savedUser.id);
      } catch (error) {
        // Profile creation is non-critical, log and continue
        console.error('Failed to create profile for user:', error);
      }
    }
    
    return { 
      user: new UserResponseDto(savedUser),
      verificationCode 
    };
  }

  /**
   * Create Clinic Staff Account
   * 
   * Registers a clinic staff account linked to an existing patient
   * 
   * Business Rules:
   * - Must be linked to a valid PATIENT account via patientOwnerId
   * - Email must be unique across all users
   * - Role is automatically set to CLINIC_STAFF
   * - TODO: Validate patient has purchased clinic service subscription
   * 
   * @param patientId - UUID of the patient who owns this clinic staff account
   * @param dto - Clinic staff registration data
   * @returns Created clinic staff user DTO
   * @throws ConflictException if email exists or patientId is not a PATIENT
   */
  async createClinicStaff(
    patientId: string, 
    dto: { email: string; password: string; firstName?: string; lastName?: string }
  ): Promise<UserResponseDto> {
    const patient = await this.findUserEntityById(patientId);
    
    if (patient.role !== UserRole.PATIENT) {
      throw new ConflictException(MESSAGES.failMessage.invalidPatientId);
    }

    // TODO: Validate patient has purchased clinic service subscription

    const existingUser = await this.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException(MESSAGES.failMessage.userEmailAlreadyExists);
    }

    const hashedPassword = await bcrypt.hash(dto.password, this.BCRYPT_SALT_ROUNDS);

    const staff = this.userRepository.create({
      email: dto.email,
      password: hashedPassword,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: UserRole.CLINIC_STAFF,
      patientOwner: patient,
    });

    const savedStaff = await this.userRepository.save(staff);
    
    // Create empty profile for the new clinic staff
    if (this.profileService) {
      try {
        await this.profileService.createEmptyProfile(savedStaff.id);
      } catch (error) {
        // Profile creation is non-critical, log and continue
        console.error('Failed to create profile for clinic staff:', error);
      }
    }
    
    return new UserResponseDto(savedStaff);
  }

  /**
   * Create Patient via OAuth
   * 
   * Creates a patient account using OAuth provider (currently Google only)
   * 
   * OAuth-Specific Behavior:
   * - Role is automatically set to PATIENT (business rule)
   * - Status is set to ACTIVE (OAuth providers handle email verification)
   * - googleId is stored for future authentication
   * - isOAuthUser flag is set to true
   * - isEmailVerified is set to true (OAuth provider handles verification)
   * - profilePicture from OAuth provider is stored
   * - Password is a hashed random value (not used for OAuth login)
   * 
   * @param dto - OAuth user data from provider
   * @returns Created OAuth user DTO
   * @throws ConflictException if email already exists
   */
  async createPatientViaOAuth(dto: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    googleId: string;
    profilePicture?: string;
  }): Promise<UserResponseDto> {
    const existingUser = await this.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException(MESSAGES.failMessage.userEmailAlreadyExists);
    }

    const hashedPassword = await bcrypt.hash(dto.password, this.BCRYPT_SALT_ROUNDS);

    const user = this.userRepository.create({
      email: dto.email,
      password: hashedPassword,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: UserRole.PATIENT,
      status: UserStatus.ACTIVE,
      googleId: dto.googleId,
      isOAuthUser: true,
      isEmailVerified: true,
      profilePicture: dto.profilePicture,
    });

    const savedUser = await this.userRepository.save(user);
    
    // Create profile with Google profile picture for OAuth user
    if (this.profileService) {
      try {
        await this.profileService.createEmptyProfile(savedUser.id, dto.profilePicture);
      } catch (error) {
        // Profile creation is non-critical, log and continue
        console.error('Failed to create profile for OAuth user:', error);
      }
    }
    
    return new UserResponseDto(savedUser);
  }

  /**
   * Update User Entity
   * 
   * Internal method to save user entity changes
   * Used for updating OAuth fields or other direct entity manipulations
   * 
   * @param user - User entity with changes to persist
   * @returns Updated user entity
   */
  async updateUserEntity(user: User): Promise<User> {
    return this.userRepository.save(user);
  }

  /**
   * Update User Profile
   * 
   * Updates user information with validation
   * 
   * Business Rules:
   * - Email must remain unique if changed
   * - If email changes, isEmailVerified is set to false and new verification code is generated
   * - Role changes are allowed but require validation
   * - CLINIC_STAFF role requires patientOwnerId
   * - Changing from CLINIC_STAFF removes patientOwner relation
   * 
   * @param id - User UUID
   * @param updateUserDto - Updated user data
   * @returns Updated user DTO and verification code if email changed
   * @throws ConflictException if email conflict or invalid role change
   */
  async update(
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<{ user: UserResponseDto; verificationCode?: string; emailChanged?: boolean }> {
    const user = await this.findUserEntityById(id);
    let verificationCode: string | undefined;
    let emailChanged = false;

    // Validate email uniqueness if changed
    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUserWithEmail = await this.findByEmail(updateUserDto.email);
      if (existingUserWithEmail && existingUserWithEmail.id !== id) {
        throw new ConflictException(MESSAGES.failMessage.emailAlreadyExists);
      }
      
      // Email changed - set isEmailVerified to false and generate new code
      user.email = updateUserDto.email;
      user.isEmailVerified = false;
      emailChanged = true;
      
      // Generate new verification code
      verificationCode = await this.generateAndSaveVerificationCode(user);
    }

    // Handle role updates
    if (updateUserDto.role) {
      user.role = updateUserDto.role;
    }

    // Validate CLINIC_STAFF role requirements
    if (updateUserDto.role === UserRole.CLINIC_STAFF) {
      if (updateUserDto.patientOwnerId) {
        const patientOwner = await this.findUserEntityById(updateUserDto.patientOwnerId);
        if (patientOwner.role !== UserRole.PATIENT) {
          throw new ConflictException(MESSAGES.failMessage.patientOwnerMustBePatient);
        }
        user.patientOwner = patientOwner;
      } else if (!user.patientOwner) {
        throw new ConflictException(MESSAGES.failMessage.patientOwnerRequired);
      }
    } else if (updateUserDto.role) {
      // Remove patientOwner if changing away from CLINIC_STAFF
      user.patientOwner = null;
    }

    // Update basic fields
    if (updateUserDto.firstName !== undefined) {
      user.firstName = updateUserDto.firstName;
    }
    if (updateUserDto.lastName !== undefined) {
      user.lastName = updateUserDto.lastName;
    }

    const updatedUser = await this.userRepository.save(user);
    return { 
      user: new UserResponseDto(updatedUser),
      verificationCode,
      emailChanged
    };
  }

  /**
   * Update User Password
   * 
   * Changes user password after verifying old password
   * 
   * Security Rules:
   * - Old password must match current password
   * - New password cannot be the same as old password
   * - Password is hashed before storage
   * 
   * @param userId - User UUID
   * @param updatePasswordDto - Old and new password data
   * @throws UnauthorizedException if old password is incorrect
   * @throws ConflictException if new password matches old password
   */
  async updatePassword(
    userId: string,
    updatePasswordDto: UpdatePasswordDto,
  ): Promise<void> {
    const { oldPassword, newPassword } = updatePasswordDto;
    const user = await this.findUserEntityById(userId);

    const isPasswordMatching = await bcrypt.compare(oldPassword, user.password);
    if (!isPasswordMatching) {
      throw new UnauthorizedException(MESSAGES.failMessage.incorrectPassword);
    }

    if (oldPassword === newPassword) {
      throw new ConflictException(MESSAGES.failMessage.newPasswordSameAsOld);
    }

    user.password = await bcrypt.hash(newPassword, this.BCRYPT_SALT_ROUNDS);
    await this.userRepository.save(user);
  }

  /**
   * Delete User
   * 
   * Soft deletes a user from the system (sets deletedAt timestamp)
   * Data is retained for audit trails and potential recovery
   * 
   * @param id - User UUID to delete
   * @throws NotFoundException if user doesn't exist
   */
  async delete(id: string): Promise<void> {
    const user = await this.findUserEntityById(id);
    await this.userRepository.softDelete(id);
  }

  /**
   * Restore Soft-Deleted User
   * 
   * Restores a previously soft-deleted user account
   * 
   * @param id - User UUID to restore
   * @throws NotFoundException if user doesn't exist or wasn't deleted
   */
  async restore(id: string): Promise<UserResponseDto> {
    // Check if user exists in soft-deleted state
    const user = await this.userRepository.findOne({
      where: { id },
      withDeleted: true,
    });

    if (!user) {
      throw new NotFoundException(MESSAGES.failMessage.userNotFound);
    }

    if (!user.deletedAt) {
      throw new BadRequestException(MESSAGES.failMessage.userNotDeleted);
    }

    await this.userRepository.restore(id);
    
    const restoredUser = await this.findUserEntityById(id);
    return new UserResponseDto(restoredUser);
  }

  /**
   * Permanently Delete User
   * 
   * Permanently removes user from database (hard delete)
   * This action cannot be undone
   * 
   * @param id - User UUID to permanently delete
   * @throws NotFoundException if user doesn't exist
   */
  async permanentDelete(id: string): Promise<void> {
    const result = await this.userRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(MESSAGES.failMessage.userNotFound);
    }
  }

  /**
   * Ban User Account
   * 
   * Bans a user account, preventing login and access to system
   * 
   * Business Rules:
   * - Cannot ban admin users
   * - Cannot ban already banned users
   * - Stores ban reason, timestamp, and admin who performed the ban
   * - Sets status to BANNED
   * 
   * @param userId - User ID to ban
   * @param banDto - Ban reason
   * @param adminId - Admin ID performing the ban
   * @throws NotFoundException if user doesn't exist
   * @throws ForbiddenException if trying to ban admin
   * @throws ConflictException if user already banned
   */
  async banUser(userId: string, banDto: BanUserDto, adminId: string): Promise<UserResponseDto> {
    const user = await this.findUserEntityById(userId);

    // Cannot ban admin users
    if (user.role === UserRole.ADMIN) {
      throw new ForbiddenException(MESSAGES.failMessage.cannotBanAdmin);
    }

    // Cannot ban self
    if (userId === adminId) {
      throw new ForbiddenException(MESSAGES.failMessage.cannotBanSelf);
    }

    // Check if already banned
    if (user.status === UserStatus.BANNED) {
      throw new ConflictException(MESSAGES.failMessage.userAlreadyBanned);
    }

    user.status = UserStatus.BANNED;
    user.banReason = banDto.reason;
    user.bannedAt = new Date();
    user.bannedBy = adminId;

    const bannedUser = await this.userRepository.save(user);
    return new UserResponseDto(bannedUser);
  }

  /**
   * Unban User Account
   * 
   * Removes ban from user account, allowing access again
   * Sets status back to ACTIVE
   * 
   * @param userId - User ID to unban
   * @throws NotFoundException if user doesn't exist
   * @throws BadRequestException if user is not banned
   */
  async unbanUser(userId: string): Promise<UserResponseDto> {
    const user = await this.findUserEntityById(userId);

    if (user.status !== UserStatus.BANNED) {
      throw new BadRequestException(MESSAGES.failMessage.userNotBanned);
    }

    user.status = UserStatus.ACTIVE;
    user.banReason = null;
    user.bannedAt = null;
    user.bannedBy = null;

    const unbannedUser = await this.userRepository.save(user);
    return new UserResponseDto(unbannedUser);
  }

  /**
   * Check User Status and Access
   * 
   * Validates if user can access the system based on status
   * Called during authentication to prevent banned/inactive users from logging in
   * 
   * @param user - User entity
   * @throws ForbiddenException if user is banned or inactive
   */
  validateUserAccess(user: User): void {
    if (user.status === UserStatus.BANNED) {
      throw new ForbiddenException(MESSAGES.failMessage.userAccountBanned);
    }

    if (user.status === UserStatus.INACTIVE) {
      throw new ForbiddenException(MESSAGES.failMessage.userAccountInactive);
    }
  }

  /**
   * Find User by Email
   * 
   * Used for authentication and duplicate email validation
   * 
   * @param email - User email address
   * @returns User entity with patientOwner relation, or null if not found
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ 
      where: { email }, 
      relations: ['patientOwner'] 
    });
  }

  /**
   * Find Multiple Users by IDs
   * 
   * Batch retrieval for conversation participants or other multi-user queries
   * 
   * @param ids - Array of user UUIDs
   * @returns Array of user entities (empty array if no IDs provided)
   */
  async findUsersByIds(ids: string[]): Promise<User[]> {
    if (!ids || ids.length === 0) {
      return [];
    }
    return this.userRepository.find({
      where: { id: In(ids) },
    });
  }

  /**
   * Generate 6-digit Verification Code
   * 
   * Generates a random 6-digit numeric code
   * 
   * @returns 6-digit string code
   */
  private generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Generate and Save Verification Code
   * 
   * Generates a verification code and saves it to user entity
   * Sets expiration time to 15 minutes from now
   * 
   * @param user - User entity
   * @returns Generated verification code
   */
  async generateAndSaveVerificationCode(user: User): Promise<string> {
    const code = this.generateVerificationCode();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + this.VERIFICATION_CODE_EXPIRY_MINUTES);

    user.emailVerificationCode = code;
    user.emailVerificationExpires = expiresAt;

    await this.userRepository.save(user);
    return code;
  }

  /**
   * Verify Email Code
   * 
   * Verifies the 6-digit code and marks email as verified
   * Sets user status to ACTIVE upon successful verification
   * 
   * @param email - User email
   * @param code - 6-digit verification code
   * @throws NotFoundException if user not found
   * @throws UnauthorizedException if code is invalid or expired
   */
  async verifyEmailCode(email: string, code: string): Promise<User> {
    const user = await this.findByEmail(email);
    
    if (!user) {
      throw new NotFoundException(MESSAGES.failMessage.userNotFound);
    }

    if (user.isEmailVerified) {
      throw new ConflictException(MESSAGES.failMessage.emailAlreadyVerified);
    }

    if (!user.emailVerificationCode || !user.emailVerificationExpires) {
      throw new UnauthorizedException(MESSAGES.failMessage.noVerificationCodeFound);
    }

    if (user.emailVerificationCode !== code) {
      throw new UnauthorizedException(MESSAGES.failMessage.invalidVerificationCode);
    }

    if (new Date() > user.emailVerificationExpires) {
      throw new UnauthorizedException(MESSAGES.failMessage.verificationCodeExpired);
    }

    // Mark email as verified, clear verification fields, and activate account
    user.isEmailVerified = true;
    user.emailVerificationCode = null;
    user.emailVerificationExpires = null;
    
    // Set status to ACTIVE if currently PENDING_VERIFICATION
    if (user.status === UserStatus.PENDING_VERIFICATION) {
      user.status = UserStatus.ACTIVE;
    }

    await this.userRepository.save(user);
    return user;
  }

  /**
   * Resend Verification Code
   * 
   * Generates a new verification code for user
   * 
   * @param email - User email
   * @returns New verification code
   * @throws NotFoundException if user not found
   * @throws ConflictException if email already verified
   */
  async resendVerificationCode(email: string): Promise<{ code: string; user: User }> {
    const user = await this.findByEmail(email);
    
    if (!user) {
      throw new NotFoundException(MESSAGES.failMessage.userNotFound);
    }

    if (user.isEmailVerified) {
      throw new ConflictException(MESSAGES.failMessage.emailAlreadyVerified);
    }

    const code = await this.generateAndSaveVerificationCode(user);
    return { code, user };
  }

  /**
   * Initiate Password Reset
   * 
   * Generates a reset code and saves it to user record
   * Similar to email verification but for password reset
   * 
   * @param email - User email
   * @returns Reset code and user object
   * @throws NotFoundException if user not found
   * @throws BadRequestException if user is OAuth user (no password)
   */
  async initiatePasswordReset(email: string): Promise<{ code: string; user: User }> {
    const user = await this.findByEmail(email);
    
    if (!user) {
      throw new NotFoundException(MESSAGES.failMessage.userNotFound);
    }

    // OAuth users don't have passwords
    if (user.isOAuthUser) {
      throw new BadRequestException(MESSAGES.failMessage.passwordResetNotAvailableForOAuth);
    }

    // Generate 6-digit reset code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiryDate = new Date();
    expiryDate.setMinutes(expiryDate.getMinutes() + this.VERIFICATION_CODE_EXPIRY_MINUTES);

    user.emailVerificationCode = resetCode; // Reuse verification code field
    user.emailVerificationExpires = expiryDate;

    await this.userRepository.save(user);
    return { code: resetCode, user };
  }

  /**
   * Reset Password with Code
   * 
   * Validates reset code and updates user password
   * 
   * @param email - User email
   * @param code - 6-digit reset code
   * @param newPassword - New password (already validated by DTO)
   * @throws NotFoundException if user not found
   * @throws UnauthorizedException if code is invalid or expired
   * @throws BadRequestException if user is OAuth user
   */
  async resetPasswordWithCode(email: string, code: string, newPassword: string): Promise<User> {
    const user = await this.findByEmail(email);
    
    if (!user) {
      throw new NotFoundException(MESSAGES.failMessage.userNotFound);
    }

    // OAuth users don't have passwords
    if (user.isOAuthUser) {
      throw new BadRequestException(MESSAGES.failMessage.passwordResetNotAvailableForOAuth);
    }

    if (!user.emailVerificationCode || !user.emailVerificationExpires) {
      throw new UnauthorizedException(MESSAGES.failMessage.noResetCodeFound);
    }

    if (user.emailVerificationCode !== code) {
      throw new UnauthorizedException(MESSAGES.failMessage.invalidResetCode);
    }

    if (new Date() > user.emailVerificationExpires) {
      throw new UnauthorizedException(MESSAGES.failMessage.resetCodeExpired);
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, this.BCRYPT_SALT_ROUNDS);
    user.password = hashedPassword;
    
    // Clear reset code fields
    user.emailVerificationCode = null;
    user.emailVerificationExpires = null;

    await this.userRepository.save(user);
    return user;
  }
}

