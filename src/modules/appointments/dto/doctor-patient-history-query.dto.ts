import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsInt, Min, IsString, IsEnum } from 'class-validator';

export enum DoctorPatientSortBy {
  LAST_VISIT_DATE = 'last_visit_date',
  PATIENT_NAME = 'patient_name',
  TOTAL_VISITS = 'total_visits',
}

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

/**
 * Doctor Patient History Query DTO
 *
 * Query parameters for GET /api/doctors/me/patients
 * Used by doctors to view their patient history
 */
export class DoctorPatientHistoryQueryDto {
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
    example: 20,
    default: 20,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Search by patient name, phone, or email',
    example: 'Nguyễn Văn A',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Sort by field',
    enum: DoctorPatientSortBy,
    default: DoctorPatientSortBy.LAST_VISIT_DATE,
  })
  @IsOptional()
  @IsEnum(DoctorPatientSortBy)
  sort_by?: DoctorPatientSortBy = DoctorPatientSortBy.LAST_VISIT_DATE;

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: SortOrder,
    default: SortOrder.DESC,
  })
  @IsOptional()
  @IsEnum(SortOrder)
  order?: SortOrder = SortOrder.DESC;
}
