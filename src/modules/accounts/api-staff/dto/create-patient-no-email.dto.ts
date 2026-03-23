import {
  IsString,
  IsNotEmpty,
  MaxLength,
  MinLength,
  Matches,
  IsDateString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

/**
 * Create Patient Account Without Email by Staff DTO
 * 
 * Used for walk-in patients who don't have a real email address.
 * System automatically generates a fake email from name + date of birth.
 * 
 * Only requires 3 basic fields: phone, full_name, date_of_birth.
 * 
 * System automatically:
 * - Generates fake email: fullname + DOB + @tempemail.clinic
 * - Generates a random secure password
 * - Creates account with PATIENT role
 * - Does NOT send email (fake email doesn't exist)
 * - Account type = "DIRECT_ACCOUNT", is_temp_email = true
 * 
 * Business Rules:
 * - Phone CAN be duplicated (multiple people may share same phone number)
 * - Full name + DOB used to generate unique fake email
 * - Password auto-generated and returned in response
 * - Staff must provide credentials to customer directly
 */
export class CreatePatientNoEmailDto {
  @ApiProperty({
    description: 'Patient phone number (allows duplicates)',
    example: '0976543210',
  })
  @IsNotEmpty({ message: 'Phone number is required' })
  @IsString({ message: 'Phone number must be a string' })
  @Matches(/^0\d{9}$/, {
    message: 'Phone number must be exactly 10 digits and start with 0',
  })
  @Transform(({ value }) => value?.trim())
  phone: string;

  @ApiProperty({
    description: 'Patient full name (Vietnamese characters allowed, used to generate email)',
    example: 'Jane Doe',
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

  @ApiProperty({
    description: 'Patient date of birth (ISO date string YYYY-MM-DD, used to generate email)',
    example: '1988-08-10',
  })
  @IsNotEmpty({ message: 'Date of birth is required' })
  @IsDateString({}, { message: 'Date of birth must be a valid date string (YYYY-MM-DD)' })
  dateOfBirth: string;
}
