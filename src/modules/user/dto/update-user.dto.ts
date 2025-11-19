import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsEnum,
  ValidateIf,
  IsUUID,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { UserRole } from '../entities/user.entity';

/**
 * Update User DTO
 * 
 * Used for updating user profile information
 * All fields are optional - only provided fields will be updated
 * 
 * Special Rules:
 * - Email is automatically normalized (lowercase, trimmed)
 * - Name is automatically trimmed
 * - If changing role to CLINIC_STAFF, patientOwnerId is required
 * - Password updates should use UpdatePasswordDto instead
 */
export class UpdateUserDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
    required: false,
  })
  @IsOptional()
  @IsEmail({}, { message: 'Invalid email format' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email?: string;

  @ApiProperty({
    description: 'User password (min 6 characters, must contain letter and number)',
    example: 'NewPass123',
    minLength: 6,
    maxLength: 50,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  @MaxLength(50, { message: 'Password must not exceed 50 characters' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)/, {
    message: 'Password must contain at least one letter and one number',
  })
  password?: string;

  @ApiProperty({
    description: 'User first name',
    example: 'Jane',
    required: false,
    maxLength: 50,
  })
  @IsOptional()
  @IsString({ message: 'First name must be a string' })
  @MaxLength(50, { message: 'First name must not exceed 50 characters' })
  @Transform(({ value }) => value?.trim())
  firstName?: string;

  @ApiProperty({
    description: 'User last name',
    example: 'Doe',
    required: false,
    maxLength: 50,
  })
  @IsOptional()
  @IsString({ message: 'Last name must be a string' })
  @MaxLength(50, { message: 'Last name must not exceed 50 characters' })
  @Transform(({ value }) => value?.trim())
  lastName?: string;

  @ApiProperty({
    description: 'User role',
    enum: UserRole,
    required: false,
  })
  @IsOptional()
  @IsEnum(UserRole, { message: 'Invalid role' })
  role?: UserRole;

  @ApiProperty({
    description: 'Patient ID for clinic staff accounts (required if role is CLINIC_STAFF)',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @ValidateIf((o) => o.role === UserRole.CLINIC_STAFF)
  @IsUUID('4', { message: 'Patient owner ID must be a valid UUID' })
  patientOwnerId?: string;
}
