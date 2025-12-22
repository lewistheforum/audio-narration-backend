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
}
