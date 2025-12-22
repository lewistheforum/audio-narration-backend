import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ClinicSubscriptionHistory } from '../../subscriptions/entities/clinic-subscription-history.entity';
import { TransactionType } from './transaction-type.entity';

/**
 * Transaction Entity
 *
 * Stores payment transactions for subscriptions
 */
@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid', { name: '_id' })
  id: string;

  @Column({ name: 'subcription_id', type: 'uuid' })
  subscriptionId: string;

  @ManyToOne(() => ClinicSubscriptionHistory, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'subcription_id' })
  subscription?: ClinicSubscriptionHistory;

  @Column({ name: 'transaction_type_id', type: 'uuid' })
  transactionTypeId: string;

  @ManyToOne(() => TransactionType, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'transaction_type_id' })
  transactionType?: TransactionType;

  @Column({ name: 'gateway', type: 'text', nullable: true })
  gateway?: string;

  @Column({ name: 'transaction_date', type: 'timestamptz' })
  transactionDate: Date;

  @Column({ name: 'account_number', type: 'text', nullable: true })
  accountNumber?: string;

  @Column({ name: 'code', type: 'text', nullable: true })
  code?: string;

  @Column({ name: 'status', type: 'text', nullable: true })
  status?: string;

  @Column({ name: 'content', type: 'text', nullable: true })
  content?: string;

  @Column({ name: 'transfer_amount', type: 'bigint' })
  transferAmount: number;

  @Column({ name: 'transfer_type', type: 'text', nullable: true })
  transferType?: string;

  @Column({ name: 'currency', type: 'text', nullable: true })
  currency?: string;

  @Column({ name: 'accumulated', type: 'bigint', nullable: true })
  accumulated?: number;

  @Column({ name: 'sub_account', type: 'text', nullable: true })
  subAccount?: string;

  @Column({ name: 'reference_code', type: 'text', nullable: true })
  referenceCode?: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'signature', type: 'text', nullable: true })
  signature?: string;

  @CreateDateColumn({ name: 'create_at', type: 'timestamptz' })
  createAt: Date;

  @UpdateDateColumn({ name: 'update_at', type: 'timestamptz' })
  updateAt: Date;
}
