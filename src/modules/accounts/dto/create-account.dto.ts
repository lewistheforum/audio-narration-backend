import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsNotEmpty,
  Matches,
  IsEnum,
  IsDateString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Gender } from '../enums';

/**
 * Create Account DTO
 *
 * Used for patient registration with standard authentication (Single-Step)
 * Data is saved to two tables in one transaction:
 * 1. Account (accounts) - Common account data
 * 2. GeneralAccount (general_accounts) - Patient-specific data (fullName, gender)
 *
 * Password Requirements:
 * - Minimum 6 characters
 * - Maximum 50 characters
 * - Must contain at least one letter
 * - Must contain at least one number
 */
export class CreateAccountDto {
  @ApiProperty({
    description: 'Client username',
    example: 'johndoe',
  })
  @IsNotEmpty({ message: 'Username is required' })
  @IsString({ message: 'Username must be a string' })
  @MinLength(3, { message: 'Username must be at least 3 characters' })
  @MaxLength(100, { message: 'Username must not exceed 100 characters' })
  @Transform(({ value }) => value?.trim())
  username: string;

  @ApiProperty({
    description: 'Client email address',
    example: 'user@example.com',
  })
  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Invalid email format' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @ApiProperty({
    description: 'Client phone number',
    example: '0912345678',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Phone must be a string' })
  @Matches(/^0\d{9}$/, {
    message: 'Phone must be exactly 10 digits and start with 0',
  })
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
    description:
      'Client password (min 6 characters, must contain letter and number)',
    example: 'Pass123456',
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
    description: 'Profile picture URL',
    example: 'https://example.com/avatar.jpg',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Profile picture must be a string' })
  profilePicture?: string;

  // GeneralAccount fields

  @ApiProperty({
    description: 'Client full name',
    example: 'John Doe',
    required: true,
    maxLength: 255,
  })
  @IsNotEmpty({ message: 'Full name is required' })
  @IsString({ message: 'Full name must be a string' })
  @MaxLength(255, { message: 'Full name must not exceed 255 characters' })
  @Transform(({ value }) => value?.trim())
  fullName: string;

  @ApiProperty({
    description: 'Client gender',
    enum: Gender,
    example: Gender.MALE,
    required: true,
  })
  @IsNotEmpty({ message: 'Gender is required' })
  @IsEnum(Gender, { message: 'Gender must be one of: MALE, FEMALE, OTHER' })
  gender: Gender;
}
