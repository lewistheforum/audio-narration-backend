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
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { CreateMessageDto, UpdateMessageDto, MessageResponseDto } from './dto';
import { JwtAuthGuard } from '../auth/jwt.strategy';

@ApiTags('Messages')
@Controller('messages')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
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
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid token',
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
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid token',
  })
  async findAll(): Promise<MessageResponseDto[]> {
    return this.messagesService.findAll();
  }

  @Get('conversation/:conversationId/:userId')
  @ApiOperation({ summary: 'Get messages by conversation ID and user ID' })
  @ApiParam({
    name: 'conversationId',
    description: 'Conversation ID (UUID)',
    type: 'string',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID (UUID)',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'Messages retrieved successfully',
    type: [MessageResponseDto],
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid token',
  })
  async findByConversation(
    @Param('conversationId') conversationId: string,
    @Param('userId') userId: string,
  ): Promise<MessageResponseDto[]> {
    return this.messagesService.findByConversation(conversationId, userId);
  }

  @Get('sender/:senderId')
  @ApiOperation({ summary: 'Get messages by sender ID' })
  @ApiParam({ name: 'senderId', description: 'Sender ID (UUID)', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'Messages retrieved successfully',
    type: [MessageResponseDto],
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid token',
  })
  async findBySender(
    @Param('senderId') senderId: string,
  ): Promise<MessageResponseDto[]> {
    return this.messagesService.findBySender(senderId);
  }

  @Get('receiver/:receiverId')
  @ApiOperation({ summary: 'Get messages by receiver ID' })
  @ApiParam({ name: 'receiverId', description: 'Receiver ID (UUID)', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'Messages retrieved successfully',
    type: [MessageResponseDto],
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid token',
  })
  async findByReceiver(
    @Param('receiverId') receiverId: string,
  ): Promise<MessageResponseDto[]> {
    return this.messagesService.findByReceiver(receiverId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a message by ID' })
  @ApiParam({ name: 'id', description: 'Message ID (UUID)', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'Message retrieved successfully',
    type: MessageResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Message not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid token',
  })
  async findOne(@Param('id') id: string): Promise<MessageResponseDto> {
    return this.messagesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a message' })
  @ApiParam({ name: 'id', description: 'Message ID (UUID)', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'Message updated successfully',
    type: MessageResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Message not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid token',
  })
  async update(
    @Param('id') id: string,
    @Body() updateMessageDto: UpdateMessageDto,
  ): Promise<MessageResponseDto> {
    return this.messagesService.update(id, updateMessageDto);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a message as read' })
  @ApiParam({ name: 'id', description: 'Message ID (UUID)', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'Message marked as read successfully',
    type: MessageResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Message not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid token',
  })
  async markAsRead(@Param('id') id: string): Promise<MessageResponseDto> {
    return this.messagesService.markAsRead(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a message' })
  @ApiParam({ name: 'id', description: 'Message ID (UUID)', type: 'string' })
  @ApiResponse({
    status: 204,
    description: 'Message deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Message not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid token',
  })
  async delete(@Param('id') id: string): Promise<void> {
    return this.messagesService.delete(id);
  }

  @Delete('conversation/:conversationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete all messages in a conversation' })
  @ApiParam({
    name: 'conversationId',
    description: 'Conversation ID (UUID)',
    type: 'string',
  })
  @ApiResponse({
    status: 204,
    description: 'Messages deleted successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid token',
  })
  async deleteByConversation(
    @Param('conversationId') conversationId: string,
  ): Promise<void> {
    return this.messagesService.deleteByConversation(conversationId);
  }
}
