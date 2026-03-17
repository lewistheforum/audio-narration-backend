import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsUUID, IsDateString, IsString, IsNumber, Min } from 'class-validator';

/**
 * DTO for querying doctors list (Option 2: Step 1a)
 */
export class QueryDoctorsDto {
  @ApiProperty({
    description: 'Page number for pagination',
    example: 1,
    required: false,
    default: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Number of items per page',
    example: 20,
    required: false,
    default: 20,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number = 20;

  @ApiProperty({
    description: 'Search by doctor full name',
    example: 'Nguyễn Văn',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    description: 'Filter by specialization',
    example: 'Bác sĩ Xương Khớp',
    required: false,
  })
  @IsOptional()
  @IsString()
  specialization?: string;

  @ApiProperty({
    description: 'Filter by clinic UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsOptional()
  @IsUUID('4')
  clinic_id?: string;
}

/**
 * DTO for doctor response (Option 2: Step 1a)
 */
export class DoctorResponseDto {
  @ApiProperty({
    description: 'Doctor account UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  doctor_id: string;

  @ApiProperty({
    description: 'Doctor full name',
    example: 'BS. Nguyễn Văn A',
  })
  full_name: string;

  @ApiProperty({
    description: 'Doctor specialization',
    example: 'Bác sĩ Xương Khớp',
  })
  specialization: string;

  @ApiProperty({
    description: 'List of clinics where the doctor works',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        clinic_id: { type: 'string' },
        clinic_name: { type: 'string' },
        clinic_address: { type: 'string' },
      },
    },
  })
  clinics: Array<{
    clinic_id: string;
    clinic_name: string;
    clinic_address: string;
  }>;
}

/**
 * DTO for paginated doctors response
 */
export class PaginatedDoctorsResponseDto {
  @ApiProperty({
    description: 'Array of doctors',
    type: [DoctorResponseDto],
  })
  data: DoctorResponseDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    example: {
      total: 45,
      page: 1,
      limit: 20,
      total_pages: 3,
    },
  })
  meta: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
}

/**
 * DTO for doctor working days response (Option 2: Step 2a)
 */
export class DoctorWorkingDayDto {
  @ApiProperty({
    description: 'Working date in YYYY-MM-DD format',
    example: '2026-02-25',
  })
  date: string;

  @ApiProperty({
    description: 'Week day name in Vietnamese',
    example: 'THỨ BA',
  })
  week_day: string;

  @ApiProperty({
    description: 'Clinic UUID where doctor works on this date',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  clinic_id: string;

  @ApiProperty({
    description: 'Clinic name',
    example: 'Phòng khám ABC',
  })
  clinic_name: string;

  @ApiProperty({
    description: 'Number of available slots',
    example: 12,
  })
  available_slots: number;
}

/**
 * DTO for doctor available slots response (Option 2: Step 3a)
 */
export class DoctorSlotDto {
  @ApiProperty({
    description: 'Doctor shift hour UUID (time slot ID)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  doctor_shift_hour_id: string;

  @ApiProperty({
    description: 'Start time (HH:mm:ss)',
    example: '08:00:00',
  })
  start_time: string;

  @ApiProperty({
    description: 'End time (HH:mm:ss)',
    example: '08:30:00',
  })
  end_time: string;

  @ApiProperty({
    description: 'Maximum slots',
    example: 5,
  })
  limit: number;

  @ApiProperty({
    description: 'Available slots remaining',
    example: 3,
  })
  available_slots: number;

  @ApiProperty({
    description: 'Clinic room name',
    example: 'Phòng 101',
  })
  clinic_room: string;
}

/**
 * DTO for available service (Option 2: Step 3a)
 */
export class AvailableServiceDto {
  @ApiProperty({
    description: 'Clinic service config UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  clinic_service_config_id: string;

  @ApiProperty({
    description: 'Service UUID',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  service_id: string;

  @ApiProperty({
    description: 'Service name',
    example: 'Khám Xương Khớp',
  })
  service_name: string;

  @ApiProperty({
    description: 'Category name',
    example: 'Khám Chuyên Khoa',
  })
  category_name: string;

  @ApiProperty({
    description: 'Original price',
    example: 300000,
  })
  price: number;

  @ApiProperty({
    description: 'Discount percentage',
    example: 10,
  })
  discount: number;

  @ApiProperty({
    description: 'Final price after discount',
    example: 270000,
  })
  final_price: number;

  @ApiProperty({
    description: 'Service description',
    example: 'Khám và tư vấn về xương khớp',
  })
  description: string;
}

/**
 * DTO for doctor slots grouped by shift (Option 2: Step 3a)
 */
export class DoctorSlotsResponseDto {
  @ApiProperty({
    description: 'Array of slots grouped by shift',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        shift: {
          type: 'string',
          enum: ['MORNING', 'AFTERNOON', 'EVENING'],
        },
        slots: {
          type: 'array',
          items: { $ref: '#/components/schemas/DoctorSlotDto' },
        },
      },
    },
  })
  slots: Array<{
    shift: string;
    slots: DoctorSlotDto[];
  }>;

  @ApiProperty({
    description: 'Available services that the doctor can provide at this clinic',
    type: [AvailableServiceDto],
  })
  available_services: AvailableServiceDto[];
}

/**
 * Update Data DTO for Step 3 (Doctor-first flow) - Adding slot and service
 */
export class UpdateSessionStep3DoctorFlowDto {
  @ApiProperty({
    description: 'Doctor shift hour ID (time slot)',
    example: '123e4567-e89b-12d3-a456-426614174003',
  })
  @IsUUID('4', { message: 'Invalid doctor shift hour ID format' })
  doctor_shift_hour_id: string;

  @ApiProperty({
    description: 'Clinic service config ID (service selected)',
    example: '123e4567-e89b-12d3-a456-426614174004',
  })
  @IsUUID('4', { message: 'Invalid clinic service config ID format' })
  clinic_service_config_id: string;
}
