import {
  IsString,
  IsUUID,
  IsOptional,
  IsBoolean,
  MaxLength,
  IsIn,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMessageDto {
  @ApiProperty({
    description: 'ID of the conversation this message belongs to',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  conversationId: string;

  @ApiProperty({
    description: 'ID of the user sending the message',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  senderId: string;

  @ApiProperty({
    description: 'ID of the user receiving the message',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  receiverId: string;

  @ApiProperty({
    description: 'Content of the message',
    example: 'Hello, how are you feeling today?',
  })
  @IsString()
  @MaxLength(2000)
  content: string;

  @ApiProperty({
    description: 'Type of the message',
    example: 'text',
    enum: ['text', 'image', 'file', 'audio', 'video'],
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsIn(['text', 'image', 'file', 'audio', 'video'])
  messageType?: string;

  @ApiProperty({
    description: 'Whether the message has been read',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isRead?: boolean;

  @ApiProperty({
    description: 'Whether the message has been updated',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isUpdated?: boolean;
}
