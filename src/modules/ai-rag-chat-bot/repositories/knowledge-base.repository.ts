import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { KnowledgeBase } from '../entities/knowledge-base.entity';

@Injectable()
export class KnowledgeBaseRepository extends Repository<KnowledgeBase> {
  constructor(private dataSource: DataSource) {
    super(KnowledgeBase, dataSource.createEntityManager());
  }

  async createKnowledge(data: Partial<KnowledgeBase>): Promise<KnowledgeBase> {
    const knowledge = this.create(data);
    return this.save(knowledge);
  }

  async countKnowledge(): Promise<number> {
    return this.count();
  }
}
