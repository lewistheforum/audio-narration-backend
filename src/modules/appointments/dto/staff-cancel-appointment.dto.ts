import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Staff Cancel Appointment DTO
 *
 * Data structure for staff cancelling an appointment
 */
export class StaffCancelAppointmentDto {
  @ApiProperty({
    description: 'Note about cancellation (optional)',
    example: 'Patient requested to cancel due to emergency',
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
