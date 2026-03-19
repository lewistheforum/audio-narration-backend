import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsDateString, IsUUID, IsOptional, IsISO8601 } from 'class-validator';

/**
 * Patient Reschedule Appointment DTO
 *
 * Data transfer object for patient to reschedule an existing appointment
 * Supports both Standard Bookings (via clinic_shift_hour_id) and Out-of-Hours Bookings (via extra_hour)
 */
export class PatientRescheduleAppointmentDto {
  @ApiProperty({
    description: 'New appointment date (YYYY-MM-DD format)',
    example: '2026-03-20',
  })
  @IsNotEmpty({ message: 'Appointment date is required' })
  @IsDateString({}, { message: 'Appointment date must be a valid date in YYYY-MM-DD format' })
  appointmentDate: string;

  @ApiPropertyOptional({
    description: 'New clinic shift hour ID for standard bookings (UUID)',
    example: '123e4567-e89b-12d3-a456-426614174003',
    required: false,
  })
  @IsOptional()
  @IsUUID('4', { message: 'Clinic shift hour ID must be a valid UUID' })
  clinicShiftHourId?: string;

  @ApiPropertyOptional({
    description: 'New extra hour for out-of-hours bookings (ISO 8601 format with timezone)',
    example: '2026-03-20T19:30:00.000+07:00',
    required: false,
  })
  @IsOptional()
  @IsISO8601({}, { message: 'Extra hour must be a valid ISO 8601 timestamp' })
  extraHour?: string;

  @ApiPropertyOptional({
    description: 'Doctor ID for standard bookings (Options 1, 2, 3). Required when rescheduling a standard booking. Must be a doctor assigned to the new clinic shift hour on the selected date. Can be retrieved via GET /schedules/staff/doctors or GET /schedules/staff/doctors/schedules/by-date',
    example: '123e4567-e89b-12d3-a456-426614174001',
    required: false,
  })
  @IsOptional()
  @IsUUID('4', { message: 'Doctor ID must be a valid UUID' })
  doctorId?: string;
}
