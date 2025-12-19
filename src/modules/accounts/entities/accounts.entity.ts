import { AccountRole, AccountStatus } from '../enums';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';

/**
 * Account Entity
 *
 * Core user account model supporting multiple authentication methods
 *
 * Features:
 * - Standard email/password authentication
 * - Google OAuth authentication
 * - Email verification system
 * - Role-based access control
 * - Parent-Child account relationship
 * - Account ban management
 */
@Entity('accounts')
export class Account {
  @PrimaryGeneratedColumn('uuid', { name: '_id' })
  id: string;

  /**
   * Parent Account Reference
   *
   * UUID reference to parent account for hierarchical relationships
   */
  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId?: string;

  @ManyToOne(() => Account, (account) => account.children, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'parent_id' })
  parent?: Account;

  @OneToMany(() => Account, (account) => account.parent)
  children?: Account[];

  @Column({ name: 'username', type: 'varchar', length: 100 })
  username: string;

  @Column({ name: 'email', type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ name: 'phone', type: 'varchar', length: 20, nullable: true })
  phone?: string;

  @Column({ name: 'dob', type: 'date', nullable: true })
  dob?: Date;

  @Column({ name: 'password', type: 'varchar', length: 255 })
  password: string;

  @Column({ name: 'profile_picture', type: 'text', nullable: true })
  profilePicture?: string;

  @Column({ name: 'is_OAuth_user', type: 'boolean', default: false })
  isOAuthUser: boolean;

  @Column({ name: 'is_email_verified', type: 'boolean', default: false })
  isEmailVerified: boolean;

  @Column({
    name: 'role',
    type: 'enum',
    enum: AccountRole,
    default: AccountRole.PATIENT,
  })
  role: AccountRole;

  @Column({
    name: 'status',
    type: 'enum',
    enum: AccountStatus,
    default: AccountStatus.PENDING_VERIFICATION,
  })
  status: AccountStatus;

  @Column({ name: 'ban_counts', type: 'integer', default: 0 })
  banCounts: number;

  @Column({ name: 'ban_description', type: 'varchar', length: 255, nullable: true })
  banDescription?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date;
}
