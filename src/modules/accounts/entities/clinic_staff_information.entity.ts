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
import { Gender, ClinicRole } from '../enums';

/**
 * ClinicStaffInformation Entity
 *
 * Stores information about clinic staff members
 */
@Entity('clinic_staff_information')
@Index('idx_clinic_staff_account_id', ['accountId'])
@Index('idx_clinic_staff_full_name', ['fullName'])
@Index('idx_clinic_staff_clinic_role', ['clinicRole'])
export class ClinicStaffInformation {
  @PrimaryGeneratedColumn('uuid')
  _id: string;

  @Column({ name: 'account_id', type: 'uuid', unique: true })
  accountId: string;

  @OneToOne(() => Account, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'account_id' })
  account?: Account;

  @Column({ name: 'full_name', type: 'text' })
  fullName: string;

  @Column({
    name: 'gender',
    type: 'enum',
    enum: Gender,
    nullable: true,
  })
  gender?: Gender;

  @Column({
    name: 'clinic_role',
    type: 'enum',
    enum: ClinicRole,
  })
  clinicRole: ClinicRole;

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
