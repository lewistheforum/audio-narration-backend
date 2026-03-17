import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsDateString, IsEnum } from 'class-validator';

export enum RevenueGroupBy {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
}

/**
 * Revenue Query Filter DTO
 *
 * Clean query parameters for filtering revenue data (date range and grouping)
 * Does NOT include managerId - that should be handled via path parameters
 */
export class ClinicRevenueFilterDto {
  @ApiProperty({
    description: 'Start date for revenue period (ISO 8601 format)',
    example: '2026-01-01',
    required: true,
  })
  @IsDateString(
    {},
    { message: 'startDate must be a valid ISO 8601 date string' },
  )
  startDate: string;

  @ApiProperty({
    description: 'End date for revenue period (ISO 8601 format)',
    example: '2026-03-31',
    required: true,
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
    example: RevenueGroupBy.DAY,
  })
  @IsOptional()
  @IsEnum(RevenueGroupBy, { message: 'groupBy must be day, week, or month' })
  groupBy?: RevenueGroupBy;
}
