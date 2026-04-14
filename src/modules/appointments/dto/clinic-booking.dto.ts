import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsInt,
  Min,
  IsString,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Query DTO for GET /api/patients/clinics
 * Option 3: Date-first booking - Step 2a
 */
export class QueryClinicsDto {
  @ApiProperty({
    description: 'Working date to filter clinics (YYYY-MM-DD format)',
    example: '2026-02-25',
    required: true,
  })
  @IsDateString({}, { message: 'Invalid working date format. Use YYYY-MM-DD' })
  working_date: string;

  @ApiProperty({
    description: 'Page number for pagination',
    example: 1,
    default: 1,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Number of items per page',
    example: 20,
    default: 20,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiProperty({
    description: 'Search by clinic name',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    description: 'Filter by district',
    required: false,
  })
  @IsOptional()
  @IsString()
  district?: string;
}

/**
 * Clinic Response DTO for GET /api/patients/clinics
 */
export class ClinicItemDto {
  @ApiProperty({
    description: 'Clinic account ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  clinic_id: string;

  @ApiProperty({
    description: 'Clinic name',
    example: 'Medicare Multi-Choice Clinic',
  })
  clinic_name: string;

  @ApiProperty({
    description: 'Clinic address',
    example: '123 Main Street, District 1, Ho Chi Minh City',
  })
  clinic_address: string;

  @ApiProperty({
    description: 'District',
    example: 'District 1',
    nullable: true,
  })
  district: string | null;

  @ApiProperty({
    description: 'Number of available slots on the working date',
    example: 15,
  })
  available_slots: number;

  @ApiProperty({
    description: 'Number of available doctors on the working date',
    example: 3,
  })
  available_doctors: number;
}

/**
 * Paginated Clinics Response DTO
 */
export class PaginatedClinicsResponseDto {
  @ApiProperty({
    type: [ClinicItemDto],
    description: 'Array of clinics',
  })
  data: ClinicItemDto[];

  @ApiProperty({
    description: 'Total number of clinics',
    example: 45,
  })
  total: number;

  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Number of items per page',
    example: 20,
  })
  limit: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 3,
  })
  total_pages: number;
}

/**
 * Update Session DTO for Option 3 - Step 2: Adding clinic
 */
export class UpdateSessionOption3Step2Dto {
  @ApiProperty({
    description: 'Clinic ID',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsString()
  clinic_id: string;
}

/**
 * Update Session DTO for Option 3 - Step 3: Adding service
 */
export class UpdateSessionOption3Step3Dto {
  @ApiProperty({
    description: 'Clinic service config ID',
    example: '123e4567-e89b-12d3-a456-426614174002',
  })
  @IsString()
  clinic_service_config_id: string;
}

/**
 * Update Session DTO for Option 3 - Step 4: Adding slot and doctor
 */
export class UpdateSessionOption3Step4Dto {
  @ApiProperty({
    description: 'Clinic shift hour ID (time slot)',
    example: '123e4567-e89b-12d3-a456-426614174003',
  })
  @IsString()
  clinic_shift_hour_id: string;

  @ApiProperty({
    description: 'Doctor ID',
    example: '123e4567-e89b-12d3-a456-426614174004',
  })
  @IsString()
  doctor_id: string;
}
