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
}
