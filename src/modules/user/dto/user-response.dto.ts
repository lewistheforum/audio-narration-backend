import { ApiProperty } from '@nestjs/swagger';
import { User, UserRole, UserStatus } from '../entities/user.entity';

/**
 * User Response DTO
 * 
 * Sanitized user data returned to clients
 * Excludes sensitive fields like password, verification codes, etc.
 * 
 * Usage:
 * - API responses for user queries
 * - User profile information
 * - Authentication responses
 */
export class UserResponseDto {
  @ApiProperty({
    description: 'Unique user identifier',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  id: string;

  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'User first name',
    example: 'John',
    required: false,
    nullable: true,
  })
  firstName: string;

  @ApiProperty({
    description: 'User last name',
    example: 'Doe',
    required: false,
    nullable: true,
  })
  lastName: string;

  @ApiProperty({
    description: 'User role defining access permissions',
    enum: UserRole,
    example: UserRole.PATIENT,
  })
  role: UserRole;

  @ApiProperty({
    description: 'Account status',
    enum: UserStatus,
    example: UserStatus.ACTIVE,
  })
  status: UserStatus;

  @ApiProperty({
    description: 'Ban reason (only if status is BANNED)',
    example: 'Violated terms of service',
    required: false,
    nullable: true,
  })
  banReason?: string;

  @ApiProperty({
    description: 'When account was banned',
    example: '2023-10-27T10:00:00.000Z',
    required: false,
    nullable: true,
  })
  bannedAt?: Date;

  @ApiProperty({
    description: 'Whether email has been verified',
    example: true,
  })
  isEmailVerified: boolean;

  @ApiProperty({
    description: 'Whether user registered via OAuth (Google)',
    example: false,
  })
  isOAuthUser: boolean;

  @ApiProperty({
    description: 'Google user ID (null if not OAuth user)',
    example: '1234567890',
    required: false,
    nullable: true,
  })
  googleId?: string;

  @ApiProperty({
    description: 'Profile picture URL',
    example: 'https://example.com/avatar.jpg',
    required: false,
    nullable: true,
  })
  profilePicture?: string;

  @ApiProperty({
    description: 'ID of the patient who owns this clinic staff account (null for non-staff users)',
    required: false,
    nullable: true,
  })
  patientOwnerId?: string;

  @ApiProperty({
    description: 'Account creation timestamp',
    example: '2023-10-27T10:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2023-10-27T10:00:00.000Z',
  })
  updatedAt: Date;

  @ApiProperty({
    description: 'Soft delete timestamp (null if not deleted)',
    example: '2023-10-27T10:00:00.000Z',
    required: false,
    nullable: true,
  })
  deletedAt?: Date;

  constructor(user: Partial<User>) {
    this.id = user.id;
    this.email = user.email;
    this.firstName = user.firstName;
    this.lastName = user.lastName;
    this.role = user.role;
    this.status = user.status ?? UserStatus.PENDING_VERIFICATION;
    this.banReason = user.banReason;
    this.bannedAt = user.bannedAt;
    this.isEmailVerified = user.isEmailVerified ?? false;
    this.isOAuthUser = user.isOAuthUser ?? false;
    this.googleId = user.googleId;
    this.profilePicture = user.profilePicture;
    this.patientOwnerId = user.patientOwner?.id;
    this.createdAt = user.createdAt;
    this.updatedAt = user.updatedAt;
    this.deletedAt = user.deletedAt;
  }
}
