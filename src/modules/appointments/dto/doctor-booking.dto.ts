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
 * Update Data DTO for Step 3 (Doctor-first flow) - Adding slot and service
 */
export class UpdateSessionStep3DoctorFlowDto {
  @ApiProperty({
    description: 'Clinic shift hour ID (time slot)',
    example: '123e4567-e89b-12d3-a456-426614174003',
  })
  @IsUUID('4', { message: 'Invalid clinic shift hour ID format' })
  clinic_shift_hour_id: string;

  @ApiProperty({
    description: 'Clinic service config ID (service selected)',
    example: '123e4567-e89b-12d3-a456-426614174004',
  })
  @IsUUID('4', { message: 'Invalid clinic service config ID format' })
  clinic_service_config_id: string;
}
