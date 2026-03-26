import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { AiMessage } from './ai-message.entity';

@Entity('ai_conversations')
@Index('idx_ai_conversation_deleted_by', ['deletedBy'])
export class AiConversation {
  @PrimaryGeneratedColumn('uuid', { name: '_id' })
  _id: string;

  @Column({ name: 'title', nullable: true })
  title: string;

  @Column({ name: 'description', nullable: true })
  description: string;

  @Column({ name: 'participants', type: 'jsonb', nullable: true })
  participants: any;

  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata: any;

  @Column({ name: 'deleted_by', type: 'uuid', nullable: true })
  deletedBy: string;

  @OneToMany(() => AiMessage, (message: AiMessage) => message.conversation)
  messages: AiMessage[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt: Date;
}
