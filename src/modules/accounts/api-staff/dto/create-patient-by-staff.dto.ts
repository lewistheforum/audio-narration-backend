import {
  IsEmail,
  IsString,
  IsNotEmpty,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

/**
 * Create Patient Account by Staff DTO
 * 
 * Used for walk-in appointment patient registration by clinic staff.
 * Only requires 3 basic fields: email, phone, full_name.
 * 
 * System automatically:
 * - Generates a random secure password
 * - Sends welcome email with credentials
 * - Creates account with PATIENT role
 * - Creates patient profile with minimal data
 * 
 * Business Rules:
 * - Email must be unique (real email from patient)
 * - Phone CAN be duplicated (multiple people may share same phone number)
 * - Full name must be valid (Vietnamese characters allowed)
 * - Password is auto-generated and sent via email
 * - Account type = "DIRECT_ACCOUNT" (created by staff, not online)
 */
export class CreatePatientByStaffDto {
  @ApiProperty({
    description: 'Patient email address (must be real email)',
    example: 'nguyenthib@gmail.com',
  })
  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Invalid email format' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @ApiProperty({
    description: 'Patient phone number (allows duplicates)',
    example: '0987654321',
  })
  @IsNotEmpty({ message: 'Phone number is required' })
  @IsString({ message: 'Phone number must be a string' })
  @Matches(/^0\d{9}$/, {
    message: 'Phone number must be exactly 10 digits and start with 0',
  })
  @Transform(({ value }) => value?.trim())
  phone: string;

  @ApiProperty({
    description: 'Patient full name (Vietnamese characters allowed)',
    example: 'Nguyễn Thị B',
  })
  @IsNotEmpty({ message: 'Full name is required' })
  @IsString({ message: 'Full name must be a string' })
  @MinLength(2, { message: 'Full name must be at least 2 characters' })
  @MaxLength(100, { message: 'Full name must not exceed 100 characters' })
  @Matches(/^[a-zA-ZÀ-ỹ\s]+$/, {
    message:
      'Full name can only contain letters, Vietnamese accents, and spaces',
  })
  @Transform(({ value }) => value?.trim())
  fullName: string;
}
