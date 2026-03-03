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
 * - Creates Address entity with full address details (codes and names)
 * - Links via parentId to the clinic admin account
 * - Transitions subscription status to PENDING_LEGAL_SETUP
 */
export class CreateClinicManagerForRegistrationDto {
  // Account fields
  @ApiProperty({
    description: 'Clinic manager username',
    example: 'manager_john',
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
    description: 'Clinic manager password (min 6 characters, must contain letter and number)',
    example: 'ManagerPass123',
    minLength: 6,
    maxLength: 50,
  })
  @IsNotEmpty({ message: 'Password is required' })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  @MaxLength(50, { message: 'Password must not exceed 50 characters' })
  password: string;

  @ApiProperty({
    description: 'Clinic manager phone number',
    example: '+84123456789',
  })
  @IsNotEmpty({ message: 'Phone number is required' })
  @IsString({ message: 'Phone number must be a string' })
  @MaxLength(20, { message: 'Phone number must not exceed 20 characters' })
  phone: string;

  // ClinicManagerInformation fields
  @ApiProperty({
    description: 'Name of the clinic branch managed by this manager',
    example: 'Main Branch',
  })
  @IsNotEmpty({ message: 'Clinic branch name is required' })
  @IsString({ message: 'Clinic branch name must be a string' })
  @MaxLength(255, { message: 'Clinic branch name must not exceed 255 characters' })
  @Transform(({ value }) => value?.trim())
  clinicBranchName: string;

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
    description: 'Clinic manager gender',
    enum: Gender,
    example: Gender.MALE,
  })
  @IsNotEmpty({ message: 'Gender is required' })
  @IsString({ message: 'Gender must be a string' })
  gender: Gender;

  @ApiProperty({
    description: 'Profile picture URL',
    example: 'https://example.com/avatar.jpg',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Profile picture must be a string' })
  profilePicture?: string;

  @ApiProperty({
    description: 'Clinic manager date of birth (ISO date string)',
    example: '1985-05-15',
  })
  @IsNotEmpty({ message: 'Date of birth is required' })
  @IsDateString({}, { message: 'Date of birth must be a valid date string' })
  dob: string;

  // Address fields
  @ApiProperty({
    description: 'Street address detail',
    example: '123 Nguyen Hue Street',
  })
  @IsNotEmpty({ message: 'Street address is required' })
  @IsString({ message: 'Street address must be a string' })
  @MaxLength(500, { message: 'Street address must not exceed 500 characters' })
  @Transform(({ value }) => value?.trim())
  addressDetail: string;

  @ApiProperty({
    description: 'Ward code',
    example: '00001',
  })
  @IsNotEmpty({ message: 'Ward code is required' })
  @IsString({ message: 'Ward code must be a string' })
  wardCode: string;

  @ApiProperty({
    description: 'Ward name',
    example: 'Ben Nghe Ward',
  })
  @IsNotEmpty({ message: 'Ward name is required' })
  @IsString({ message: 'Ward name must be a string' })
  @MaxLength(255, { message: 'Ward name must not exceed 255 characters' })
  @Transform(({ value }) => value?.trim())
  wardName: string;

  @ApiProperty({
    description: 'District code',
    example: '001',
  })
  @IsNotEmpty({ message: 'District code is required' })
  @IsString({ message: 'District code must be a string' })
  districtCode: string;

  @ApiProperty({
    description: 'District name',
    example: 'District 1',
  })
  @IsNotEmpty({ message: 'District name is required' })
  @IsString({ message: 'District name must be a string' })
  @MaxLength(255, { message: 'District name must not exceed 255 characters' })
  @Transform(({ value }) => value?.trim())
  districtName: string;

  @ApiProperty({
    description: 'Province code',
    example: '01',
  })
  @IsNotEmpty({ message: 'Province code is required' })
  @IsString({ message: 'Province code must be a string' })
  provinceCode: string;

  @ApiProperty({
    description: 'Province name',
    example: 'Ho Chi Minh City',
  })
  @IsNotEmpty({ message: 'Province name is required' })
  @IsString({ message: 'Province name must be a string' })
  @MaxLength(255, { message: 'Province name must not exceed 255 characters' })
  @Transform(({ value }) => value?.trim())
  provinceName: string;

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
