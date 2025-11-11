import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { CreateMessageDto, UpdateMessageDto, MessageResponseDto } from './dto';

@ApiTags('Messages')
@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new message' })
  @ApiResponse({
    status: 201,
    description: 'Message created successfully',
    type: MessageResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid input data',
  })
  async create(
    @Body() createMessageDto: CreateMessageDto,
  ): Promise<MessageResponseDto> {
    return this.messagesService.create(createMessageDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all messages' })
  @ApiResponse({
    status: 200,
    description: 'List of messages retrieved successfully',
    type: [MessageResponseDto],
  })
  async findAll(): Promise<MessageResponseDto[]> {
    return this.messagesService.findAll();
  }

  @Get('conversation/:conversationId/:userId')
  @ApiOperation({ summary: 'Get messages by conversation ID' })
  @ApiParam({
    name: 'conversationId',
    description: 'Conversation ID',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'Messages retrieved successfully',
    type: [MessageResponseDto],
  })
  async findByConversation(
    @Param('conversationId') conversationId: string,
    @Param('userId') userId: string,
  ): Promise<MessageResponseDto[]> {
    return this.messagesService.findByConversation(conversationId, userId);
  }

  @Get('sender/:senderId')
  @ApiOperation({ summary: 'Get messages by sender ID' })
  @ApiParam({ name: 'senderId', description: 'Sender ID', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'Messages retrieved successfully',
    type: [MessageResponseDto],
  })
  async findBySender(
    @Param('senderId') senderId: string,
  ): Promise<MessageResponseDto[]> {
    return this.messagesService.findBySender(senderId);
  }

  @Get('receiver/:receiverId')
  @ApiOperation({ summary: 'Get messages by receiver ID' })
  @ApiParam({ name: 'receiverId', description: 'Receiver ID', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'Messages retrieved successfully',
    type: [MessageResponseDto],
  })
  async findByReceiver(
    @Param('receiverId') receiverId: string,
  ): Promise<MessageResponseDto[]> {
    return this.messagesService.findByReceiver(receiverId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a message by ID' })
  @ApiParam({ name: 'id', description: 'Message ID', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'Message retrieved successfully',
    type: MessageResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Message not found',
  })
  async findOne(@Param('id') id: string): Promise<MessageResponseDto> {
    return this.messagesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a message' })
  @ApiParam({ name: 'id', description: 'Message ID', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'Message updated successfully',
    type: MessageResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Message not found',
  })
  async update(
    @Param('id') id: string,
    @Body() updateMessageDto: UpdateMessageDto,
  ): Promise<MessageResponseDto> {
    return this.messagesService.update(id, updateMessageDto);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a message as read' })
  @ApiParam({ name: 'id', description: 'Message ID', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'Message marked as read successfully',
    type: MessageResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Message not found',
  })
  async markAsRead(@Param('id') id: string): Promise<MessageResponseDto> {
    return this.messagesService.markAsRead(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a message' })
  @ApiParam({ name: 'id', description: 'Message ID', type: 'string' })
  @ApiResponse({
    status: 204,
    description: 'Message deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Message not found',
  })
  async delete(@Param('id') id: string): Promise<void> {
    return this.messagesService.delete(id);
  }

  @Delete('conversation/:conversationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete all messages in a conversation' })
  @ApiParam({
    name: 'conversationId',
    description: 'Conversation ID',
    type: 'string',
  })
  @ApiResponse({
    status: 204,
    description: 'Messages deleted successfully',
  })
  async deleteByConversation(
    @Param('conversationId') conversationId: string,
  ): Promise<void> {
    return this.messagesService.deleteByConversation(conversationId);
  }
}
