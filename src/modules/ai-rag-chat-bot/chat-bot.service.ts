import { Injectable } from '@nestjs/common';
import { AiConversationRepository } from './repositories/ai-conversation.repository';
import { CreateAiConversationDto } from './dto/create-conversation.dto';
import { AiConversation } from './entities/ai-conversation.entity';

@Injectable()
export class AiRagChatBotService {
  constructor(
    private readonly aiConversationRepository: AiConversationRepository,
  ) {}

  async createConversation(
    createAiConversationDto: CreateAiConversationDto,
  ): Promise<AiConversation> {
    return this.aiConversationRepository.createConversation(
      createAiConversationDto,
    );
  }
}
