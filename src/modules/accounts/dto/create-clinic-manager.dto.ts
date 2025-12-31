import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsNotEmpty,
  Matches,
  IsDateString,
  IsUrl,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

/**
 * Create Clinic Manager DTO
 *
 * Used for clinic manager registration (clinic owner)
 * Clinic manager has the following permissions:
 * - Add CLINIC_STAFF accounts
 * - Add DOCTOR accounts
 * - Update clinic legal documents
 * - Update Google iframe information
 * - Update doctor documents
 *
 * Password Requirements:
 * - Minimum 6 characters
 * - Maximum 50 characters
 * - Must contain at least one letter
 * - Must contain at least one number
 */
export class CreateClinicManagerDto {
  @ApiProperty({
    description: 'Clinic manager username',
    example: 'clinicmanager123',
  })
  @IsNotEmpty({ message: 'Username is required' })
  @IsString({ message: 'Username must be a string' })
  @MinLength(3, { message: 'Username must be at least 3 characters' })
  @MaxLength(100, { message: 'Username must not exceed 100 characters' })
  @Transform(({ value }) => value?.trim())
  username: string;

  @ApiProperty({
    description: 'Clinic manager email address',
    example: 'manager@clinic.com',
  })
  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Invalid email format' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @ApiProperty({
    description:
      'Clinic manager password (min 6 characters, must contain letter and number)',
    example: 'ManagerPass123',
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
    description: 'Clinic manager phone number',
    example: '+84123456789',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Phone must be a string' })
  @Matches(
    /^[\+]?[(]?[0-9]{1,3}[)]?[-\s\.]?[0-9]{1,4}[-\s\.]?[0-9]{1,4}[-\s\.]?[0-9]{1,9}$/,
    {
      message: 'Invalid phone number format',
    },
  )
  phone?: string;

  // @ApiProperty({
  //   description: 'Clinic manager full name',
  //   example: 'Dr. John Smith',
  //   maxLength: 255,
  // })
  // @IsNotEmpty({ message: 'Full name is required' })
  // @IsString({ message: 'Full name must be a string' })
  // @MaxLength(255, { message: 'Full name must not exceed 255 characters' })
  // @Transform(({ value }) => value?.trim())
  // fullName: string;

  @ApiProperty({
    description: 'Clinic manager role',
    example: 'MANAGER',
    maxLength: 255,
  })
  @IsNotEmpty({ message: 'Role is required' })
  @IsString({ message: 'Role must be a string' })
  @MaxLength(255, { message: 'Role must not exceed 255 characters' })
  @Transform(({ value }) => value?.trim())
  role: string;

  @ApiProperty({
    description: 'Clinic name',
    example: 'City Medical Clinic',
    maxLength: 255,
  })
  @IsNotEmpty({ message: 'Clinic name is required' })
  @IsString({ message: 'Clinic name must be a string' })
  @MaxLength(255, { message: 'Clinic name must not exceed 255 characters' })
  @Transform(({ value }) => value?.trim())
  clinicName: string;

  @ApiProperty({
    description: 'Clinic description',
    example:
      'A modern healthcare facility providing comprehensive medical services',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  @Transform(({ value }) => value?.trim())
  description?: string;

  @ApiProperty({
    description: 'Clinic specializations',
    example: ['Cardiology', 'Neurology', 'Pediatrics'],
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsString({ each: true, message: 'Each specialization must be a string' })
  specializedIn?: string[];

  @ApiProperty({
    description: 'Clinic pros/advantages',
    example: ['Modern equipment', 'Experienced doctors', '24/7 service'],
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsString({ each: true, message: 'Each pro must be a string' })
  pros?: string[];

  @ApiProperty({
    description: 'Paraclinical services offered',
    example: ['X-Ray', 'MRI', 'Blood test', 'Ultrasound'],
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsString({
    each: true,
    message: 'Each paraclinical service must be a string',
  })
  paraclinical?: string[];

  @ApiProperty({
    description: 'Date of birth',
    example: '1990-01-15',
    required: false,
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'Date of birth must be a valid date string (YYYY-MM-DD)' },
  )
  dob?: string;

  @ApiProperty({
    description: 'Profile picture URL',
    example: 'https://example.com/profile/image.jpg',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Profile picture must be a string' })
  @IsUrl({}, { message: 'Profile picture must be a valid URL' })
  profilePicture?: string;
}
