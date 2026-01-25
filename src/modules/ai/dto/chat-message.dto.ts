import { IsString, IsNotEmpty, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

/**
 * Chat Message Role Enum
 *
 * Defines the role of a message in a conversation.
 * - USER: Message from the user
 * - ASSISTANT: Message from the AI assistant
 * - SYSTEM: System message (instructions, context)
 */
export enum ChatMessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system',
}

/**
 * Chat Message DTO
 *
 * Represents a single message in a conversation with an AI model.
 * Used to build conversation history for context-aware responses.
 */
export class ChatMessageDto {
  @ApiProperty({
    description: 'Role of the message sender',
    enum: ChatMessageRole,
    example: ChatMessageRole.USER,
  })
  @IsNotEmpty({ message: 'Role is required' })
  @IsEnum(ChatMessageRole, { message: 'Invalid message role' })
  role: ChatMessageRole;

  @ApiProperty({
    description: 'Content of the message',
    example: 'What are the symptoms of diabetes?',
  })
  @IsNotEmpty({ message: 'Content is required' })
  @IsString({ message: 'Content must be a string' })
  @Transform(({ value }) => value?.trim())
  content: string;
}
