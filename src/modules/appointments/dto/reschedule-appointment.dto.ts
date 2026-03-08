import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsDateString, IsUUID, IsOptional } from 'class-validator';

/**
 * Reschedule Appointment DTO
 *
 * Data transfer object for rescheduling an existing appointment
 */
export class RescheduleAppointmentDto {
  @ApiProperty({
    description: 'New appointment date (YYYY-MM-DD)',
    example: '2026-01-25',
  })
  @IsNotEmpty({ message: 'Appointment date is required' })
  @IsDateString({}, { message: 'Appointment date must be a valid date format' })
  appointmentDate: string;

  @ApiProperty({
    description: 'New clinic shift hour ID (UUID)',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsOptional()
  @IsUUID('4', { message: 'Clinic shift hour ID must be a valid UUID' })
  clinicShiftHourId?: string;
}
