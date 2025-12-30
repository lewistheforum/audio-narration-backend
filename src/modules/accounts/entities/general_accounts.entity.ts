import { Gender } from '../enums';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Account } from './accounts.entity';

/**
 * GeneralAccount Entity
 *
 * Stores general account information for patients and admins
 * Linked to the main Account entity via general_acc_id
 */
@Entity('general_accounts')
export class GeneralAccount {
  @PrimaryGeneratedColumn('uuid', { name: '_id' })
  id: string;

  /**
   * Reference to the main Account
   */
  @Column({ name: 'general_acc_id', type: 'uuid', unique: true })
  generalAccId: string;

  @OneToOne(() => Account, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'general_acc_id' })
  generalAccount?: Account;

  @Column({ name: 'full_name', type: 'text', nullable: true })
  fullName?: string;

  @Column({
    name: 'gender',
    type: 'enum',
    enum: Gender,
    nullable: true,
  })
  gender?: Gender;

  @Column({ name: 'dob', type: 'date', nullable: true })
  dob?: Date;

  @Column({ name: 'profile_picture', type: 'text', nullable: true })
  profilePicture?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date;
}
