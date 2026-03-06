import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { AiMessage } from '../entities/ai-message.entity';

@Injectable()
export class AiMessageRepository extends Repository<AiMessage> {
  constructor(private dataSource: DataSource) {
    super(AiMessage, dataSource.createEntityManager());
  }

  async createMessage(data: Partial<AiMessage>): Promise<AiMessage> {
    const message = this.create(data);
    return this.save(message);
  }

  async findMessagesByConversationAndUser(
    conversationId: string,
    // By providing userId, we might use it to validate if the user is a participant of this conversation
    // or specifically fetch messages for that user context. But typically for a conversation,
    // we return all messages under that conversationId.
    userId: string,
  ): Promise<AiMessage[]> {
    return this.find({
      where: {
        conversationId: conversationId,
        // If senderId was explicitly needed we would add it here,
        // however messages in a conversation consist of AI messages + user messages,
        // so filtering strictly by senderId = userId would omit AI responses.
        // Therefore, we fetch by conversationId. We can also optionally check conversation participants.
      },
      order: {
        createdAt: 'ASC', // Chronological order
      },
    });
  }
}
