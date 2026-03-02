import { IsInt, IsOptional, IsUUID, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * Query DTO for Year-Based Statistics
 *
 * Used for endpoints that filter by year only
 */
export class YearQueryDto {
  @ApiProperty({
    description: 'Year to filter statistics',
    example: 2025,
    minimum: 2020,
    maximum: 2100,
  })
  @Type(() => Number)
  @IsInt({ message: 'Year must be an integer' })
  @Min(2020, { message: 'Year must be at least 2020' })
  @Max(2100, { message: 'Year must be at most 2100' })
  year: number;

  @ApiPropertyOptional({
    description:
      'Service ID to filter (optional, all services if not provided)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'Service ID must be a valid UUID' })
  serviceId?: string;
}

/**
 * Query DTO for Month-Based Statistics
 *
 * Used for endpoints that filter by year and month
 */
export class MonthQueryDto {
  @ApiProperty({
    description: 'Year to filter statistics',
    example: 2025,
    minimum: 2020,
    maximum: 2100,
  })
  @Type(() => Number)
  @IsInt({ message: 'Year must be an integer' })
  @Min(2020, { message: 'Year must be at least 2020' })
  @Max(2100, { message: 'Year must be at most 2100' })
  year: number;

  @ApiProperty({
    description: 'Month to filter statistics (1-12)',
    example: 5,
    minimum: 1,
    maximum: 12,
  })
  @Type(() => Number)
  @IsInt({ message: 'Month must be an integer' })
  @Min(1, { message: 'Month must be at least 1' })
  @Max(12, { message: 'Month must be at most 12' })
  month: number;

  @ApiPropertyOptional({
    description:
      'Service ID to filter (optional, all services if not provided)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'Service ID must be a valid UUID' })
  serviceId?: string;
}

/**
 * Query DTO for Service-Based Year Statistics
 *
 * Used for endpoints filtering by year without service filter
 */
export class ServiceYearQueryDto {
  @ApiProperty({
    description: 'Year to filter statistics',
    example: 2025,
    minimum: 2020,
    maximum: 2100,
  })
  @Type(() => Number)
  @IsInt({ message: 'Year must be an integer' })
  @Min(2020, { message: 'Year must be at least 2020' })
  @Max(2100, { message: 'Year must be at most 2100' })
  year: number;
}

/**
 * Query DTO for Service-Based Month Statistics
 *
 * Used for endpoints filtering by year and month without service filter
 */
export class ServiceMonthQueryDto {
  @ApiProperty({
    description: 'Year to filter statistics',
    example: 2025,
    minimum: 2020,
    maximum: 2100,
  })
  @Type(() => Number)
  @IsInt({ message: 'Year must be an integer' })
  @Min(2020, { message: 'Year must be at least 2020' })
  @Max(2100, { message: 'Year must be at most 2100' })
  year: number;

  @ApiProperty({
    description: 'Month to filter statistics (1-12)',
    example: 5,
    minimum: 1,
    maximum: 12,
  })
  @Type(() => Number)
  @IsInt({ message: 'Month must be an integer' })
  @Min(1, { message: 'Month must be at least 1' })
  @Max(12, { message: 'Month must be at most 12' })
  month: number;
}

/**
 * Query DTO for Clinic ID Based Statistics
 *
 * Used for endpoints that filter by clinic ID
 */
export class ClinicIdQueryDto {
  @ApiProperty({
    description: 'Clinic Admin Account ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID('4', { message: 'Clinic ID must be a valid UUID' })
  clinicId: string;
}
