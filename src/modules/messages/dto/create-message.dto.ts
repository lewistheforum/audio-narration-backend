import {
  IsString,
  IsUUID,
  IsOptional,
  IsBoolean,
  MaxLength,
  IsIn,
  IsNotEmpty,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class CreateMessageDto {
  @ApiProperty({
    description: 'Conversation ID this message belongs to',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty({ message: 'Conversation ID is required' })
  @IsUUID('4', { message: 'Conversation ID must be a valid UUID' })
  conversationId: string;

  @ApiProperty({
    description: 'Sender user ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty({ message: 'Sender ID is required' })
  @IsUUID('4', { message: 'Sender ID must be a valid UUID' })
  senderId: string;

  @ApiProperty({
    description: 'Receiver user ID',
    example: '223e4567-e89b-12d3-a456-426614174001',
  })
  @IsNotEmpty({ message: 'Receiver ID is required' })
  @IsUUID('4', { message: 'Receiver ID must be a valid UUID' })
  receiverId: string;

  @ApiProperty({
    description: 'Message content',
    example: 'Hello, how are you feeling today?',
    minLength: 1,
    maxLength: 2000,
  })
  @IsNotEmpty({ message: 'Message content is required' })
  @IsString({ message: 'Content must be a string' })
  @MinLength(1, { message: 'Message content cannot be empty' })
  @MaxLength(2000, { message: 'Message content must not exceed 2000 characters' })
  @Transform(({ value }) => value?.trim())
  content: string;

  @ApiProperty({
    description: 'Message type',
    example: 'text',
    enum: ['text', 'image', 'file', 'audio', 'video'],
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsIn(['text', 'image', 'file', 'audio', 'video'], {
    message: 'Message type must be one of: text, image, file, audio, video',
  })
  messageType?: string;

  @ApiProperty({
    description: 'Whether the message has been read',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'isRead must be a boolean value' })
  isRead?: boolean;

  @ApiProperty({
    description: 'Whether the message has been updated',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'isUpdated must be a boolean value' })
  isUpdated?: boolean;
}
