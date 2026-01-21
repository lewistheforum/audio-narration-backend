import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { AiConversation } from './ai-conversation.entity';
import { Account } from 'src/modules/accounts/entities';

@Entity('ai_messages')
export class AiMessage {
  @PrimaryGeneratedColumn('uuid', { name: '_id' })
  _id: string;

  @Column({ name: 'conversation_id', type: 'uuid' })
  conversationId: string;

  @Column({ name: 'sender_id', type: 'uuid', nullable: true })
  senderId: string;

  @ManyToOne(() => Account, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'sender_id' })
  sender?: Account;

  @Column({ name: 'role', type: 'text' })
  role: string;

  @Column({ name: 'content', type: 'text' })
  content: string;

  @Column({ name: 'embedding', type: 'vector', length: 1536, nullable: true })
  embedding: number[];

  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata: any;

  @Column({ name: 'deleted_by', type: 'uuid', nullable: true })
  deletedBy: string;

  @ManyToOne(() => AiConversation, (conversation) => conversation.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'conversation_id' })
  conversation: AiConversation;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt: Date;
}
