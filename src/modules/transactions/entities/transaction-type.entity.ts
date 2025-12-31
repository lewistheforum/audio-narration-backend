import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';

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

  @Column({ name: 'code', type: 'text' })
  code: string;

  @CreateDateColumn({ name: 'create_at', type: 'timestamptz' })
  createAt: Date;

  @UpdateDateColumn({ name: 'update_at', type: 'timestamptz' })
  updateAt: Date;

  @DeleteDateColumn({ name: 'delete_at', type: 'timestamptz' })
  deleteAt?: Date;
}
