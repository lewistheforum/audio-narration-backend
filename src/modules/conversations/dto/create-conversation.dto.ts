import {
  IsString,
  IsOptional,
  IsUUID,
  MaxLength,
  IsArray,
  ArrayNotEmpty,
  ArrayMinSize,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class CreateConversationDto {
  @ApiProperty({
    description: 'Conversation title',
    example: 'Medical Consultation',
    required: false,
    maxLength: 255,
  })
  @IsOptional()
  @IsString({ message: 'Title must be a string' })
  @MaxLength(255, { message: 'Title must not exceed 255 characters' })
  @Transform(({ value }) => value?.trim())
  title?: string;

  @ApiProperty({
    description: 'Conversation description',
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
    description: 'List of participant user IDs (minimum 2)',
    example: [
      '123e4567-e89b-12d3-a456-426614174000',
      '223e4567-e89b-12d3-a456-426614174001',
    ],
    isArray: true,
    type: String,
  })
  @IsNotEmpty({ message: 'Participants list is required' })
  @IsArray({ message: 'Participants must be an array' })
  @ArrayNotEmpty({ message: 'Participants list cannot be empty' })
  @ArrayMinSize(2, { message: 'At least 2 participants are required' })
  @IsUUID('4', {
    each: true,
    message: 'Each participant ID must be a valid UUID',
  })
  participants: string[];

  @ApiProperty({
    description: 'User ID creating the conversation',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsOptional()
  @IsUUID('4', { message: 'Created user ID must be a valid UUID' })
  createdUserId?: string;
}
