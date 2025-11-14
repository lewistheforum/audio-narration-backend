import { ApiProperty } from '@nestjs/swagger';
import { User, UserRole } from '../entities/user.entity';

/**
 * User Response DTO
 * 
 * Sanitized user data returned to clients
 * Excludes sensitive fields like password, verification tokens, etc.
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
    description: 'User display name',
    example: 'John Doe',
    required: false,
    nullable: true,
  })
  name: string;

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
    description: 'User role defining access permissions',
    enum: UserRole,
    example: UserRole.PATIENT,
  })
  role: UserRole;

  @ApiProperty({
    description:
      'ID of the patient who owns this clinic staff account (null for non-staff users)',
    required: false,
    nullable: true,
  })
  patientOwnerId?: string;

  constructor(user: Partial<User>) {
    this.id = user.id;
    this.email = user.email;
    this.name = user.name;
    this.createdAt = user.createdAt;
    this.updatedAt = user.updatedAt;
    this.role = user.role;
    this.patientOwnerId = user.patientOwner?.id;
  }
}