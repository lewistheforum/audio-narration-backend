import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  Matches,
  Length,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Search Patient Query DTO
 *
 * Query parameters for searching patients by phone, email, or full name
 * Used by clinic staff to check if a patient already exists before creating walk-in appointment
 *
 * Business Logic:
 * - Phone number is the primary search key (unique in system)
 * - Email and fullName are optional for fuzzy search
 * - At least one search parameter must be provided
 */
export class SearchPatientQueryDto {
  @ApiProperty({
    description: 'Patient phone number (10 digits, starts with 0)',
    example: '0912345678',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Phone must be a string' })
  @Matches(/^0\d{9}$/, {
    message: 'Phone must be exactly 10 digits and start with 0',
  })
  @Transform(({ value }) => value?.trim())
  phone?: string;

  @ApiProperty({
    description: 'Patient email address for search',
    example: 'nguyenvana@gmail.com',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Email must be a string' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email?: string;

  @ApiProperty({
    description: 'Patient full name for fuzzy search',
    example: 'John Doe',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Full name must be a string' })
  @Length(2, 100, { message: 'Full name must be between 2 and 100 characters' })
  @Transform(({ value }) => value?.trim())
  fullName?: string;
}
