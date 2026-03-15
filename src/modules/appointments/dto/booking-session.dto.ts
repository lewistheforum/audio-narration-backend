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
  IsIn,
  IsISO8601,
  IsArray,
  ArrayMinSize,
  ArrayUnique,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Booking Option Enum
 *
 * Defines the four booking flows supported by the system
 */
export enum BookingOption {
  SERVICE = 'service',
  DOCTOR = 'doctor',
  DATE = 'date',
  OUT_OF_HOURS = 'out_of_hours',
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
 * Initial Data DTO for Out-of-Hours Booking (Option 4)
 */
export class OutOfHoursInitialDataDto {
  @ApiProperty({
    description: 'Clinic ID',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsOptional()
  @IsUUID('4', { message: 'Invalid clinic ID format' })
  clinic_id?: string;
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
  @IsEnum(BookingOption, { message: 'Invalid booking option. Must be: service, doctor, date, or out_of_hours' })
  booking_option: BookingOption;

  @ApiProperty({
    description: 'Initial data for the selected booking option',
    oneOf: [
      { $ref: '#/components/schemas/ServiceInitialDataDto' },
      { $ref: '#/components/schemas/DoctorInitialDataDto' },
      { $ref: '#/components/schemas/DateInitialDataDto' },
      { $ref: '#/components/schemas/OutOfHoursInitialDataDto' },
    ],
  })
  @IsNotEmpty({ message: 'Initial data is required' })
  @IsObject({ message: 'Initial data must be an object' })
  initial_data: ServiceInitialDataDto | DoctorInitialDataDto | DateInitialDataDto | OutOfHoursInitialDataDto;
}

/**
 * Update Data DTO for Step 2 (VERSION 4.6 - FIXED)
 * 
 * - Option 1 (service-first): appointment_date + clinic_shift_hour_id + doctor_id
 * - Option 2 (doctor-first): appointment_date + clinic_shift_hour_id
 * - Option 3 (date-first): clinic_id
 * - Option 4 (out-of-hours): appointment_date + extra_hour
 */
export class UpdateSessionStep2Dto {
  @ApiProperty({
    description: 'Appointment date in YYYY-MM-DD format (Option 1, 2 & 4)',
    example: '2026-03-09',
    required: false,
  })
  @IsOptional()
  @IsDateString({}, { message: 'Invalid date format. Use YYYY-MM-DD' })
  appointment_date?: string;

  @ApiProperty({
    description: 'Clinic shift hour ID (time slot) (Option 1 & 2)',
    example: '123e4567-e89b-12d3-a456-426614174003',
    required: false,
  })
  @IsOptional()
  @IsUUID('4', { message: 'Invalid clinic shift hour ID format' })
  clinic_shift_hour_id?: string;

  @ApiProperty({
    description: 'Doctor ID (Option 1 only)',
    example: '123e4567-e89b-12d3-a456-426614174002',
    required: false,
  })
  @IsOptional()
  @IsUUID('4', { message: 'Invalid doctor ID format' })
  doctor_id?: string;

  @ApiProperty({
    description: 'Appointment hour (ISO 8601 format) (Option 1 & 2)',
    example: '2026-03-09T08:00:00.000Z',
    required: false,
  })
  @IsOptional()
  @IsDateString({}, { message: 'Invalid datetime format for appointment_hour' })
  appointment_hour?: string;

  @ApiProperty({
    description: 'Clinic ID (Option 3 only - date-first flow)',
    example: '123e4567-e89b-12d3-a456-426614174001',
    required: false,
  })
  @IsOptional()
  @IsUUID('4', { message: 'Invalid clinic ID format' })
  clinic_id?: string;

  @ApiProperty({
    description: 'Extra hour timestamp in ISO 8601 format with timezone (Option 4 only - out-of-hours)',
    example: '2026-03-15T14:30:00+07:00',
    required: false,
  })
  @IsOptional()
  @IsISO8601({}, { message: 'Extra hour must be a valid ISO 8601 timestamp with timezone' })
  extra_hour?: string;
}

/**
 * Update Data DTO for Step 3 (VERSION 5.0 - Multi-Service)
 * 
 * - Option 1 (service-first): payment_method
 * - Option 2 (doctor-first): service_ids (ARRAY of clinic_service_config_id)
 * - Option 3 (date-first): clinic_shift_hour_id + doctor_id (V4.6 - MOVED UP)
 */
export class UpdateSessionStep3Dto {
  @ApiProperty({
    description: 'Array of Clinic Service Config IDs (Option 2 - multi-service)',
    type: [String],
    example: [
      '123e4567-e89b-12d3-a456-426614174005',
      '223e4567-e89b-12d3-a456-426614174006',
    ],
    required: false,
  })
  @IsOptional()
  @IsArray({ message: 'service_ids must be an array' })
  @ArrayMinSize(1, { message: 'service_ids must contain at least one service' })
  @ArrayUnique({ message: 'service_ids must not contain duplicate IDs' })
  @IsUUID('4', { each: true, message: 'Each service_id must be a valid UUID v4' })
  service_ids?: string[];

  @ApiProperty({
    description: 'Payment method - COD or ONLINE (Option 1 only)',
    enum: ['cod', 'online'],
    example: 'cod',
    required: false,
  })
  @IsOptional()
  @IsIn(['cod', 'online'], { message: 'Payment method must be either "cod" or "online"' })
  payment_method?: 'cod' | 'online';

  @ApiProperty({
    description: 'Clinic shift hour ID (Option 3 only - V4.6)',
    example: '123e4567-e89b-12d3-a456-426614174003',
    required: false,
  })
  @IsOptional()
  @IsUUID('4', { message: 'Invalid clinic shift hour ID format' })
  clinic_shift_hour_id?: string;

  @ApiProperty({
    description: 'Doctor ID (Option 3 only - V4.6)',
    example: '123e4567-e89b-12d3-a456-426614174002',
    required: false,
  })
  @IsOptional()
  @IsUUID('4', { message: 'Invalid doctor ID format' })
  doctor_id?: string;

  @ApiProperty({
    description: 'Appointment hour (ISO 8601 format) (Option 3 only - V4.6)',
    example: '2026-03-09T08:00:00.000Z',
    required: false,
  })
  @IsOptional()
  @IsDateString({}, { message: 'Invalid datetime format for appointment_hour' })
  appointment_hour?: string;
}

/**
 * Update Data DTO for Step 4 (VERSION 5.0 - Multi-Service)
 * 
 * - Option 1 (service-first): patient_note (optional)
 * - Option 2 (doctor-first): payment_method (REQUIRED)
 * - Option 3 (date-first): service_ids (ARRAY - V5.0 multi-service)
 */
export class UpdateSessionStep4Dto {
  @ApiProperty({
    description: 'Payment method (Option 2 only)',
    enum: ['cod', 'online'],
    example: 'cod',
    required: false,
  })
  @IsOptional()
  @IsIn(['cod', 'online'], { message: 'Payment method must be either "cod" or "online"' })
  payment_method?: 'cod' | 'online';

  @ApiProperty({
    description: 'Patient note (Option 1 only)',
    example: 'Patient has neck and shoulder pain for 1 week',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Patient note must be a string' })
  @MaxLength(500, { message: 'Patient note cannot exceed 500 characters' })
  patient_note?: string;

  @ApiProperty({
    description: 'Array of Clinic Service Config IDs (Option 3 - V5.0 multi-service)',
    type: [String],
    example: [
      '123e4567-e89b-12d3-a456-426614174005',
      '223e4567-e89b-12d3-a456-426614174006',
    ],
    required: false,
  })
  @IsOptional()
  @IsArray({ message: 'service_ids must be an array' })
  @ArrayMinSize(1, { message: 'service_ids must contain at least one service' })
  @ArrayUnique({ message: 'service_ids must not contain duplicate IDs' })
  @IsUUID('4', { each: true, message: 'Each service_id must be a valid UUID v4' })
  service_ids?: string[];
}

/**
 * Update Data DTO for Step 5 (VERSION 4.4)
 * 
 * - Option 2 (doctor-first): patient_note (optional)
 * - Option 3 (date-first): payment_method + patient_note
 */
export class UpdateSessionStep5Dto {
  @ApiProperty({
    description: 'Payment method (for Option 3)',
    enum: ['cod', 'online'],
    example: 'cod',
    required: false,
  })
  @IsOptional()
  @IsIn(['cod', 'online'], { message: 'Payment method must be either "cod" or "online"' })
  payment_method?: 'cod' | 'online';

  @ApiProperty({
    description: 'Patient note (for Option 2 and Option 3)',
    example: 'Patient has neck and shoulder pain for 1 week',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Patient note must be a string' })
  @MaxLength(500, { message: 'Patient note cannot exceed 500 characters' })
  patient_note?: string;
}

/**
 * Update Booking Session DTO (VERSION 4.4)
 *
 * Request body for PATCH /api/patients/booking-sessions/:sessionId
 * 
 * IMPORTANT CHANGES:
 * - Option 1: Step range 2-4 (unchanged)
 * - Option 2: Step range 2-5 (SEPARATED schedule and services)
 * - Option 3: Step range 2-5 (unchanged)
 */
export class UpdateBookingSessionDto {
  @ApiProperty({
    description: 'Current step number (2, 3, 4, or 5)',
    example: 2,
    enum: [2, 3, 4, 5],
  })
  @IsNotEmpty({ message: 'Step is required' })
  step: 2 | 3 | 4 | 5;

  @ApiProperty({
    description: 'Data to update based on step',
    oneOf: [
      { $ref: '#/components/schemas/UpdateSessionStep2Dto' },
      { $ref: '#/components/schemas/UpdateSessionStep3Dto' },
      { $ref: '#/components/schemas/UpdateSessionStep4Dto' },
      { $ref: '#/components/schemas/UpdateSessionStep5Dto' },
    ],
  })
  @IsNotEmpty({ message: 'Data is required' })
  @IsObject({ message: 'Data must be an object' })
  data: UpdateSessionStep2Dto | UpdateSessionStep3Dto | UpdateSessionStep4Dto | UpdateSessionStep5Dto;
}

/**
 * Create Appointment from Session DTO
 *
 * VERSION 4.0: Simplified request body - only session_id is required.
 * Payment method is already stored in the session (added in Step 4).
 */
export class CreateAppointmentFromSessionDto {
  @ApiProperty({
    description: 'Booking session ID',
    example: '123e4567-e89b-12d3-a456-426614174004',
  })
  @IsNotEmpty({ message: 'Session ID is required' })
  @IsUUID('4', { message: 'Invalid session ID format' })
  session_id: string;
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
    description: 'Session expiration timestamp (ISO 8601 with Vietnam timezone +07:00)',
    example: '2026-03-10T21:30:00.000+07:00',
  })
  expires_at: string;

  @ApiProperty({
    description: 'Booking data accumulated so far',
    example: {
      clinic_service_config_id: '123e4567-e89b-12d3-a456-426614174000',
      clinic_id: '123e4567-e89b-12d3-a456-426614174001',
    },
  })
  booking_data: Record<string, any>;
}
