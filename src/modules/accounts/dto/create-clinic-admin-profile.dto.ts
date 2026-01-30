import {
  IsString,
  MaxLength,
  IsOptional,
  IsNotEmpty,
  IsDateString,
  IsUrl,
  IsArray,
  IsBoolean,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

/**
 * Create Clinic Admin Profile DTO
 *
 * Used for creating clinic administrator profiles after account creation.
 * This DTO contains only profile-related fields, not account creation fields.
 *
 * Clinic admin has the following permissions:
 * - Manage clinic operations
 * - View clinic data
 * - Manage clinic staff
 */
export class CreateClinicAdminProfileDto {
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
  @IsArray({ message: 'Specializations must be an array' })
  @IsString({ each: true, message: 'Each specialization must be a string' })
  specializedIn?: string[];

  @ApiProperty({
    description: 'Clinic pros/advantages',
    example: ['Modern equipment', 'Experienced doctors', '24/7 service'],
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'Pros must be an array' })
  @IsString({ each: true, message: 'Each pro must be a string' })
  pros?: string[];

  @ApiProperty({
    description: 'Paraclinical services offered',
    example: ['X-Ray', 'MRI', 'Blood test', 'Ultrasound'],
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'Paraclinical services must be an array' })
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

  @ApiProperty({
    description: 'Bank name',
    example: 'VPBank',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Bank name must be a string' })
  bankName?: string;

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
    description: 'Bank branch',
    example: 'Hanoi Branch',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Bank branch must be a string' })
  @Transform(({ value }) => value?.trim())
  bankBranch?: string;

  @ApiProperty({
    description: 'SePay virtual account number',
    example: '0381234567',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'SePay VA must be a string' })
  @Transform(({ value }) => value?.trim())
  sepayVa?: string;

  @ApiProperty({
    description: 'Verification status',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Is verify must be a boolean' })
  isVerify?: boolean;
}
