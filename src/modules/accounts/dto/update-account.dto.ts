import {
  IsEmail,
  IsString,
  IsOptional,
  MaxLength,
  IsEnum,
  IsDateString,
  MinLength,
  IsArray,
  IsObject,
  IsNumber,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Gender, AccountRole, ClinicRole } from '../enums';

/**
 * Update Account DTO
 *
 * Used for updating account profile information
 * All fields are optional - only provided fields will be updated
 */
export class UpdateAccountDto {
  @ApiProperty({
    description: 'Client username',
    example: 'johndoe',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Username must be a string' })
  @MinLength(3, { message: 'Username must be at least 3 characters' })
  @MaxLength(100, { message: 'Username must not exceed 100 characters' })
  @Transform(({ value }) => value?.trim())
  username?: string;

  @ApiProperty({
    description: 'Client email address',
    example: 'user@example.com',
    required: false,
  })
  @IsOptional()
  @IsEmail({}, { message: 'Invalid email format' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email?: string;

  @ApiProperty({
    description: 'Client phone number',
    example: '+84123456789',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Phone must be a string' })
  phone?: string;

  @ApiProperty({
    description: 'Client date of birth (ISO date string)',
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
    example: 'https://example.com/avatar.jpg',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Profile picture must be a string' })
  profilePicture?: string;

  @ApiProperty({
    description: 'Account role',
    enum: AccountRole,
    example: AccountRole.PATIENT,
    required: false,
  })
  @IsOptional()
  @IsEnum(AccountRole, { message: 'Invalid account role' })
  role?: AccountRole;

  // GeneralAccount fields

  @ApiProperty({
    description: 'Client full name',
    example: 'John Doe',
    required: false,
    maxLength: 255,
  })
  @IsOptional()
  @IsString({ message: 'Full name must be a string' })
  @MaxLength(255, { message: 'Full name must not exceed 255 characters' })
  @Transform(({ value }) => value?.trim())
  fullName?: string;

  @ApiProperty({
    description: 'Client gender',
    enum: Gender,
    example: Gender.MALE,
    required: false,
  })
  @IsOptional()
  @IsEnum(Gender, { message: 'Gender must be one of: MALE, FEMALE, OTHER' })
  gender?: Gender;

  // DoctorInformation fields

  @ApiProperty({
    description: 'Academic degree',
    example: 'MD, PhD',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Academic degree must be a string' })
  @MaxLength(255, { message: 'Academic degree must not exceed 255 characters' })
  academicDegree?: string;

  @ApiProperty({
    description: 'Years of experience',
    example: '10 years of experience in cardiology',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Experience must be a string' })
  experience?: string;

  @ApiProperty({
    description: 'Current position or title',
    example: 'Chief Cardiologist',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Position must be a string' })
  @MaxLength(255, { message: 'Position must not exceed 255 characters' })
  position?: string;

  @ApiProperty({
    description: 'Introduction text about the doctor',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Introduction must be a string' })
  introduction1?: string;

  @ApiProperty({
    description: 'Work process information',
    required: false,
  })
  @IsOptional()
  @IsObject({ message: 'Work process must be an object' })
  workProcess2?: Record<string, any>;

  @ApiProperty({
    description: 'Study process information',
    required: false,
  })
  @IsOptional()
  @IsObject({ message: 'Study process must be an object' })
  studyProcess3?: Record<string, any>;

  @ApiProperty({
    description: 'Members information',
    required: false,
  })
  @IsOptional()
  @IsObject({ message: 'Members must be an object' })
  members4?: Record<string, any>;

  @ApiProperty({
    description: 'Scientific work information',
    required: false,
  })
  @IsOptional()
  @IsObject({ message: 'Scientific work must be an object' })
  scientificWork5?: Record<string, any>;

  @ApiProperty({
    description: 'Papers information',
    required: false,
  })
  @IsOptional()
  @IsObject({ message: 'Papers must be an object' })
  papers6?: Record<string, any>;

  @ApiProperty({
    description: 'Introduction image URL',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Introduction image must be a string' })
  introductionImage?: string;

  @ApiProperty({
    description: 'Professional license document URL',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Professional license must be a string' })
  professionalLicense?: string;

  @ApiProperty({
    description: 'Certificate of practical training URL',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Certificate of practical training must be a string' })
  certificatePracticalTraining?: string;

  @ApiProperty({
    description: 'Medical license document URL',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Medical license must be a string' })
  medicalLicense?: string;

  // ClinicInformation specific fields
  @ApiProperty({
    description: 'Name of the clinic',
    example: 'City Medical Center',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Clinic name must be a string' })
  @MaxLength(255, { message: 'Clinic name must not exceed 255 characters' })
  clinicName?: string;

  @ApiProperty({
    description: 'Description of the clinic',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  description?: string;

  @ApiProperty({
    description: 'Areas of specialization',
    type: [String],
    example: ['Cardiology', 'Neurology'],
    required: false,
  })
  @IsOptional()
  @IsArray({ message: 'Specialized in must be an array' })
  @IsString({ each: true, message: 'Each specialization must be a string' })
  specializedIn?: string[];

  @ApiProperty({
    description: 'Clinic advantages or pros',
    type: [String],
    example: ['24/7 Emergency Care', 'Modern Equipment'],
    required: false,
  })
  @IsOptional()
  @IsArray({ message: 'Pros must be an array' })
  @IsString({ each: true, message: 'Each pro must be a string' })
  pros?: string[];

  @ApiProperty({
    description: 'Paraclinical services available',
    type: [String],
    example: ['X-Ray', 'MRI', 'CT Scan'],
    required: false,
  })
  @IsOptional()
  @IsArray({ message: 'Paraclinical must be an array' })
  @IsString({
    each: true,
    message: 'Each paraclinical service must be a string',
  })
  paraclinical?: string[];
}
