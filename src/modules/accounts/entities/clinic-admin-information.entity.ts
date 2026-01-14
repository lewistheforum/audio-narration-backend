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
import { BankName } from '../enums/bank-name.enum';

/**
 * ClinicAdminInformation Entity
 *
 * Stores detailed information about clinic administrators
 * One-to-one relationship with Account entity
 */
@Entity('clinic_admin_information')
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
  specializedIn?: string[];

  /**
   * Pros/Advantages
   *
   * Advantages or strengths of the clinic
   */
  @Column({ name: 'pros', type: 'jsonb', nullable: true })
  pros?: string[];

  /**
   * Paraclinical Services
   *
   * Paraclinical services offered by the clinic
   */
  @Column({ name: 'paraclinical', type: 'jsonb', nullable: true })
  paraclinical?: string[];

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
    nullable: true,
  })
  bankName?: BankName | string;

  /**
   * Bank Account Number
   *
   * Bank account number for receiving payments
   */
  @Column({
    name: 'bank_number',
    type: 'decimal',
    precision: 20,
    scale: 0,
    nullable: true,
  })
  bankNumber?: number;

  /**
   * Bank Branch
   *
   * Branch location of the bank
   */
  @Column({ name: 'bank_branch', type: 'text', nullable: true })
  bankBranch?: string;

  /**
   * SePay Virtual Account
   *
   * SePay virtual account number for payment processing
   */
  @Column({ name: 'sepay_va', type: 'text', nullable: true })
  sepayVa?: string;

  /**
   * Verification Status
   *
   * Indicates whether the clinic administrator is verified
   */
  @Column({ name: 'is_verify', type: 'boolean', default: false, nullable: true })
  isVerify?: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date;
}
