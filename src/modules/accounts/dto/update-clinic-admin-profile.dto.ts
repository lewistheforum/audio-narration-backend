import {
  IsString,
  IsOptional,
  MaxLength,
  IsDateString,
  IsUrl,
  IsArray,
  IsBoolean,
  IsEnum,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { BankName } from '../enums/bank-name.enum';

/**
 * Update Clinic Admin Profile DTO
 *
 * Used for updating clinic administrator profile information
 * All fields are optional - only provided fields will be updated
 */
export class UpdateClinicAdminProfileDto {
  @ApiProperty({
    description: 'Clinic name',
    example: 'City Medical Clinic',
    required: false,
    maxLength: 255,
  })
  @IsOptional()
  @IsString({ message: 'Clinic name must be a string' })
  @MaxLength(255, { message: 'Clinic name must not exceed 255 characters' })
  @Transform(({ value }) => value?.trim())
  clinicName?: string;

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
    description: 'Date of birth (ISO date string)',
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
  @IsUrl({}, { message: 'Profile picture must be a valid URL' })
  profilePicture?: string;

  @ApiProperty({
    description: 'Bank name',
    enum: BankName,
    example: BankName.VPBANK,
    required: false,
  })
  @IsOptional()
  @IsEnum(BankName, { message: 'Invalid bank name' })
  bankName?: BankName;

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
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Is verify must be a boolean' })
  isVerify?: boolean;
}
