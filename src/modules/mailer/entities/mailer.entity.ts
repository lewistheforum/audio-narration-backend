import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
} from 'typeorm';
import { Account } from 'src/modules/accounts/entities/accounts.entity';
import { VerificationType } from '../enums';

@Entity('code_verification')
export class CodeVerification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => Account)
  @JoinColumn({ name: 'user_id' })
  account: Account;

  @Column({ name: 'code', type: 'varchar', length: 16 })
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
  deletedAt: Date;
}
