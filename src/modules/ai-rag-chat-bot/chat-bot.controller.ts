import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { AiRagChatBotService } from './chat-bot.service';
import { CreateAiConversationDto } from './dto/create-conversation.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';

@ApiTags('AI RAG Chat Bot')
@Controller('ai-conversations')
export class AiRagChatBotController {
  constructor(private readonly aiRagChatBotService: AiRagChatBotService) {}

  @Post(':userId')
  @ApiParam({
    name: 'userId',
    description: 'The ID of the user',
    type: 'string',
  })
  @ApiOperation({
    summary: 'Create a new conversation',
    description: 'Create a new conversation for a given user',
  })
  @ApiResponse({
    status: 201,
    description: 'Conversation created successfully',
  })
  async createConversation(
    @Param('userId') userId: string,
    @Body() createAiConversationDto: CreateAiConversationDto,
  ) {
    return this.aiRagChatBotService.createConversation(
      userId,
      createAiConversationDto,
    );
  }

  @Get(':conversationId/users/:userId/messages')
  @ApiOperation({
    summary: 'Get conversation messages',
    description:
      'Fetch all messages in a specific conversation for a given user',
  })
  @ApiParam({
    name: 'conversationId',
    description: 'The ID of the conversation',
    type: 'string',
  })
  @ApiParam({
    name: 'userId',
    description: 'The ID of the user',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'Conversation messages retrieved successfully',
  })
  async getMessages(
    @Param('conversationId') conversationId: string,
    @Param('userId') userId: string,
  ) {
    return this.aiRagChatBotService.getMessagesByConversationIdAndUserId(
      conversationId,
      userId,
    );
  }
}
