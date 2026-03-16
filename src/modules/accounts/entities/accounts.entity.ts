import { AccountRole, AccountStatus } from '../enums';
import { encryptionTransformer } from '../../../common/transformers/encryption.transformer';
import { ClinicManagerInformation } from './clinic_manager_information.entity';
import { ClinicAdminInformation } from './clinic-admin-information.entity';
import { Address } from './addresses.entity';
import { GeneralAccount } from './general_accounts.entity';
import { DoctorInformation } from './doctor_information.entity';
import { ClinicStaffInformation } from './clinic_staff_information.entity';
import { Blog } from '../../blogs/entities/blog.entity';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { ClinicSubscription } from '../../subscriptions/entities/clinic-subscription.entity';
import { ClinicsLegalDocuments } from './clinics_legal_documents.entity';

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
  @PrimaryGeneratedColumn('uuid')
  _id: string;

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

  /**
   * Clinic Manager Information Relation
   *
   * One-to-one relation with clinic_manager_information table for CLINIC_MANAGER accounts
   */
  @OneToOne(
    () => ClinicManagerInformation,
    (clinicManager) => clinicManager.account,
    {
      nullable: true,
      cascade: true,
    },
  )
  clinicManagerInformation?: ClinicManagerInformation;

  /**
   * Clinic Admin Information Relation
   *
   * One-to-one relation with clinic_admin_information table for CLINIC_ADMIN accounts
   */
  @OneToOne(
    () => ClinicAdminInformation,
    (clinicAdmin) => clinicAdmin.account,
    {
      nullable: true,
      cascade: true,
    },
  )
  clinicAdminInformation?: ClinicAdminInformation;

  /**
   * General Account Information Relation
   */
  @OneToOne(() => GeneralAccount, (general) => general.account)
  generalAccount?: GeneralAccount;

  /**
   * Doctor Information Relation
   */
  @OneToOne(() => DoctorInformation, (doctor) => doctor.account)
  doctorInformation?: DoctorInformation;

  /**
   * Clinic Staff Information Relation
   */
  @OneToOne(() => ClinicStaffInformation, (staff) => staff.account)
  clinicStaffInformation?: ClinicStaffInformation;

  /**
   * Address Relation
   *
   * One-to-one relation with addresses table
   */
  @OneToOne(() => Address, (address) => address.account, {
    cascade: true,
  })
  address?: Address;

  /**
   * Blogs Relation
   *
   * One-to-many relation with blogs table for clinic accounts
   */
  @OneToMany(() => Blog, (blog) => blog.clinic, {
    cascade: true,
  })
  blogs?: Blog[];

  /**
   * Clinic Subscription Relation
   */
  @OneToOne(() => ClinicSubscription, (subscription) => subscription.clinic)
  subscription?: ClinicSubscription;

  /**
   * Legal Documents Relation
   */
  @OneToOne(() => ClinicsLegalDocuments, (legalDocs) => legalDocs.account)
  legalDocuments?: ClinicsLegalDocuments;

  @Column({ name: 'username', type: 'varchar', length: 100 })
  username: string;

  @Column({ name: 'email', type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ name: 'phone', type: 'varchar', length: 20, nullable: true })
  phone?: string;

  @Column({ name: 'password', type: 'varchar', length: 255 })
  password: string;

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
    default: AccountStatus.UNVERIFIED,
  })
  status: AccountStatus;

  @Column({ name: 'ban_counts', type: 'integer', default: 0 })
  banCounts: number;

  @Column({
    name: 'ban_description',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  banDescription?: string;

  @Column({ name: 'public_key', type: 'text', nullable: true })
  publicKey?: string;

  @Column({
    name: 'encrypted_private_key',
    type: 'text',
    nullable: true,
    transformer: encryptionTransformer,
  })
  encryptedPrivateKey?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date;
}
