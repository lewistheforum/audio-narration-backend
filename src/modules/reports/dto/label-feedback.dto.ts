import { IsString, IsOptional, MaxLength, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class LabelFeedbackDto {
  @ApiProperty({
    description: 'Feedback id',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: true,
    maxLength: 255,
  })
  @IsString({ message: 'Feedback id must be a string' })
  @MaxLength(255, { message: 'Feedback id must not exceed 255 characters' })
  @Transform(({ value }) => value?.trim())
  id: string;

  @ApiProperty({
    description: 'Feedback description',
    example: 'Discussion about patient symptoms and treatment options',
    required: false,
    maxLength: 1000,
  })
  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  @MaxLength(1000, { message: 'Description must not exceed 1000 characters' })
  @Transform(({ value }) => value?.trim())
  description?: string;

  @ApiProperty({
    description: 'List of feedback images',
    example: [
      'https://example.com/image1.jpg',
      'https://example.com/image2.jpg',
    ],
    isArray: true,
    type: String,
  })
  @IsArray({ message: 'Feedback images must be an array' })
  @IsOptional()
  feedback_images?: string[];
}
