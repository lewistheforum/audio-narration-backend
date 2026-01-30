import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsUUID,
  IsDateString,
  IsString,
  IsOptional,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Create Appointment DTO
 *
 * Data structure for creating a new appointment
 */
export class CreateAppointmentDto {
  @ApiProperty({
    description: 'Patient account ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty({ message: 'Patient ID is required' })
  @IsUUID('4', { message: 'Invalid patient ID format' })
  patientId: string;

  @ApiProperty({
    description: 'Clinic account ID',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsNotEmpty({ message: 'Clinic ID is required' })
  @IsUUID('4', { message: 'Invalid clinic ID format' })
  clinicId: string;

  @ApiProperty({
    description: 'Doctor account ID (optional)',
    example: '123e4567-e89b-12d3-a456-426614174002',
    required: false,
  })
  @IsOptional()
  @IsUUID('4', { message: 'Invalid doctor ID format' })
  doctorId?: string;

  @ApiProperty({
    description: 'Doctor shift hour ID (optional)',
    example: '123e4567-e89b-12d3-a456-426614174003',
    required: false,
  })
  @IsOptional()
  @IsUUID('4', { message: 'Invalid doctor shift hour ID format' })
  doctorShiftHourId?: string;

  @ApiProperty({
    description: 'Appointment date (YYYY-MM-DD)',
    example: '2026-01-25',
  })
  @IsNotEmpty({ message: 'Appointment date is required' })
  @IsDateString({}, { message: 'Invalid date format. Use YYYY-MM-DD' })
  appointmentDate: string;

  @ApiProperty({
    description: 'Appointment hour (ISO 8601 format)',
    example: '2026-01-25T09:00:00.000Z',
  })
  @IsNotEmpty({ message: 'Appointment hour is required' })
  @IsDateString({}, { message: 'Invalid datetime format' })
  appointmentHour: string;

  @ApiProperty({
    description: 'Extra hour if applicable (ISO 8601 format)',
    example: '2026-01-25T10:00:00.000Z',
    required: false,
  })
  @IsOptional()
  @IsDateString({}, { message: 'Invalid datetime format' })
  extraHour?: string;

  @ApiProperty({
    description: 'Total amount for the appointment',
    example: 500000,
  })
  @IsNotEmpty({ message: 'Total amount is required' })
  total: number;

  @ApiProperty({
    description: 'Patient note or reason for visit',
    example: 'I have a headache and fever',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Patient note must be a string' })
  @MaxLength(1000, { message: 'Patient note must not exceed 1000 characters' })
  @Transform(({ value }) => value?.trim())
  patientNote?: string;
}
