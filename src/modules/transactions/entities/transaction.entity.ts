import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  DeleteDateColumn,
} from 'typeorm';
import { ClinicSubscriptionHistory } from '../../subscriptions/entities/clinic-subscription-history.entity';
import { TransactionType } from './transaction-type.entity';

export enum PaymentStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
}

export enum PaymentDirection {
  IN = 'in',
  OUT = 'out',
}

/**
 * Transaction Entity
 *
 * Stores payment transactions for subscriptions
 */
@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid', { name: '_id' })
  id: string;

  @Column({ name: 'prescription_id', type: 'uuid', nullable: true })
  prescriptionId?: string;

  @Column({ name: 'subcription_id', type: 'uuid', nullable: true })
  subscriptionId?: string;

  @ManyToOne(() => ClinicSubscriptionHistory, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'subcription_id' })
  subscription?: ClinicSubscriptionHistory;

  @Column({ name: 'transaction_type_id', type: 'uuid', nullable: true })
  transactionTypeId?: string;

  @ManyToOne(() => TransactionType, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'transaction_type_id' })
  transactionType?: TransactionType;

  @Column({ type: 'bigint' })
  amount: number;

  @Column({ length: 10, default: 'VND' })
  currency: string;

  @Column({ name: 'qr_code_url', type: 'text', nullable: true })
  qrCodeUrl?: string;

  @Column({ name: 'qr_payload', type: 'text', nullable: true })
  qrPayload?: string;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt?: Date;

  @Column({ name: 'seepay_transaction_id', type: 'bigint', nullable: true })
  seepayTransactionId?: string;

  @Column({ name: 'gateway', type: 'text', nullable: true })
  gateway?: string;

  @Column({ name: 'transaction_date', type: 'timestamptz', nullable: true })
  transactionDate?: Date;

  @Column({ name: 'account_number', type: 'text', nullable: true })
  accountNumber?: string;

  @Column({ name: 'code', type: 'text', nullable: true })
  code?: string;

  @Column({ name: 'content', type: 'text', nullable: true })
  content?: string;

  @Column({ name: 'transfer_amount', type: 'bigint', nullable: true })
  transferAmount?: number;

  @Column({ name: 'transfer_type', type: 'enum', enum: PaymentDirection, nullable: true })
  transferType?: PaymentDirection;

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

  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date;
}
