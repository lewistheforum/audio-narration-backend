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
import { Account } from './accounts.entity';
import { BanType } from '../enums';

/**
 * BanHistory Entity
 *
 * Stores ban history for accounts
 */
@Entity('ban_history')
export class BanHistory {
  @PrimaryGeneratedColumn('uuid')
  _id: string;

  @Column({ name: 'account_id', type: 'uuid' })
  accountId: string;

  @ManyToOne(() => Account, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'account_id' })
  account?: Account;

  @Column({ name: 'ban_counts', type: 'int', default: 0 })
  banCounts: number;

  @Column({
    name: 'type',
    type: 'enum',
    enum: BanType,
  })
  type: BanType;

  @Column({ name: 'ban_description', type: 'varchar', length: 255, nullable: true })
  banDescription?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date;
}
