import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsUUID, IsDateString, IsEnum } from 'class-validator';

export enum RevenueGroupBy {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
}

/**
 * Clinic Revenue Filter DTO
 *
 * Query parameters for filtering revenue data with optional branch filtering
 */
export class ClinicRevenueFilterDto {
  @ApiProperty({
    description:
      'Filter by specific branch manager ID (optional, returns all branches if omitted)',
    required: false,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'managerId must be a valid UUID' })
  managerId?: string;

  @ApiProperty({
    description: 'Start date for revenue period (ISO 8601 format)',
    example: '2026-01-01',
  })
  @IsDateString(
    {},
    { message: 'startDate must be a valid ISO 8601 date string' },
  )
  startDate: string;

  @ApiProperty({
    description: 'End date for revenue period (ISO 8601 format)',
    example: '2026-03-31',
  })
  @IsDateString(
    {},
    { message: 'endDate must be a valid ISO 8601 date string' },
  )
  endDate: string;

  @ApiProperty({
    description: 'Group revenue trends by time period',
    enum: RevenueGroupBy,
    default: RevenueGroupBy.DAY,
    required: false,
  })
  @IsOptional()
  @IsEnum(RevenueGroupBy, { message: 'groupBy must be day, week, or month' })
  groupBy?: RevenueGroupBy;
}
