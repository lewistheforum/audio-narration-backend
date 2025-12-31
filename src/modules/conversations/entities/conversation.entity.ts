import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('conversations')
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

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
