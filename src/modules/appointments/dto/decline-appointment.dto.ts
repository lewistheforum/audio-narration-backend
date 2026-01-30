import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Decline Appointment DTO
 *
 * Used when a doctor declines a pending appointment
 * Changes status from PENDING to CANCELLED with reject reason
 */
export class DeclineAppointmentDto {
  @ApiProperty({
    description: 'Reason why the doctor is declining the appointment',
    example: 'Doctor is fully booked on this date',
    required: true,
  })
  @IsNotEmpty({ message: 'Reject reason is required' })
  @IsString({ message: 'Reject reason must be a string' })
  @MinLength(10, { message: 'Reject reason must be at least 10 characters' })
  @MaxLength(500, { message: 'Reject reason must not exceed 500 characters' })
  @Transform(({ value }) => value?.trim())
  rejectReason: string;
}
