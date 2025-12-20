import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsNotEmpty,
  Matches,
  IsEnum,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Gender, ClinicRole } from '../enums';

/**
 * Create Staff By Clinic Manager DTO
 * 
 * Used by clinic managers to add clinic staff accounts
 * Staff accounts are linked to the clinic manager's clinic
 * 
 * Password Requirements:
 * - Minimum 6 characters
 * - Maximum 50 characters
 * - Must contain at least one letter
 * - Must contain at least one number
 */
export class CreateStaffByClinicManagerDto {
  @ApiProperty({
    description: 'Staff email address',
    example: 'staff@clinic.com',
  })
  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Invalid email format' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @ApiProperty({
    description: 'Staff password (min 6 characters, must contain letter and number)',
    example: 'StaffPass123',
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
    description: 'Staff full name',
    example: 'Jane Doe',
    maxLength: 255,
  })
  @IsNotEmpty({ message: 'Full name is required' })
  @IsString({ message: 'Full name must be a string' })
  @MaxLength(255, { message: 'Full name must not exceed 255 characters' })
  @Transform(({ value }) => value?.trim())
  fullName: string;

  @ApiProperty({
    description: 'Staff gender',
    enum: Gender,
    example: Gender.FEMALE,
    required: false,
  })
  @IsOptional()
  @IsEnum(Gender, { message: 'Gender must be one of: MALE, FEMALE, OTHER' })
  gender?: Gender;

  @ApiProperty({
    description: 'Staff role in clinic',
    enum: ClinicRole,
    example: ClinicRole.STAFF,
  })
  @IsNotEmpty({ message: 'Clinic role is required' })
  @IsEnum(ClinicRole, { message: 'Invalid clinic role' })
  clinicRole: ClinicRole;
}
