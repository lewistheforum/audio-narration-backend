import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  MaxLength,
  IsPhoneNumber,
  IsNumber,
  Min,
  Max,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Gender, BloodType } from '../entities/profile.entity';

/**
 * Create Profile DTO
 * 
 * Used for creating a new user profile
 * All fields are optional to allow gradual profile completion
 */
export class CreateProfileDto {
  @ApiProperty({
    description: 'Phone number (international format recommended)',
    example: '+1234567890',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Matches(/^[+]?[\d\s\-()]+$/, { message: 'Invalid phone number format' })
  @MaxLength(20, { message: 'Phone number must not exceed 20 characters' })
  @Transform(({ value }) => value?.trim())
  phoneNumber?: string;

  @ApiProperty({
    description: 'Date of birth (YYYY-MM-DD)',
    example: '1990-01-15',
    required: false,
  })
  @IsOptional()
  @IsDateString({}, { message: 'Invalid date format. Use YYYY-MM-DD' })
  dateOfBirth?: string;

  @ApiProperty({
    description: 'Gender',
    enum: Gender,
    required: false,
  })
  @IsOptional()
  @IsEnum(Gender, { message: 'Invalid gender value' })
  gender?: Gender;

  @ApiProperty({
    description: 'Full address',
    example: '123 Main Street, Apt 4B',
    required: false,
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Address must not exceed 500 characters' })
  @Transform(({ value }) => value?.trim())
  address?: string;

  @ApiProperty({
    description: 'City',
    example: 'New York',
    required: false,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'City must not exceed 100 characters' })
  @Transform(({ value }) => value?.trim())
  city?: string;

  @ApiProperty({
    description: 'State/Province',
    example: 'NY',
    required: false,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'State must not exceed 100 characters' })
  @Transform(({ value }) => value?.trim())
  state?: string;

  @ApiProperty({
    description: 'Country',
    example: 'United States',
    required: false,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Country must not exceed 100 characters' })
  @Transform(({ value }) => value?.trim())
  country?: string;

  @ApiProperty({
    description: 'Postal/ZIP code',
    example: '10001',
    required: false,
    maxLength: 20,
  })
  @IsOptional()
  @IsString()
  @MaxLength(20, { message: 'Postal code must not exceed 20 characters' })
  @Transform(({ value }) => value?.trim())
  postalCode?: string;

  @ApiProperty({
    description: 'Blood type',
    enum: BloodType,
    required: false,
  })
  @IsOptional()
  @IsEnum(BloodType, { message: 'Invalid blood type' })
  bloodType?: BloodType;

  @ApiProperty({
    description: 'Height in centimeters',
    example: 175.5,
    required: false,
    minimum: 50,
    maximum: 300,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Height must be a number' })
  @Min(50, { message: 'Height must be at least 50 cm' })
  @Max(300, { message: 'Height must not exceed 300 cm' })
  height?: number;

  @ApiProperty({
    description: 'Weight in kilograms',
    example: 70.5,
    required: false,
    minimum: 20,
    maximum: 500,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Weight must be a number' })
  @Min(20, { message: 'Weight must be at least 20 kg' })
  @Max(500, { message: 'Weight must not exceed 500 kg' })
  weight?: number;

  @ApiProperty({
    description: 'Allergies (comma-separated)',
    example: 'Peanuts, Penicillin, Latex',
    required: false,
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Allergies must not exceed 1000 characters' })
  @Transform(({ value }) => value?.trim())
  allergies?: string;

  @ApiProperty({
    description: 'Medical conditions (comma-separated)',
    example: 'Diabetes Type 2, Hypertension',
    required: false,
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Medical conditions must not exceed 1000 characters' })
  @Transform(({ value }) => value?.trim())
  medicalConditions?: string;

  @ApiProperty({
    description: 'Current medications (comma-separated)',
    example: 'Metformin 500mg, Lisinopril 10mg',
    required: false,
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Current medications must not exceed 1000 characters' })
  @Transform(({ value }) => value?.trim())
  currentMedications?: string;

  @ApiProperty({
    description: 'Emergency contact name',
    example: 'Jane Doe',
    required: false,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Emergency contact name must not exceed 100 characters' })
  @Transform(({ value }) => value?.trim())
  emergencyContactName?: string;

  @ApiProperty({
    description: 'Emergency contact phone number',
    example: '+1234567890',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Matches(/^[+]?[\d\s\-()]+$/, { message: 'Invalid phone number format' })
  @MaxLength(20, { message: 'Phone number must not exceed 20 characters' })
  @Transform(({ value }) => value?.trim())
  emergencyContactPhone?: string;

  @ApiProperty({
    description: 'Emergency contact relationship',
    example: 'Spouse',
    required: false,
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: 'Relationship must not exceed 50 characters' })
  @Transform(({ value }) => value?.trim())
  emergencyContactRelationship?: string;

  @ApiProperty({
    description: 'Insurance provider name',
    example: 'Blue Cross Blue Shield',
    required: false,
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Insurance provider must not exceed 200 characters' })
  @Transform(({ value }) => value?.trim())
  insuranceProvider?: string;

  @ApiProperty({
    description: 'Insurance policy number',
    example: 'BC12345678',
    required: false,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Policy number must not exceed 100 characters' })
  @Transform(({ value }) => value?.trim())
  insurancePolicyNumber?: string;

  @ApiProperty({
    description: 'Short biography or description',
    example: 'Health enthusiast, yoga instructor',
    required: false,
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Bio must not exceed 500 characters' })
  @Transform(({ value }) => value?.trim())
  bio?: string;

  @ApiProperty({
    description: 'Occupation',
    example: 'Software Engineer',
    required: false,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Occupation must not exceed 100 characters' })
  @Transform(({ value }) => value?.trim())
  occupation?: string;

  @ApiProperty({
    description: 'Profile avatar/photo URL (Cloudinary or other CDN)',
    example: 'https://res.cloudinary.com/example/image/upload/avatar.jpg',
    required: false,
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Avatar URL must not exceed 500 characters' })
  @Transform(({ value }) => value?.trim())
  avatar?: string;
}
