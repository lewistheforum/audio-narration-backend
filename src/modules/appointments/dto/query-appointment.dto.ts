import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsDateString, IsNumber, Min, IsIn } from 'class-validator';
import { Transform } from 'class-transformer';
import { AppointmentStatus } from '../enums';

/**
 * Appointment Tab Filter Enum
 */
export enum AppointmentTab {
  UPCOMING = 'UPCOMING',
  HISTORY = 'HISTORY',
}

/**
 * Query Appointment DTO
 *
 * Used for filtering and pagination when viewing appointments
 */
export class QueryAppointmentDto {
  @ApiPropertyOptional({
    description: 'Filter appointments by tab (UPCOMING or HISTORY). UPCOMING: active appointments with future dates. HISTORY: completed, cancelled, or past appointments.',
    enum: AppointmentTab,
    example: AppointmentTab.UPCOMING,
  })
  @IsOptional()
  @IsEnum(AppointmentTab, { message: 'Tab must be either UPCOMING or HISTORY' })
  tab?: AppointmentTab;

  @ApiPropertyOptional({
    description: 'Filter by appointment status (overrides tab filter if provided)',
    enum: AppointmentStatus,
  })
  @IsOptional()
  @IsEnum(AppointmentStatus, { message: 'Invalid appointment status' })
  status?: AppointmentStatus;

  @ApiPropertyOptional({
    description: 'Filter by appointment date (YYYY-MM-DD)',
    example: '2026-03-15',
  })
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsDateString({}, { message: 'Invalid date format. Use YYYY-MM-DD' })
  appointmentDate?: string;

  @ApiPropertyOptional({
    description: 'Page number for pagination',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber({}, { message: 'Page must be a number' })
  @Min(1, { message: 'Page must be at least 1' })
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 10,
    default: 10,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber({}, { message: 'Limit must be a number' })
  @Min(1, { message: 'Limit must be at least 1' })
  limit?: number = 10;
}
