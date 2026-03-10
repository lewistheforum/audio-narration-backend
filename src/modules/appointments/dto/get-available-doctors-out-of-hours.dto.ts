import { ApiProperty } from '@nestjs/swagger';
import {
  IsUUID,
  IsDateString,
  IsISO8601,
} from 'class-validator';

/**
 * DTO for getting available doctors for out-of-hours booking (Option 4)
 * 
 * Used to query doctors who are NOT busy at a specific time
 */
export class GetAvailableDoctorsForOutOfHoursDto {
  @ApiProperty({
    description: 'Clinic ID',
    example: '550e8400-e29b-41d4-a716-446655440010',
  })
  @IsUUID('4', { message: 'Invalid clinic ID format' })
  clinicId: string;

  @ApiProperty({
    description: 'Appointment date in YYYY-MM-DD format',
    example: '2026-03-15',
  })
  @IsDateString({}, { message: 'Invalid date format. Use YYYY-MM-DD' })
  appointmentDate: string;

  @ApiProperty({
    description: 'Extra hour timestamp in ISO 8601 format with timezone',
    example: '2026-03-15T14:30:00+07:00',
  })
  @IsISO8601({}, { message: 'Extra hour must be a valid ISO 8601 timestamp with timezone' })
  extraHour: string;
}
