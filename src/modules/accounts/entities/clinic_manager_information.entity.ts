import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Account } from './accounts.entity';
import { Gender } from '../enums/gender.enum';

/**
 * ClinicManagerInformation Entity
 *
 * Stores detailed information about clinic managers
 * One-to-one relationship with Account entity
 */
@Entity('clinic_manager_information')
export class ClinicManagerInformation {
  @PrimaryColumn('uuid')
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
   * Clinic Branch Name
   *
   * Name of the clinic branch managed by this manager
   */
  @Column({ name: 'clinic_branch_name', type: 'text' })
  clinicBranchName: string;

  /**
   * Full Name
   *
   * Full name of the clinic manager
   */
  @Column({ name: 'full_name', type: 'text' })
  fullName: string;

  /**
   * Gender
   *
   * Gender of the clinic manager
   */
  @Column({
    name: 'gender',
    type: 'enum',
    enum: Gender,
  })
  gender: Gender;

  /**
   * Profile Picture
   *
   * URL or path to the profile picture image
   */
  @Column({ name: 'profile_picture', type: 'text', nullable: true })
  profilePicture?: string;

  /**
   * Date of Birth
   *
   * Date of birth of the clinic manager
   */
  @Column({ name: 'dob', type: 'date', nullable: true })
  dob?: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date;
}
