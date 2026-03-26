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
import { ClinicSubscription } from '../../subscriptions/entities/clinic-subscription.entity';
import { TransactionType } from './transaction-type.entity';
import { Account } from '../../accounts/entities/accounts.entity';

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
@Index('idx_transactions_clinic_id', ['clinicId'])
@Index('idx_transactions_appointment_id', ['appointmentId'])
@Index('idx_transactions_subscription_id', ['subscriptionId'])
@Index('idx_transactions_status', ['status'])
@Index('idx_transactions_created_at', ['createdAt'])
@Index('idx_transactions_reference_code', ['referenceCode'])
@Index('idx_transactions_seepay_transaction_id', ['seepayTransactionId'])
@Index('idx_transactions_transaction_date', ['transactionDate'])
@Index('idx_transactions_clinic_date_status', ['clinicId', 'transactionDate', 'status'])
export class Transaction {
  @PrimaryGeneratedColumn('uuid', { name: '_id' })
  id: string;

  @Column({ name: 'clinic_id', type: 'uuid', nullable: true })
  clinicId?: string;

  @ManyToOne(() => Account, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'clinic_id' })
  clinic?: Account;

  @Column({ name: 'sender_account_id', type: 'uuid', nullable: true })
  senderAccountId?: string;

  @ManyToOne(() => Account, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'sender_account_id' })
  senderAccount?: Account;

  @Column({ name: 'appointment_id', type: 'uuid', nullable: true })
  appointmentId?: string;

  @Column({ name: 'subcription_id', type: 'uuid', nullable: true })
  subscriptionId?: string;

  @ManyToOne(() => ClinicSubscription, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'subcription_id' })
  subscription?: ClinicSubscription;
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

  @Column({
    name: 'transfer_type',
    type: 'enum',
    enum: PaymentDirection,
    nullable: true,
  })
  transferType?: PaymentDirection;

  @Column({ name: 'accumulated', type: 'bigint', nullable: true })
  accumulated?: number;

  @Column({ name: 'sub_account', type: 'text', nullable: true })
  subAccount?: string;

  @Column({ name: 'reference_code', type: 'text', nullable: true })
  referenceCode?: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date;
}
