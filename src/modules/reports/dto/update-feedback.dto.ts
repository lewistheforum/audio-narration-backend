import { ApiProperty } from '@nestjs/swagger';
import {
  IsNumber,
  IsString,
  IsOptional,
  IsArray,
  Min,
  Max,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Update Feedback DTO
 *
 * DTO for updating an existing feedback.
 * Allows updating rating, description, and images.
 */
export class UpdateFeedbackDto {
  @ApiProperty({
    description: 'Rating for the feedback (1-5)',
    example: 5,
    minimum: 1,
    maximum: 5,
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Rating must be a number' })
  @Min(1, { message: 'Rating must be at least 1' })
  @Max(5, { message: 'Rating must not exceed 5' })
  rating?: number;

  @ApiProperty({
    description: 'Feedback description text',
    example: 'Updated description',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  @Transform(({ value }) => value?.trim())
  description?: string;

  @ApiProperty({
    description: 'Array of feedback image URLs',
    example: [
      'https://example.com/image1.jpg',
      'https://example.com/image2.jpg',
    ],
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'Feedback images must be an array' })
  @IsString({ each: true, message: 'Each feedback image must be a string URL' })
  feedbackImages?: string[];
}
