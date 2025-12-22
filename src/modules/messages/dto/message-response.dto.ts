import { ApiProperty } from '@nestjs/swagger';
import { MessageType } from '../enums';

export class MessageResponseDto {
  @ApiProperty({
    description: 'Unique identifier of the message',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'ID of the conversation this message belongs to',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  conversationId: string;

  @ApiProperty({
    description: 'ID of the user sending the message',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  senderId: string;

  @ApiProperty({
    description: 'ID of the user receiving the message',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  receiverId: string;

  @ApiProperty({
    description: 'Content of the message',
    example: 'Hello, how are you feeling today?',
  })
  content: string;

  @ApiProperty({
    description: 'Type of the message',
    example: MessageType.TEXT,
    enum: MessageType,
  })
  messageType: MessageType;

  @ApiProperty({
    description: 'Whether the message has been read',
    example: false,
  })
  isRead: boolean;

  @ApiProperty({
    description: 'List of users who have deleted the message',
    example: [
      '123e4567-e89b-12d3-a456-426614174000',
      '223e4567-e89b-12d3-a456-426614174001',
    ],
    nullable: true,
  })
  deletedBy: string[];

  @ApiProperty({
    description: 'Date when the message can not update or delete',
    example: '2024-01-15T10:30:00.000Z',
  })
  validatedAt: Date;

  @ApiProperty({
    description: 'Date when the message was created',
    example: '2024-01-15T10:30:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Date when the message was last updated',
    example: '2024-01-15T10:30:00.000Z',
  })
  updatedAt: Date;

  @ApiProperty({
    description: 'Date when the message was deleted',
    example: '2024-01-15T10:30:00.000Z',
    nullable: true,
  })
  deletedAt: Date | null;

  constructor(message: Partial<MessageResponseDto>) {
    this.id = message.id || '';
    this.conversationId = message.conversationId || '';
    this.senderId = message.senderId || '';
    this.receiverId = message.receiverId || '';
    this.content = message.content || '';
    this.messageType = message.messageType || MessageType.TEXT;
    this.isRead = message.isRead ?? false;
    this.deletedBy = message.deletedBy || [];
    this.validatedAt = message.validatedAt || new Date();
    this.createdAt = message.createdAt || new Date();
    this.updatedAt = message.updatedAt || new Date();
    this.deletedAt = message.deletedAt || null;
  }
}
