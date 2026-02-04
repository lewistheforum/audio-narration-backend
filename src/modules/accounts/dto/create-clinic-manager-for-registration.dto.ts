import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsNotEmpty,
  IsOptional,
  IsDateString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Gender } from '../enums/gender.enum';

/**
 * Create Clinic Manager for Registration DTO
 *
 * Used in Step 4A of clinic admin registration flow.
 * Creates a clinic manager account linked to the clinic admin.
 *
 * Business Rules:
 * - Actor must have CLINIC_ADMIN role
 * - Registration/subscription status must be PENDING_MANAGER_SETUP
 * - Only one manager allowed for this clinic admin
 * - Creates manager Account with CLINIC_MANAGER role and ACTIVE status
 * - Creates ClinicManagerInformation entity
 * - Links via parentId to the clinic admin account
 * - Transitions subscription status to PENDING_LEGAL_SETUP
 */
export class CreateClinicManagerForRegistrationDto {
  @ApiProperty({
    description: 'Clinic manager full name',
    example: 'John Smith',
  })
  @IsNotEmpty({ message: 'Full name is required' })
  @IsString({ message: 'Full name must be a string' })
  @MinLength(2, { message: 'Full name must be at least 2 characters' })
  @MaxLength(255, { message: 'Full name must not exceed 255 characters' })
  @Transform(({ value }) => value?.trim())
  fullName: string;

  @ApiProperty({
    description: 'Clinic manager email address',
    example: 'manager@clinic.com',
  })
  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Invalid email format' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @ApiProperty({
    description: 'Clinic manager phone number',
    example: '+84123456789',
  })
  @IsNotEmpty({ message: 'Phone number is required' })
  @IsString({ message: 'Phone number must be a string' })
  @MaxLength(20, { message: 'Phone number must not exceed 20 characters' })
  phone: string;

  @ApiProperty({
    description: 'Clinic manager date of birth (ISO date string)',
    example: '1985-05-15',
  })
  @IsNotEmpty({ message: 'Date of birth is required' })
  @IsDateString({}, { message: 'Date of birth must be a valid date string' })
  dateOfBirth: string;

  @ApiProperty({
    description: 'Clinic manager gender',
    enum: Gender,
    example: Gender.MALE,
  })
  @IsNotEmpty({ message: 'Gender is required' })
  @IsString({ message: 'Gender must be a string' })
  gender: Gender;

  @ApiProperty({
    description: 'Clinic manager address',
    example: '123 Nguyen Hue Street, District 1, Ho Chi Minh City',
  })
  @IsNotEmpty({ message: 'Address is required' })
  @IsString({ message: 'Address must be a string' })
  @MaxLength(500, { message: 'Address must not exceed 500 characters' })
  @Transform(({ value }) => value?.trim())
  address: string;

  @ApiProperty({
    description: 'Ward code',
    example: '00001',
  })
  @IsNotEmpty({ message: 'Ward code is required' })
  @IsString({ message: 'Ward code must be a string' })
  wardCode: string;

  @ApiProperty({
    description: 'District code',
    example: '001',
  })
  @IsNotEmpty({ message: 'District code is required' })
  @IsString({ message: 'District code must be a string' })
  districtCode: string;

  @ApiProperty({
    description: 'Province code',
    example: '01',
  })
  @IsNotEmpty({ message: 'Province code is required' })
  @IsString({ message: 'Province code must be a string' })
  provinceCode: string;

  @ApiProperty({
    description: 'ID card number',
    example: '123456789012',
  })
  @IsNotEmpty({ message: 'ID card number is required' })
  @IsString({ message: 'ID card number must be a string' })
  @MinLength(9, { message: 'ID card number must be at least 9 characters' })
  @MaxLength(12, { message: 'ID card number must not exceed 12 characters' })
  idCardNumber: string;

  @ApiProperty({
    description: 'ID card front image URL',
    example: 'https://example.com/id-front.jpg',
  })
  @IsNotEmpty({ message: 'ID card front image URL is required' })
  @IsString({ message: 'ID card front image URL must be a string' })
  idCardFrontUrl: string;

  @ApiProperty({
    description: 'ID card back image URL',
    example: 'https://example.com/id-back.jpg',
  })
  @IsNotEmpty({ message: 'ID card back image URL is required' })
  @IsString({ message: 'ID card back image URL must be a string' })
  idCardBackUrl: string;
}
