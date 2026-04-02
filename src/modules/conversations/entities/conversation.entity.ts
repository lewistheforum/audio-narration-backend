import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('conversations')
@Index('idx_conversations_participants', ['participants'])
@Index('idx_conversations_updated', ['updatedAt'])
@Index('idx_conversations_deleted_by', ['deletedBy'])
@Index('idx_conversations_participants_updated', ['participants', 'updatedAt'])
export class Conversation {
  @PrimaryGeneratedColumn('uuid', { name: '_id' })
  _id: string;

  @Column({ name: 'title', nullable: true })
  title: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string;

  @Column('uuid', { name: 'participants', array: true })
  participants: string[];

  @Column('uuid', {
    name: 'deleted_by',
    array: true,
    default: [],
    nullable: true,
  })
  deletedBy: string[];

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
