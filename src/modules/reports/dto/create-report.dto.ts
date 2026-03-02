import { IsEnum, IsNotEmpty, IsOptional, IsArray, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ReportType } from '../enums';

/**
 * DTO for creating a new report
 */
export class CreateReportDto {
  @ApiProperty({
    description: 'Type of the report',
    enum: ReportType,
    example: ReportType.BUG,
  })
  @IsEnum(ReportType, { message: 'report_type must be a valid ReportType enum value' })
  @IsNotEmpty({ message: 'report_type is required' })
  reportType: ReportType;

  @ApiProperty({
    description: 'Detailed description of the report',
    example: 'The application crashes when I try to book an appointment',
  })
  @IsString({ message: 'description must be a string' })
  @IsNotEmpty({ message: 'description is required' })
  description: string;

  @ApiProperty({
    description: 'Array of image URLs related to the report',
    type: [String],
    required: false,
    example: ['https://example.com/screenshot1.png', 'https://example.com/screenshot2.png'],
  })
  @IsArray({ message: 'report_images must be an array' })
  @IsString({ each: true, message: 'Each report_image must be a string' })
  @IsOptional()
  reportImages?: string[];
}
