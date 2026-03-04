import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsBoolean, IsString, IsInt, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';

/**
 * Get Clinic Services Query DTO
 *
 * Query parameters for retrieving clinic services
 */
export class GetClinicServicesQueryDto {
  @ApiProperty({
    description: 'Clinic ID (optional - auto-detected from staff JWT if not provided)',
    example: '123e4567-e89b-12d3-a456-426614174010',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Clinic ID must be a string' })
  clinicId?: string;

  @ApiProperty({
    description: 'Filter by active status (default: true)',
    example: true,
    required: false,
    default: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean({ message: 'isActive must be a boolean' })
  isActive?: boolean = true;

  @ApiProperty({
    description: 'Search by service name (fuzzy search)',
    example: 'Khám',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Search must be a string' })
  @Transform(({ value }) => value?.trim())
  search?: string;

  @ApiProperty({
    description: 'Page number (default: 1)',
    example: 1,
    required: false,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Page must be an integer' })
  @Min(1, { message: 'Page must be at least 1' })
  page?: number = 1;

  @ApiProperty({
    description: 'Items per page (default: 50, max: 100)',
    example: 50,
    required: false,
    default: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Limit must be an integer' })
  @Min(1, { message: 'Limit must be at least 1' })
  @Max(100, { message: 'Limit must not exceed 100' })
  limit?: number = 50;
}
