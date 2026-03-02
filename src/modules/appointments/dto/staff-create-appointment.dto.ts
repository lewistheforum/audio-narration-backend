import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsUUID,
  IsDateString,
  IsString,
  IsOptional,
  MaxLength,
  IsArray,
  ArrayMinSize,
  IsNumber,
  Min,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

/**
 * Service Item DTO
 *
 * Represents a clinic service to be included in the appointment
 */
export class ServiceItemDto {
  @ApiProperty({
    description: 'Clinic service config ID (UUID format)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsNotEmpty({ message: 'Service ID is required' })
  @IsUUID('4', { message: 'Service ID must be a valid UUID (e.g., 550e8400-e29b-41d4-a716-446655440000)' })
  clinicServiceId: string;
}

/**
 * Staff Create Appointment DTO
 *
 * Data structure for staff creating an appointment for a patient
 * This will create records in 3 tables: appointments, appointment_package, service_appointments
 */
export class StaffCreateAppointmentDto {
  @ApiProperty({
    description: 'Patient account ID (existing patient in system)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty({ message: 'Patient ID is required' })
  @IsUUID('4', { message: 'Invalid patient ID format' })
  patientId: string;

  @ApiProperty({
    description: 'Doctor account ID (optional - can be assigned later)',
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
    example: '2026-01-26',
  })
  @IsNotEmpty({ message: 'Appointment date is required' })
  @IsDateString({}, { message: 'Invalid date format. Use YYYY-MM-DD' })
  appointmentDate: string;

  @ApiProperty({
    description: 'Appointment hour (ISO 8601 format)',
    example: '2026-01-26T09:00:00.000Z',
  })
  @IsNotEmpty({ message: 'Appointment hour is required' })
  @IsDateString({}, { message: 'Invalid datetime format' })
  appointmentHour: string;

  @ApiProperty({
    description: 'Extra hour if applicable (ISO 8601 format)',
    example: '2026-01-26T10:00:00.000Z',
    required: false,
  })
  @IsOptional()
  @IsDateString({}, { message: 'Invalid datetime format' })
  @Transform(({ value }) => (value === '' ? null : value))
  extraHour?: string;

  @ApiProperty({
    description: 'List of clinic services for this appointment',
    type: [ServiceItemDto],
    example: [
      { clinicServiceId: '123e4567-e89b-12d3-a456-426614174010' },
      { clinicServiceId: '123e4567-e89b-12d3-a456-426614174011' },
    ],
  })
  @IsNotEmpty({ message: 'Services list is required' })
  @IsArray({ message: 'Services must be an array' })
  @ArrayMinSize(1, { message: 'At least one service is required' })
  @ValidateNested({ each: true })
  @Type(() => ServiceItemDto)
  services: ServiceItemDto[];

  @ApiProperty({
    description: 'Total amount for all services (optional - will be auto-calculated from services if not provided). Leave empty to auto-calculate.',
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Total must be a number' })
  @Min(0, { message: 'Total must be a positive number' })
  total?: number;

  @ApiProperty({
    description: 'Transaction ID for payment (optional - can be created later). Leave empty if payment not yet processed.',
    required: false,
  })
  @IsOptional()
  @IsUUID('4', { message: 'Invalid transaction ID format' })
  @Transform(({ value }) => (value === '' ? null : value))
  transactionId?: string;

  @ApiProperty({
    description: 'Payment status (e.g., PAID, PENDING, UNPAID). Leave empty if not applicable.',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Payment status must be a string' })
  paymentStatus?: string;

  @ApiProperty({
    description: 'Payment type (CASH, CARD, TRANSFER, etc.). Leave empty if not applicable.',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Payment type must be a string' })
  paymentType?: string;

  @ApiProperty({
    description: 'Staff note or patient note for the appointment. Leave empty if no special notes.',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Patient note must be a string' })
  @MaxLength(1000, { message: 'Patient note must not exceed 1000 characters' })
  @Transform(({ value }) => value?.trim())
  patientNote?: string;
}
