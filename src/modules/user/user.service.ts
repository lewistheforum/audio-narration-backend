import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User, UserRole } from './entities/user.entity';
import {
  CreateUserDto,
  UpdatePasswordDto,
  UpdateUserDto,
  UserResponseDto,
} from './dto';
import { MESSAGES } from 'src/common/message';
import * as bcrypt from 'bcrypt';

/**
 * User Service
 * 
 * Handles all business logic for user management including:
 * - User CRUD operations
 * - Patient and clinic staff registration
 * - OAuth user creation
 * - Password management
 * - Email uniqueness validation
 */
@Injectable()
export class UserService {
  private readonly BCRYPT_SALT_ROUNDS = 10;

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  /**
   * Get All Users
   * 
   * Retrieves all users with their patient owner relationship loaded
   * 
   * @returns Array of user DTOs with sensitive data excluded
   */
  async findAll(): Promise<UserResponseDto[]> {
    const users = await this.userRepository.find({ relations: ['patientOwner'] });
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
   * @returns Created user DTO
   */
  async create(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    return this.createPatient(createUserDto);
  }

  /**
   * Create Patient Account
   * 
   * Registers a new patient with standard authentication
   * 
   * Business Rules:
   * - Role is automatically set to PATIENT
   * - Email must be unique across all users
   * - Password is hashed with bcrypt before storage
   * - Email verification is NOT automatic (unlike OAuth)
   * 
   * @param createUserDto - Patient registration data
   * @returns Created patient user DTO
   * @throws ConflictException if email already exists
   */
  async createPatient(createUserDto: CreateUserDto): Promise<UserResponseDto> {
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
      name: createUserDto.name,
      role: UserRole.PATIENT,
    });

    const savedUser = await this.userRepository.save(user);
    return new UserResponseDto(savedUser);
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
    dto: { email: string; password: string; name?: string }
  ): Promise<UserResponseDto> {
    const patient = await this.findUserEntityById(patientId);
    
    if (patient.role !== UserRole.PATIENT) {
      throw new ConflictException('Provided patientId does not belong to a PATIENT role');
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
      name: dto.name,
      role: UserRole.CLINIC_STAFF,
      patientOwner: patient,
    });

    const savedStaff = await this.userRepository.save(staff);
    return new UserResponseDto(savedStaff);
  }

  /**
   * Create Patient via OAuth
   * 
   * Creates a patient account using OAuth provider (currently Google only)
   * 
   * OAuth-Specific Behavior:
   * - Role is automatically set to PATIENT (business rule)
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
    name: string;
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
      name: dto.name,
      role: UserRole.PATIENT,
      googleId: dto.googleId,
      isOAuthUser: true,
      isEmailVerified: true,
      profilePicture: dto.profilePicture,
    });

    const savedUser = await this.userRepository.save(user);
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
   * - Role changes are allowed but require validation
   * - CLINIC_STAFF role requires patientOwnerId
   * - Changing from CLINIC_STAFF removes patientOwner relation
   * 
   * @param id - User UUID
   * @param updateUserDto - Updated user data
   * @returns Updated user DTO
   * @throws ConflictException if email conflict or invalid role change
   */
  async update(
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    const user = await this.findUserEntityById(id);

    // Validate email uniqueness if changed
    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUserWithEmail = await this.findByEmail(updateUserDto.email);
      if (existingUserWithEmail && existingUserWithEmail.id !== id) {
        throw new ConflictException(MESSAGES.failMessage.emailAlreadyExists);
      }
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
          throw new ConflictException('patientOwnerId must reference a user with role PATIENT');
        }
        user.patientOwner = patientOwner;
      } else if (!user.patientOwner) {
        throw new ConflictException('Clinic staff account must have a patientOwnerId');
      }
    } else if (updateUserDto.role) {
      // Remove patientOwner if changing away from CLINIC_STAFF
      user.patientOwner = null;
    }

    // Update basic fields
    if (updateUserDto.name !== undefined) {
      user.name = updateUserDto.name;
    }
    if (updateUserDto.email !== undefined) {
      user.email = updateUserDto.email;
    }

    const updatedUser = await this.userRepository.save(user);
    return new UserResponseDto(updatedUser);
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
   * Permanently removes user from database
   * 
   * @param id - User UUID to delete
   * @throws NotFoundException if user doesn't exist
   */
  async delete(id: string): Promise<void> {
    const result = await this.userRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(MESSAGES.failMessage.userNotFound);
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
}
