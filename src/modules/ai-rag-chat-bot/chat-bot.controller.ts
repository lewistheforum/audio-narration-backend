import { Controller, Post, Body } from '@nestjs/common';
import { AiRagChatBotService } from './chat-bot.service';
import { CreateAiConversationDto } from './dto/create-conversation.dto';

@Controller('ai-conversations')
export class AiRagChatBotController {
  constructor(private readonly aiRagChatBotService: AiRagChatBotService) {}

  @Post()
  async createConversation(
    @Body() createAiConversationDto: CreateAiConversationDto,
  ) {
    return this.aiRagChatBotService.createConversation(createAiConversationDto);
  }
}
