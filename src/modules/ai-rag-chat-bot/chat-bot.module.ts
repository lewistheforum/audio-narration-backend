import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiConversation } from './entities/ai-conversation.entity';
import { AiMessage } from './entities/ai-message.entity';
import { AiConversationRepository } from './repositories/ai-conversation.repository';
import { AiMessageRepository } from './repositories/ai-message.repository';
import { AiRagChatBotService } from './chat-bot.service';
import { AiRagChatBotController } from './chat-bot.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AiConversation, AiMessage])],
  controllers: [AiRagChatBotController],
  providers: [
    AiConversationRepository,
    AiMessageRepository,
    AiRagChatBotService,
  ],
  exports: [AiConversationRepository, AiMessageRepository],
})
export class ChatBotModule {}
