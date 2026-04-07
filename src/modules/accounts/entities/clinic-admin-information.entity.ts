import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Account } from './accounts.entity';
import { encryptionTransformer } from '../../../common/transformers/encryption.transformer';

/**
 * ClinicAdminInformation Entity
 *
 * Stores detailed information about clinic administrators
 * One-to-one relationship with Account entity
 */
@Entity('clinic_admin_information')
@Index('idx_clinic_admin_account_id', ['accountId'])
@Index('idx_clinic_admin_clinic_name', ['clinicName'])
export class ClinicAdminInformation {
  @PrimaryGeneratedColumn('uuid')
  _id: string;

  /**
   * Account Reference
   *
   * UUID reference to the associated account
   * One-to-one relationship with Account entity
   */
  @Column({ name: 'account_id', type: 'uuid', unique: true })
  accountId: string;

  @OneToOne(() => Account, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'account_id' })
  account?: Account;

  /**
   * Clinic Name
   *
   * Name of the clinic managed by this administrator
   */
  @Column({ name: 'clinic_name', type: 'text' })
  clinicName: string;

  /**
   * Clinic Phone
   *
   * Phone number of the clinic
   */
  @Column({ name: 'clinic_phone', type: 'text', nullable: true })
  clinicPhone?: string;

  /**
   * Description
   *
   * Description of the clinic
   */
  @Column({ name: 'description', type: 'text', nullable: true })
  description?: string;

  /**
   * Specializations
   *
   * Medical specializations offered by the clinic
   */
  @Column({ name: 'specialized_in', type: 'jsonb', nullable: true })
  specializedIn?: any;

  /**
   * Pros/Advantages
   *
   * Advantages or strengths of the clinic
   */
  @Column({ name: 'pros', type: 'jsonb', nullable: true })
  pros?: any;

  /**
   * Paraclinical Services
   *
   * Paraclinical services offered by the clinic
   */
  @Column({ name: 'paraclinical', type: 'jsonb', nullable: true })
  paraclinical?: any;

  /**
   * Date of Birth
   *
   * Date of birth of the clinic administrator
   */
  @Column({ name: 'dob', type: 'date', nullable: true })
  dob?: Date;

  /**
   * Profile Picture
   *
   * URL or path to the profile picture image
   */
  @Column({ name: 'profile_picture', type: 'text', nullable: true })
  profilePicture?: string;

  /**
   * Bank Name
   *
   * Name of the bank for payment processing
   */
  @Column({
    name: 'bank_name',
    type: 'text',
    nullable: true
    // transformer: encryptionTransformer,
  })
  bankName?: string;

  /**
   * Bank Account Number
   *
   * Bank account number for receiving payments
   */
  @Column({
    name: 'bank_number',
    type: 'text',
    nullable: true,
    // transformer: encryptionTransformer,
  })
  bankNumber?: string;

  /**
   * Bank Branch
   *
   * Branch location of the bank
   */
  @Column({
    name: 'bank_branch',
    type: 'text',
    nullable: true,
    transformer: encryptionTransformer,
  })
  bankBranch?: string;

  /**
   * SePay Virtual Account
   *
   * SePay virtual account number for payment processing
   */
  @Column({
    name: 'sepay_va',
    type: 'text',
    nullable: true
  })
  sepayVa?: string;

  /**
   * SePay API Key
   *
   * SePay API key for payment processing integration
   */
  @Column({
    name: 'sepay_key',
    type: 'text',
    nullable: true
  })
  sepayKey?: string;

  /**
   * Verification Status
   *
   * Indicates whether the clinic administrator is verified
   */
  @Column({
    name: 'is_verify',
    type: 'boolean',
    default: false,
    nullable: true,
  })
  isVerify?: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date;
}
