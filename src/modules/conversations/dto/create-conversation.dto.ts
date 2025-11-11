import {
  IsString,
  IsOptional,
  IsUUID,
  MaxLength,
  IsArray,
  ArrayNotEmpty,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateConversationDto {
  @ApiProperty({
    description: 'Title of the conversation',
    example: 'Medical Consultation',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiProperty({
    description: 'Description of the conversation',
    example: 'Discussion about patient symptoms and treatment options',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'List of participant IDs in the conversation',
    example: [
      '123e4567-e89b-12d3-a456-426614174000',
      '223e4567-e89b-12d3-a456-426614174001',
    ],
    required: true,
    isArray: true,
    type: String,
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  participants: string[];

  @ApiProperty({
    description: 'ID of the user creating the conversation',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: true,
  })
  @IsOptional()
  @IsUUID()
  createdUserId: string;

  // @ApiProperty({
  //   description: 'ID of the user creating the conversation',
  //   example: '123e4567-e89b-12d3-a456-426614174000',
  // })
  // @IsUUID()
  // userId: string;
}
