import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';

@Entity('knowledge_base')
export class KnowledgeBase {
  @PrimaryGeneratedColumn('uuid', { name: '_id' })
  _id: string;

  @Column({ name: 'content', type: 'text' })
  content: string;

  @Column({ name: 'embedding', type: 'vector', length: 384, nullable: true })
  embedding: number[];

  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata: any;

  @Column({
    name: 'search_vector',
    type: 'tsvector',
    select: false,
    nullable: true,
  })
  searchVector: any;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt: Date;
}
