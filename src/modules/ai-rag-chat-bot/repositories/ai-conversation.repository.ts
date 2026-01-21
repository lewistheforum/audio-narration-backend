import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { AiConversation } from '../entities/ai-conversation.entity';

@Injectable()
export class AiConversationRepository extends Repository<AiConversation> {
  constructor(private dataSource: DataSource) {
    super(AiConversation, dataSource.createEntityManager());
  }

  async createConversation(
    data: Partial<AiConversation>,
  ): Promise<AiConversation> {
    const conversation = this.create(data);
    return this.save(conversation);
  }

  async findAllConversations(): Promise<AiConversation[]> {
    return this.find();
  }
}
