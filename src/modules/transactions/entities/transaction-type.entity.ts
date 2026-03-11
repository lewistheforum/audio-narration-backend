import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';

export enum TransactionTypeCode {
  SUBSCRIPTION = 'SUBSCRIPTION',
  VERIFICATION = 'VERIFICATION',
  ONLINE = 'ONLINE',
  CASH = 'CASH',
  SUBSCRIPTION_PAYMENT = 'Subscription Payment',
}

/**
 * TransactionType Entity
 *
 * Stores types of transactions
 */
@Entity('transactions_type')
export class TransactionType {
  @PrimaryGeneratedColumn('uuid')
  _id: string;

  @Column({ name: 'name', type: 'text' })
  name: string;

  @Column({
    name: 'code',
    type: 'enum',
    enum: TransactionTypeCode,
    nullable: true
  })
  code?: TransactionTypeCode | null;


  @CreateDateColumn({ name: 'create_at', type: 'timestamptz' })
  createAt: Date;

  @UpdateDateColumn({ name: 'update_at', type: 'timestamptz' })
  updateAt: Date;

  @DeleteDateColumn({ name: 'delete_at', type: 'timestamptz' })
  deleteAt?: Date;
}
