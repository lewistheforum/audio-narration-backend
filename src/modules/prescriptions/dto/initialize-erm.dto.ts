import { IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Initialize ERM DTO
 *
 * Request body for creating a new ERM record (Step 3 - ERM Flow)
 */
export class InitializeErmDto {
  @ApiProperty({
    description: 'Service appointment ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty({ message: 'Service appointment ID is required' })
  @IsUUID('4', { message: 'Service appointment ID must be a valid UUID' })
  serviceAppointmentId: string;

  @ApiProperty({
    description: 'Appointment ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty({ message: 'Appointment ID is required' })
  @IsUUID('4', { message: 'Appointment ID must be a valid UUID' })
  appointmentId: string;
}
