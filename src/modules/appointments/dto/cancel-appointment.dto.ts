import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Cancel Appointment DTO
 *
 * Data structure for cancelling an appointment
 */
export class CancelAppointmentDto {
  @ApiProperty({
    description: 'Reason for cancellation',
    example: 'Patient requested to reschedule due to personal reasons',
  })
  @IsNotEmpty({ message: 'Cancellation reason is required' })
  @IsString({ message: 'Cancellation reason must be a string' })
  @MaxLength(500, {
    message: 'Cancellation reason must not exceed 500 characters',
  })
  @Transform(({ value }) => value?.trim())
  rejectReason: string;
}
