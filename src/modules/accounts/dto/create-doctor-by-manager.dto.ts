import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsNotEmpty,
  Matches,
  IsEnum,
  IsNumber,
  IsDateString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Gender } from '../enums';

/**
 * Create Doctor By Clinic Manager DTO
 * 
 * Used by clinic managers to add doctor accounts
 * Doctor accounts are linked to the clinic manager's clinic
 * 
 * Password Requirements:
 * - Minimum 6 characters
 * - Maximum 50 characters
 * - Must contain at least one letter
 * - Must contain at least one number
 */
export class CreateDoctorByClinicManagerDto {
  @ApiProperty({
    description: 'Doctor email address',
    example: 'doctor@clinic.com',
  })
  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Invalid email format' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @ApiProperty({
    description: 'Doctor password (min 6 characters, must contain letter and number)',
    example: 'DoctorPass123',
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
    description: 'Doctor full name',
    example: 'Dr. John Smith',
    maxLength: 255,
  })
  @IsNotEmpty({ message: 'Full name is required' })
  @IsString({ message: 'Full name must be a string' })
  @MaxLength(255, { message: 'Full name must not exceed 255 characters' })
  @Transform(({ value }) => value?.trim())
  fullName: string;

  @ApiProperty({
    description: 'Doctor gender',
    enum: Gender,
    example: Gender.MALE,
    required: false,
  })
  @IsOptional()
  @IsEnum(Gender, { message: 'Gender must be one of: MALE, FEMALE, OTHER' })
  gender?: Gender;

  @ApiProperty({
    description: 'Academic degree',
    example: 'MD, PhD',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Academic degree must be a string' })
  @Transform(({ value }) => value?.trim())
  academicDegree?: string;

  @ApiProperty({
    description: 'Years of experience',
    example: '10 years of experience in cardiology',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Experience must be a string' })
  @Transform(({ value }) => value?.trim())
  experience?: string;

  @ApiProperty({
    description: 'Doctor position',
    example: 'Chief Cardiologist',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Position must be a string' })
  @Transform(({ value }) => value?.trim())
  position?: string;

  @ApiProperty({
    description: 'Identity card number',
    example: '001234567890',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Identity number must be a string' })
  @Transform(({ value }) => value?.trim())
  identityNumber?: string;

  @ApiProperty({
    description: 'Place of issue for identity card',
    example: 'Hanoi',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Place of identity card must be a string' })
  @Transform(({ value }) => value?.trim())
  placeIdentityCard?: string;

  @ApiProperty({
    description: 'Identity card issue date (ISO date string)',
    example: '2020-01-15',
    required: false,
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'Identity date must be a valid date string (YYYY-MM-DD)' },
  )
  identityDate?: string;

  @ApiProperty({
    description: 'Bank account number',
    example: '12345678901234567890',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Bank number must be a string' })
  @Transform(({ value }) => value?.trim())
  bankNumber?: string;

  @ApiProperty({
    description: 'Bank name',
    example: 'Vietcombank',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Bank name must be a string' })
  @Transform(({ value }) => value?.trim())
  bankName?: string;

  @ApiProperty({
    description: 'Bank branch',
    example: 'Hanoi Branch',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Bank branch must be a string' })
  @Transform(({ value }) => value?.trim())
  bankBranch?: string;

  @ApiProperty({
    description: 'Professional license (URL or Object)',
    example: 'https://example.com/professional-license.pdf',
    required: false,
  })
  @IsOptional()
  professionalLicense?: any;

  @ApiProperty({
    description: 'Certificate of practical training (URL or Object)',
    example: 'https://example.com/practical-training.pdf',
    required: false,
  })
  @IsOptional()
  certificatePracticalTraining?: any;

  @ApiProperty({
    description: 'Medical license (URL or Object)',
    example: 'https://example.com/medical-license.pdf',
    required: false,
  })
  @IsOptional()
  medicalLicense?: any;
}
