import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsNotEmpty,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

/**
 * Create Clinic Staff DTO
 * 
 * Used for clinic staff registration linked to a patient account
 * Email is automatically normalized (lowercase, trimmed)
 * Name is automatically trimmed
 * 
 * Password Requirements:
 * - Minimum 6 characters
 * - Maximum 50 characters
 * - Must contain at least one letter
 * - Must contain at least one number
 * 
 * Note: Patient ID is provided as URL parameter, not in this DTO
 */
export class CreateClinicStaffDto {
  @ApiProperty({
    description: 'Clinic staff email address',
    example: 'staff@clinic.com',
  })
  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Invalid email format' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @ApiProperty({
    description: 'Clinic staff password (min 6 characters, must contain letter and number)',
    example: 'StaffPass123',
    minLength: 6,
    maxLength: 50,
  })
  @IsNotEmpty({ message: 'Password is required' })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  @MaxLength(50, { message: 'Password must not exceed 50 characters' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)/, {
    message: 'Password must contain at least one letter and one number',
  })
  password: string;

  @ApiProperty({
    description: 'Clinic staff first name',
    example: 'John',
    required: false,
    maxLength: 50,
  })
  @IsOptional()
  @IsString({ message: 'First name must be a string' })
  @MaxLength(50, { message: 'First name must not exceed 50 characters' })
  @Transform(({ value }) => value?.trim())
  firstName?: string;

  @ApiProperty({
    description: 'Clinic staff last name',
    example: 'Smith',
    required: false,
    maxLength: 50,
  })
  @IsOptional()
  @IsString({ message: 'Last name must be a string' })
  @MaxLength(50, { message: 'Last name must not exceed 50 characters' })
  @Transform(({ value }) => value?.trim())
  lastName?: string;
}
