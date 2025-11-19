import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Profile } from './entities/profile.entity';
import { CreateProfileDto, UpdateProfileDto, ProfileResponseDto } from './dto';
import { MESSAGES } from 'src/common/message';
import { UserRole } from '../user/entities/user.entity';

/**
 * Profile Service
 * 
 * Handles all business logic for profile management including:
 * - Profile CRUD operations
 * - Profile completion tracking
 * - Access control (users can only manage their own profile)
 * - Automatic profile creation on user registration
 */
@Injectable()
export class ProfileService {
  constructor(
    @InjectRepository(Profile)
    private profileRepository: Repository<Profile>,
  ) {}

  /**
   * Create Profile
   * 
   * Creates a new profile for a user
   * Typically called automatically when user registers
   * 
   * Business Rules:
   * - One profile per user
   * - Profile is automatically created with minimal information
   * - Users can update profile later with complete information
   * 
   * @param userId - User UUID
   * @param createProfileDto - Profile data
   * @returns Created profile DTO
   * @throws ConflictException if profile already exists
   */
  async create(userId: string, createProfileDto: CreateProfileDto): Promise<ProfileResponseDto> {
    const existingProfile = await this.profileRepository.findOne({ where: { userId } });
    if (existingProfile) {
      throw new ConflictException(MESSAGES.failMessage.profileAlreadyExists);
    }

    // Convert date string to Date object if provided
    const profileData: any = { ...createProfileDto };
    if (profileData.dateOfBirth) {
      profileData.dateOfBirth = new Date(profileData.dateOfBirth);
    }

    const profile = this.profileRepository.create({
      userId,
      ...profileData,
      isProfileComplete: this.checkProfileCompletion(profileData),
    });

    const savedProfile = await this.profileRepository.save(profile) as unknown as Profile;
    return new ProfileResponseDto(savedProfile as Profile);
  }

  /**
   * Get Profile by User ID
   * 
   * Retrieves user's profile
   * 
   * @param userId - User UUID
   * @returns Profile DTO
   * @throws NotFoundException if profile doesn't exist
   */
  async findByUserId(userId: string): Promise<ProfileResponseDto> {
    const profile = await this.profileRepository.findOne({ where: { userId } });
    
    if (!profile) {
      throw new NotFoundException(MESSAGES.failMessage.profileNotFound);
    }

    return new ProfileResponseDto(profile);
  }

  /**
   * Get Profile Entity by User ID
   * 
   * Internal method to get profile entity
   * 
   * @param userId - User UUID
   * @returns Profile entity
   * @throws NotFoundException if profile doesn't exist
   */
  async findProfileEntityByUserId(userId: string): Promise<Profile> {
    const profile = await this.profileRepository.findOne({ where: { userId } });
    
    if (!profile) {
      throw new NotFoundException(MESSAGES.failMessage.profileNotFound);
    }

    return profile;
  }

  /**
   * Update Profile
   * 
   * Updates user's profile information
   * 
   * Business Rules:
   * - Users can only update their own profile
   * - Admins can update any profile
   * - Profile completion status is automatically recalculated
   * 
   * @param userId - User UUID
   * @param updateProfileDto - Updated profile data
   * @param requestUserId - ID of user making the request
   * @param requestUserRole - Role of user making the request
   * @returns Updated profile DTO
   * @throws NotFoundException if profile doesn't exist
   * @throws ForbiddenException if user tries to update another user's profile
   */
  async update(
    userId: string,
    updateProfileDto: UpdateProfileDto,
    requestUserId: string,
    requestUserRole: UserRole,
  ): Promise<ProfileResponseDto> {
    // Check authorization: user can only update own profile unless admin
    if (userId !== requestUserId && requestUserRole !== UserRole.ADMIN) {
      throw new ForbiddenException(MESSAGES.failMessage.cannotUpdateOtherProfile);
    }

    const profile = await this.findProfileEntityByUserId(userId);

    // Convert date string to Date object if provided
    const updateData: any = { ...updateProfileDto };
    if (updateData.dateOfBirth) {
      updateData.dateOfBirth = new Date(updateData.dateOfBirth);
    }

    // Update fields
    Object.assign(profile, updateData);

    // Recalculate profile completion
    profile.isProfileComplete = this.checkProfileCompletion(profile);

    const updatedProfile = await this.profileRepository.save(profile);
    return new ProfileResponseDto(updatedProfile);
  }

  /**
   * Delete Profile
   * 
   * Deletes user's profile
   * Only admin can delete profiles
   * Typically cascades when user is deleted
   * 
   * @param userId - User UUID
   * @throws NotFoundException if profile doesn't exist
   */
  async delete(userId: string): Promise<void> {
    const result = await this.profileRepository.delete({ userId });
    
    if (result.affected === 0) {
      throw new NotFoundException(MESSAGES.failMessage.profileNotFound);
    }
  }

  /**
   * Check Profile Completion
   * 
   * Determines if profile has minimum required information
   * 
   * Required fields:
   * - Phone number
   * - Date of birth
   * - Gender
   * - Address
   * - Emergency contact
   * 
   * @param profileData - Profile data to check
   * @returns true if profile is complete, false otherwise
   */
  private checkProfileCompletion(profileData: Partial<Profile>): boolean {
    const requiredFields = [
      'phoneNumber',
      'dateOfBirth',
      'gender',
      'address',
      'emergencyContactName',
      'emergencyContactPhone',
    ];

    return requiredFields.every((field) => {
      const value = profileData[field];
      return value != null && value !== '';
    });
  }

  /**
   * Create Empty Profile
   * 
   * Creates a minimal profile for a new user
   * Called automatically during user registration
   * 
   * @param userId - User UUID
   * @param avatar - Optional avatar URL (e.g., from OAuth provider)
   * @returns Created profile DTO
   */
  async createEmptyProfile(userId: string, avatar?: string): Promise<ProfileResponseDto> {
    const profile = this.profileRepository.create({
      userId,
      avatar,
      isProfileComplete: false,
    });

    const savedProfile = await this.profileRepository.save(profile);
    return new ProfileResponseDto(savedProfile);
  }
}
