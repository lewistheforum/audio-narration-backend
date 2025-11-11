import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { ConversationService } from './conversation.service';
import {
  CreateConversationDto,
  UpdateConversationDto,
  ConversationResponseDto,
} from './dto';

@ApiTags('Conversations')
@Controller('conversations')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new conversation' })
  @ApiResponse({
    status: 201,
    description: 'Conversation created successfully',
    type: ConversationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid input data',
  })
  async create(
    @Body() createConversationDto: CreateConversationDto,
  ): Promise<ConversationResponseDto> {
    return this.conversationService.create(createConversationDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all conversations' })
  @ApiResponse({
    status: 200,
    description: 'List of conversations retrieved successfully',
    type: [ConversationResponseDto],
  })
  async findAll(): Promise<ConversationResponseDto[]> {
    return this.conversationService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a conversation by ID' })
  @ApiParam({ name: 'id', description: 'Conversation ID', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'Conversation retrieved successfully',
    type: ConversationResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Conversation not found',
  })
  async findOne(@Param('id') id: string): Promise<ConversationResponseDto> {
    return this.conversationService.findOne(id);
  }

  @Get('participants/:participantId')
  @ApiOperation({ summary: 'Get Conversation by Participants' })
  @ApiParam({
    name: 'participantId',
    description: 'Participant ID',
    type: 'string',
  })
  async findByParticipants(
    @Param('participantId') participantId: string,
  ): Promise<ConversationResponseDto[]> {
    return this.conversationService.findByParticipants([participantId]);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a conversation' })
  @ApiParam({ name: 'id', description: 'Conversation ID', type: 'string' })
  @ApiResponse({
    status: 200,
    description: 'Conversation updated successfully',
    type: ConversationResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Conversation not found',
  })
  async update(
    @Param('id') id: string,
    @Body() updateConversationDto: UpdateConversationDto,
  ): Promise<ConversationResponseDto> {
    return this.conversationService.update(id, updateConversationDto);
  }

  @Delete(':conversationId/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a conversation' })
  @ApiParam({
    name: 'conversationId',
    description: 'Conversation ID',
    type: 'string',
  })
  @ApiParam({ name: 'userId', description: 'User ID', type: 'string' })
  @ApiResponse({
    status: 204,
    description: 'Conversation deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Conversation not found',
  })
  async delete(
    @Param('conversationId') conversationId: string,
    @Param('userId') userId: string,
  ): Promise<void> {
    return this.conversationService.delete(conversationId, userId);
  }
}
