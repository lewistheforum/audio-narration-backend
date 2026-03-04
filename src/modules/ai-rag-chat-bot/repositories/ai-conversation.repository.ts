import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { AiConversation } from '../entities/ai-conversation.entity';

@Injectable()
export class AiConversationRepository extends Repository<AiConversation> {
  constructor(private dataSource: DataSource) {
    super(AiConversation, dataSource.createEntityManager());
  }

  async createConversation(
    userId: string,
    data: Partial<AiConversation>,
  ): Promise<AiConversation> {
    const participants = Array.isArray(data.participants)
      ? [...data.participants]
      : [];
    if (!participants.includes(userId)) {
      participants.push(userId);
    }
    const conversation = this.create({
      ...data,
      participants,
    });
    return this.save(conversation);
  }

  async findAllConversations(): Promise<AiConversation[]> {
    return this.find();
  }
}
