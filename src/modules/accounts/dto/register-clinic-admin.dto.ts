import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsNotEmpty,
  IsOptional,
  IsArray,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

/**
 * Register Clinic Admin DTO
 *
 * Used for initial clinic admin registration with account + profile + subscription.
 * Creates Account, ClinicAdminInformation, and ClinicSubscription in one transaction.
 *
 * Password Requirements:
 * - Minimum 6 characters
 * - Maximum 50 characters
 * - Must contain at least one letter
 * - Must contain at least one number
 */
export class RegisterClinicAdminDto {
  @ApiProperty({
    description: 'Clinic admin username',
    example: 'clinicadmin',
  })
  @IsNotEmpty({ message: 'Username is required' })
  @IsString({ message: 'Username must be a string' })
  @MinLength(3, { message: 'Username must be at least 3 characters' })
  @MaxLength(100, { message: 'Username must not exceed 100 characters' })
  @Transform(({ value }) => value?.trim())
  username: string;

  @ApiProperty({
    description: 'Clinic admin email address',
    example: 'admin@clinic.com',
  })
  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Invalid email format' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @ApiProperty({
    description: 'Clinic admin phone number',
    example: '+84123456789',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Phone must be a string' })
  @MaxLength(20, { message: 'Phone must not exceed 20 characters' })
  phone?: string;

  @ApiProperty({
    description: 'Clinic admin password (min 6 characters, must contain letter and number)',
    example: 'AdminPass123',
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

  // ClinicAdminInformation fields

  @ApiProperty({
    description: 'Name of clinic',
    example: 'City Medical Center',
    required: true,
    maxLength: 255,
  })
  @IsNotEmpty({ message: 'Clinic name is required' })
  @IsString({ message: 'Clinic name must be a string' })
  @MaxLength(500, { message: 'Clinic name must not exceed 500 characters' })
  @Transform(({ value }) => value?.trim())
  clinicName: string;

  @ApiProperty({
    description: 'Description of clinic',
    example: 'A modern healthcare facility providing comprehensive medical services',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  @MaxLength(2000, { message: 'Description must not exceed 2000 characters' })
  description?: string;

  @ApiProperty({
    description: 'Medical specializations offered by clinic',
    example: ['Cardiology', 'Neurology'],
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'SpecializedIn must be an array' })
  @IsString({ each: true, message: 'Each specialization must be a string' })
  specializedIn?: string[];

  @ApiProperty({
    description: 'Advantages or strengths of clinic',
    example: ['24/7 Emergency Care', 'Modern Equipment', 'Experienced Staff'],
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'Pros must be an array' })
  @IsString({ each: true, message: 'Each pro must be a string' })
  pros?: string[];

  @ApiProperty({
    description: 'Paraclinical services available at clinic',
    example: ['X-Ray', 'MRI', 'CT Scan', 'Laboratory'],
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'Paraclinical must be an array' })
  @IsString({ each: true, message: 'Each paraclinical service must be a string' })
  paraclinical?: string[];

  @ApiProperty({
    description: 'Clinic admin date of birth (ISO date string)',
    example: '1980-01-15',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Date of birth must be a string' })
  dob?: string;

  @ApiProperty({
    description: 'Profile picture URL',
    example: 'https://example.com/avatar.jpg',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Profile picture must be a string' })
  profilePicture?: string;

  // Subscription fields

  @ApiProperty({
    description: 'ID of the subscription service selected',
    example: '550e8400-e29b-41d4-a716-4466554400000',
  })
  @IsNotEmpty({ message: 'Service ID is required' })
  @IsString({ message: 'Service ID must be a string' })
  serviceId: string;
}
