import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsInt, Min, IsEnum, IsDateString } from 'class-validator';

/**
 * Doctor Patient Appointments Query DTO
 *
 * Query parameters for GET /api/doctors/patients/{patient_id}
 * Used to filter patient's appointment history
 */
export class DoctorPatientAppointmentsQueryDto {
  @ApiPropertyOptional({
    description: 'Doctor Id ONLY use for role CLINIC STAFF',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  doctor_id?: string;

  @ApiPropertyOptional({
    description: 'Page number',
    example: 1,
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of records per page',
    example: 10,
    default: 10,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Filter by appointment status',
    enum: ['COMPLETED', 'CANCELLED', 'NO_SHOW', 'IN_PROGRESS', 'ALL'],
    default: 'COMPLETED',
  })
  @IsOptional()
  status?: string = 'COMPLETED';

  @ApiPropertyOptional({
    description: 'Filter from date (YYYY-MM-DD)',
    example: '2026-01-01',
  })
  @IsOptional()
  @IsDateString()
  from_date?: string;

  @ApiPropertyOptional({
    description: 'Filter to date (YYYY-MM-DD)',
    example: '2026-12-31',
  })
  @IsOptional()
  @IsDateString()
  to_date?: string;

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['ASC', 'DESC'],
    default: 'DESC',
  })
  @IsOptional()
  order?: 'ASC' | 'DESC' = 'DESC';
}
