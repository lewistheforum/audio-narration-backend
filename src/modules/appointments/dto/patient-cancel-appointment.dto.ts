import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Patient Cancel Appointment DTO
 *
 * Data structure for patient cancelling their own appointment
 */
export class PatientCancelAppointmentDto {
  @ApiProperty({
    description: 'Note about cancellation (optional)',
    example: 'I need to reschedule due to personal reasons',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Patient note must be a string' })
  @MaxLength(1000, {
    message: 'Patient note must not exceed 1000 characters',
  })
  @Transform(({ value }) => value?.trim())
  patientNote?: string;
}
