import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';
import { Account } from '../../accounts/entities/accounts.entity';
import { Conversation } from '../../conversations/entities/conversation.entity';
import { MessageType } from '../enums';

@Entity('messages')
@Index('idx_messages_conversation_id', ['conversationId'])
@Index('idx_messages_sender_id', ['senderId'])
@Index('idx_messages_receiver_id', ['receiverId'])
@Index('idx_messages_created_at', ['createdAt'])
@Index('idx_messages_conversation_created', ['conversationId', 'createdAt'])
@Index('idx_messages_sender_receiver', ['senderId', 'receiverId'])
@Index('idx_messages_deleted_by', ['deletedBy'])
@Index('idx_messages_conversation_deleted_by', ['conversationId', 'deletedBy'])
@Index('idx_messages_conversation_sender', ['conversationId', 'senderId'])
export class Message {
  @PrimaryGeneratedColumn('uuid', { name: '_id' })
  _id: string;

  @Column({ name: 'conversation_id' })
  conversationId: string;

  @Column({ name: 'sender_id' })
  senderId: string;

  @Column({ name: 'receiver_id' })
  receiverId: string;

  @Column({ name: 'content', type: 'text' })
  content: string;

  @Column({
    name: 'message_type',
    type: 'enum',
    enum: MessageType,
    default: MessageType.TEXT,
  })
  messageType: MessageType;

  @Column({ name: 'is_read', default: false })
  isRead: boolean;

  @Column({ name: 'is_updated', default: false })
  isUpdated: boolean;

  @Column('uuid', {
    name: 'deleted_by',
    array: true,
    default: [],
    nullable: true,
  })
  deletedBy: string[];

  @ManyToOne(() => Conversation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation: Conversation;

  @ManyToOne(() => Account, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sender_id' })
  sender: Account;

  @ManyToOne(() => Account, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'receiver_id' })
  receiver: Account;

  @Column({ name: 'validated_at', type: 'timestamptz' })
  validatedAt: Date;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date;
}
