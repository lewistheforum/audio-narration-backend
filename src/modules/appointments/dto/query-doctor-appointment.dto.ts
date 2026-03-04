import { IsOptional, IsDateString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AppointmentStatus } from '../enums';

/**
 * Query Doctor Appointment DTO
 *
 * Used for filtering doctor's appointments by date and status
 */
export class QueryDoctorAppointmentDto {
  @ApiProperty({
    description: 'Filter by appointment date (YYYY-MM-DD)',
    example: '2026-02-24',
    required: false,
  })
  @IsOptional()
  @IsDateString({}, { message: 'Date must be in YYYY-MM-DD format' })
  date?: string;

  @ApiProperty({
    description: 'Filter by appointment status',
    enum: AppointmentStatus,
    example: AppointmentStatus.CHECKED_IN,
    required: false,
  })
  @IsOptional()
  @IsEnum(AppointmentStatus, { message: 'Invalid appointment status' })
  status?: AppointmentStatus;
}
