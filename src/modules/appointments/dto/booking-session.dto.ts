import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsUUID,
  ValidateNested,
  IsDateString,
  IsString,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Booking Option Enum
 *
 * Defines the three booking flows supported by the system
 */
export enum BookingOption {
  SERVICE = 'service',
  DOCTOR = 'doctor',
  DATE = 'date',
}

/**
 * Initial Data DTO for Service-First Booking
 */
export class ServiceInitialDataDto {
  @ApiProperty({
    description: 'Clinic service configuration ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty({ message: 'Clinic service config ID is required for service-first booking' })
  @IsUUID('4', { message: 'Invalid clinic service config ID format' })
  clinic_service_config_id: string;

  @ApiProperty({
    description: 'Clinic ID',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsNotEmpty({ message: 'Clinic ID is required for service-first booking' })
  @IsUUID('4', { message: 'Invalid clinic ID format' })
  clinic_id: string;
}

/**
 * Initial Data DTO for Doctor-First Booking
 */
export class DoctorInitialDataDto {
  @ApiProperty({
    description: 'Doctor account ID',
    example: '123e4567-e89b-12d3-a456-426614174002',
  })
  @IsNotEmpty({ message: 'Doctor ID is required for doctor-first booking' })
  @IsUUID('4', { message: 'Invalid doctor ID format' })
  doctor_id: string;

  @ApiProperty({
    description: 'Clinic ID (optional if doctor works at multiple clinics)',
    example: '123e4567-e89b-12d3-a456-426614174001',
    required: false,
  })
  @IsOptional()
  @IsUUID('4', { message: 'Invalid clinic ID format' })
  clinic_id?: string;
}

/**
 * Initial Data DTO for Date-First Booking
 */
export class DateInitialDataDto {
  @ApiProperty({
    description: 'Appointment date in YYYY-MM-DD format',
    example: '2026-02-25',
  })
  @IsNotEmpty({ message: 'Appointment date is required for date-first booking' })
  @IsDateString({}, { message: 'Invalid date format. Use YYYY-MM-DD' })
  appointment_date: string;
}

/**
 * Create Booking Session DTO
 *
 * Request body for POST /api/patients/booking-sessions
 */
export class CreateBookingSessionDto {
  @ApiProperty({
    description: 'Booking option/flow type',
    enum: BookingOption,
    example: BookingOption.SERVICE,
  })
  @IsNotEmpty({ message: 'Booking option is required' })
  @IsEnum(BookingOption, { message: 'Invalid booking option. Must be: service, doctor, or date' })
  booking_option: BookingOption;

  @ApiProperty({
    description: 'Initial data for the selected booking option',
    oneOf: [
      { $ref: '#/components/schemas/ServiceInitialDataDto' },
      { $ref: '#/components/schemas/DoctorInitialDataDto' },
      { $ref: '#/components/schemas/DateInitialDataDto' },
    ],
  })
  @IsNotEmpty({ message: 'Initial data is required' })
  @IsObject({ message: 'Initial data must be an object' })
  initial_data: ServiceInitialDataDto | DoctorInitialDataDto | DateInitialDataDto;
}

/**
 * Update Data DTO for Step 2 - Adding appointment date
 */
export class UpdateSessionStep2Dto {
  @ApiProperty({
    description: 'Appointment date in YYYY-MM-DD format',
    example: '2026-02-25',
  })
  @IsNotEmpty({ message: 'Appointment date is required' })
  @IsDateString({}, { message: 'Invalid date format. Use YYYY-MM-DD' })
  appointment_date: string;
}

/**
 * Update Data DTO for Step 3 - Adding slot and doctor/service
 * 
 * For Service-first flow (Option 1): Provide doctor_shift_hour_id + doctor_id
 * For Doctor-first flow (Option 2): Provide doctor_shift_hour_id + clinic_service_config_id
 */
export class UpdateSessionStep3Dto {
  @ApiProperty({
    description: 'Doctor shift hour ID (time slot)',
    example: '123e4567-e89b-12d3-a456-426614174003',
  })
  @IsNotEmpty({ message: 'Doctor shift hour ID is required' })
  @IsUUID('4', { message: 'Invalid doctor shift hour ID format' })
  doctor_shift_hour_id: string;

  @ApiProperty({
    description: 'Doctor ID (required for service-first flow)',
    example: '123e4567-e89b-12d3-a456-426614174002',
    required: false,
  })
  @IsOptional()
  @IsUUID('4', { message: 'Invalid doctor ID format' })
  doctor_id?: string;

  @ApiProperty({
    description: 'Clinic service config ID (required for doctor-first flow)',
    example: '123e4567-e89b-12d3-a456-426614174005',
    required: false,
  })
  @IsOptional()
  @IsUUID('4', { message: 'Invalid clinic service config ID format' })
  clinic_service_config_id?: string;
}

/**
 * Update Data DTO for Step 4 - Adding patient note (optional)
 */
export class UpdateSessionStep4Dto {
  @ApiProperty({
    description: 'Patient note/reason for visit',
    example: 'Đau mỏi vai gáy từ 1 tuần nay',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Patient note must be a string' })
  @MaxLength(500, { message: 'Patient note cannot exceed 500 characters' })
  patient_note?: string;
}

/**
 * Update Booking Session DTO
 *
 * Request body for PATCH /api/patients/booking-sessions/:sessionId
 */
export class UpdateBookingSessionDto {
  @ApiProperty({
    description: 'Current step number (2, 3, or 4)',
    example: 2,
    enum: [2, 3, 4],
  })
  @IsNotEmpty({ message: 'Step is required' })
  step: 2 | 3 | 4;

  @ApiProperty({
    description: 'Data to update based on step',
    oneOf: [
      { $ref: '#/components/schemas/UpdateSessionStep2Dto' },
      { $ref: '#/components/schemas/UpdateSessionStep3Dto' },
      { $ref: '#/components/schemas/UpdateSessionStep4Dto' },
    ],
  })
  @IsNotEmpty({ message: 'Data is required' })
  @IsObject({ message: 'Data must be an object' })
  data: UpdateSessionStep2Dto | UpdateSessionStep3Dto | UpdateSessionStep4Dto;
}

/**
 * Create Appointment from Session DTO
 *
 * Simplified request body for POST /api/patients/appointments
 */
export class CreateAppointmentFromSessionDto {
  @ApiProperty({
    description: 'Booking session ID',
    example: '123e4567-e89b-12d3-a456-426614174004',
  })
  @IsNotEmpty({ message: 'Session ID is required' })
  @IsUUID('4', { message: 'Invalid session ID format' })
  session_id: string;

  @ApiProperty({
    description: 'Payment method (must be "online")',
    example: 'online',
    enum: ['online'],
  })
  @IsNotEmpty({ message: 'Payment method is required' })
  @IsEnum(['online'], { message: 'Payment method must be "online". COD is not supported.' })
  payment_method: 'online';
}

/**
 * Booking Session Response DTO
 *
 * Response structure for session creation/update operations
 */
export class BookingSessionResponseDto {
  @ApiProperty({
    description: 'Session ID (UUID)',
    example: '123e4567-e89b-12d3-a456-426614174004',
  })
  session_id: string;

  @ApiProperty({
    description: 'Booking option/flow type',
    example: 'service',
  })
  booking_option: string;

  @ApiProperty({
    description: 'Current step number',
    example: 1,
  })
  current_step: number;

  @ApiProperty({
    description: 'Session expiration timestamp',
    example: '2026-02-25T11:30:00.000Z',
  })
  expires_at: Date;

  @ApiProperty({
    description: 'Booking data accumulated so far',
    example: {
      clinic_service_config_id: '123e4567-e89b-12d3-a456-426614174000',
      clinic_id: '123e4567-e89b-12d3-a456-426614174001',
    },
  })
  booking_data: Record<string, any>;
}
