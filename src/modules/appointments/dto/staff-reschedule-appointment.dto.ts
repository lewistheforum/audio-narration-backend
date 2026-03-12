import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsDateString, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Staff Reschedule Appointment DTO
 *
 * Data structure for staff rescheduling an appointment
 * All fields are optional - can update one or multiple fields
 */
export class StaffRescheduleAppointmentDto {
  @ApiProperty({
    description: 'New appointment date (YYYY-MM-DD). Optional - if not provided and clinicShiftHourId is provided, date will be auto-updated from shift hour.',
    example: '2026-03-15',
    required: false,
  })
  @IsOptional()
  @IsDateString({}, { message: 'Appointment date must be a valid date format (YYYY-MM-DD)' })
  appointmentDate?: string;

  @ApiProperty({
    description: 'New clinic shift hour ID (UUID). Optional - if provided, appointment date will be auto-updated from this shift hour work date.',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsOptional()
  @IsUUID('4', { message: 'Clinic shift hour ID must be a valid UUID' })
  clinicShiftHourId?: string;

  @ApiProperty({
    description: 'Extra hour for appointment (ISO 8601 format). Optional.',
    example: '2026-03-15T10:00:00.000Z',
    required: false,
  })
  @IsOptional()
  @IsDateString({}, { message: 'Extra hour must be a valid datetime format' })
  @Transform(({ value }) => (value === '' ? null : value))
  extraHour?: string;

  @ApiProperty({
    description: 'Extra room ID (UUID) for out-of-hours appointments. Optional - can be null or empty to clear.',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsOptional()
  @IsUUID('4', { message: 'Extra room ID must be a valid UUID' })
  @Transform(({ value }) => (value === '' ? null : value))
  extraRoomId?: string;
}
