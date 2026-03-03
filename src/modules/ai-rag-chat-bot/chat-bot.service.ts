import { Injectable } from '@nestjs/common';
import { AiConversationRepository } from './repositories/ai-conversation.repository';
import { CreateAiConversationDto } from './dto/create-conversation.dto';
import { AiConversation } from './entities/ai-conversation.entity';
import { AiMessage } from './entities/ai-message.entity';
import { AiMessageRepository } from './repositories/ai-message.repository';
import { AccountsService } from '../accounts/accounts.service';

@Injectable()
export class AiRagChatBotService {
  constructor(
    private readonly aiConversationRepository: AiConversationRepository,
    private readonly aiMessageRepository: AiMessageRepository,
    private readonly accountsService: AccountsService,
  ) {}

  async createConversation(
    userId: string,
    createAiConversationDto: CreateAiConversationDto,
  ): Promise<AiConversation> {
    const conversation = await this.aiConversationRepository.createConversation(
      userId,
      createAiConversationDto,
    );

    // After creating a conversation, automatically create a welcome message
    let patientName = '';

    if (userId) {
      try {
        const accountInfo = await this.accountsService.findOne(userId);
        const accountData: any = accountInfo;
        if (accountData.patientProfile && accountData.patientProfile.fullName) {
          patientName = accountData.patientProfile.fullName;
        } else if (
          accountData.generalAccount &&
          accountData.generalAccount.fullName
        ) {
          patientName = accountData.generalAccount.fullName;
        } else {
          patientName = accountInfo.username || '';
        }
      } catch (error) {
        console.error('Failed to fetch user name for welcome message', error);
      }
    }

    const welcomeMessageText = `Hello ${patientName ? patientName : 'patient'}, I am your Medicare AI assistant. How can I help you today?`;

    await this.aiMessageRepository.createMessage({
      conversationId: conversation._id,
      senderId: null, // null implies assistant
      role: 'assistant',
      content: welcomeMessageText,
      metadata: {
        type: 'welcome',
      },
    });

    return conversation;
  }

  async getMessagesByConversationIdAndUserId(
    conversationId: string,
    userId: string,
  ): Promise<AiMessage[]> {
    return this.aiMessageRepository.findMessagesByConversationAndUser(
      conversationId,
      userId,
    );
  }
}
