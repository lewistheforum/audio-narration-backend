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
    description: 'Clinic service config ID',
    example: '123e4567-e89b-12d3-a456-426614174010',
  })
  @IsNotEmpty({ message: 'Service ID is required' })
  @IsUUID('4', { message: 'Invalid service ID format' })
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
    description: 'Total amount for all services',
    example: 500000,
  })
  @IsNotEmpty({ message: 'Total amount is required' })
  @IsNumber({}, { message: 'Total must be a number' })
  @Min(0, { message: 'Total must be a positive number' })
  total: number;

  @ApiProperty({
    description: 'Transaction ID for payment',
    example: '123e4567-e89b-12d3-a456-426614174020',
  })
  @IsNotEmpty({ message: 'Transaction ID is required' })
  @IsUUID('4', { message: 'Invalid transaction ID format' })
  transactionId: string;

  @ApiProperty({
    description: 'Payment status',
    example: 'PAID',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Payment status must be a string' })
  paymentStatus?: string;

  @ApiProperty({
    description: 'Payment type (CASH, CARD, TRANSFER, etc.)',
    example: 'CASH',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Payment type must be a string' })
  paymentType?: string;

  @ApiProperty({
    description: 'Staff note or patient note for the appointment',
    example: 'Patient has headache and fever',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Patient note must be a string' })
  @MaxLength(1000, { message: 'Patient note must not exceed 1000 characters' })
  @Transform(({ value }) => value?.trim())
  patientNote?: string;
}
