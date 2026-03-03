import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsDateString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * AI Chat Service Improvement Request DTO
 *
 * Request payload for AI feedback analysis endpoint.
 * Accepts a clinic ID and optional date range to filter feedbacks.
 */
export class AiChatImvFeedbackRequestDto {
  @ApiProperty({
    description: 'Clinic ID to use',
    example: '123456789',
  })
  @IsNotEmpty({ message: 'Clinic ID is required' })
  @IsString({ message: 'Clinic ID must be a string' })
  clinicId: string;

  @ApiProperty({
    description: 'Start date to filter feedbacks (ISO 8601 format)',
    example: '2025-01-01',
    required: false,
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'Start date must be a valid ISO 8601 date string' },
  )
  startDate?: string;

  @ApiProperty({
    description: 'End date to filter feedbacks (ISO 8601 format)',
    example: '2025-12-31',
    required: false,
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'End date must be a valid ISO 8601 date string' },
  )
  endDate?: string;
}
