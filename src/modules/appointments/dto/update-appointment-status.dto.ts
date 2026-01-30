import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { AppointmentStatus } from '../enums';

/**
 * Update Appointment Status DTO
 *
 * Generic DTO for updating appointment status to any valid state
 * Includes validation for status transitions and required fields
 *
 * Use cases:
 * - Admin/Staff manual status management
 * - Bulk status updates
 * - Status corrections
 */
export class UpdateAppointmentStatusDto {
  @ApiProperty({
    description: 'New status for the appointment',
    enum: AppointmentStatus,
    example: AppointmentStatus.CONFIRMED,
    required: true,
  })
  @IsNotEmpty({ message: 'Status is required' })
  @IsEnum(AppointmentStatus, { message: 'Invalid appointment status' })
  status: AppointmentStatus;

  @ApiProperty({
    description:
      'Reason for status change (required when changing to CANCELLED or PAYMENT_FAILED)',
    example: 'Patient requested cancellation',
    required: false,
  })
  @ValidateIf(
    (o) =>
      o.status === AppointmentStatus.CANCELLED ||
      o.status === AppointmentStatus.PAYMENT_FAILED ||
      o.status === AppointmentStatus.PAYMENT_CANCELLED ||
      o.status === AppointmentStatus.ABSENT,
  )
  @IsNotEmpty({
    message:
      'Reason is required when status is CANCELLED, PAYMENT_FAILED, PAYMENT_CANCELLED, or ABSENT',
  })
  @IsString({ message: 'Reason must be a string' })
  @MinLength(10, { message: 'Reason must be at least 10 characters' })
  @MaxLength(500, { message: 'Reason must not exceed 500 characters' })
  @Transform(({ value }) => value?.trim())
  @IsOptional()
  reason?: string;
}
