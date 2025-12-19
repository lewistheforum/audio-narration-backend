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
import { VerificationType } from '../enums';

/**
 * CodeVerification Entity
 *
 * Stores verification codes for email verification and password reset
 */
@Entity('code_verification')
export class CodeVerification {
  @PrimaryGeneratedColumn('uuid', { name: '_id' })
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => Account, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user?: Account;

  @Column({ name: 'code', type: 'varchar', length: 100 })
  code: string;

  @Column({ name: 'expired_at', type: 'timestamptz' })
  expiredAt: Date;

  @Column({ name: 'used', type: 'boolean', default: false })
  used: boolean;

  @Column({
    name: 'type',
    type: 'enum',
    enum: VerificationType,
  })
  type: VerificationType;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date;
}
