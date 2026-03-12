import { IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Check-in Patient DTO
 *
 * Data transfer object for checking in a patient for their appointment
 *
 * V4.5 Update:
 * - Added extraRoomId field for out-of-hours appointments (Option 4)
 * - Allows staff to manually assign room when patient arrives
 * - Only applicable for appointments with clinic_shift_hour_id = NULL
 */
export class CheckInDto {
  @ApiPropertyOptional({
    description: 'Room ID for out-of-hours appointments (Option 4 only). Staff manually assigns when patient arrives.',
    example: '123e4567-e89b-12d3-a456-426614174000',
    type: String,
  })
  @IsOptional()
  @IsUUID('4', { message: 'extraRoomId must be a valid UUID' })
  extraRoomId?: string;
}

