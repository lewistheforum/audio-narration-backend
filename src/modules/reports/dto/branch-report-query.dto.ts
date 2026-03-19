import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsDateString, IsEnum } from 'class-validator';

export enum ReportPeriod {
  DAY = 'day',
  MONTH = 'month',
  YEAR = 'year',
}

export class BranchReportQueryDto {
  @ApiPropertyOptional({ description: 'Start date (YYYY-MM-DD)', example: '2026-03-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date (YYYY-MM-DD)', example: '2026-03-31' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Grouping period',
    enum: ReportPeriod,
    default: ReportPeriod.DAY,
  })
  @IsOptional()
  @IsEnum(ReportPeriod)
  period?: ReportPeriod = ReportPeriod.DAY;

  @ApiPropertyOptional({ description: 'Specific date for doctor feedback report (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  date?: string;
}
