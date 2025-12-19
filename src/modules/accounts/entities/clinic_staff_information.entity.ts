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
import { Gender, ClinicRole } from '../enums';

/**
 * ClinicStaffInformation Entity
 *
 * Stores information about clinic staff members
 */
@Entity('clinic_staff_information')
export class ClinicStaffInformation {
  @PrimaryGeneratedColumn('uuid', { name: '_id' })
  id: string;

  @Column({ name: 'clinic_acc_id', type: 'uuid' })
  clinicAccId: string;

  @ManyToOne(() => Account, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'clinic_acc_id' })
  clinicAccount?: Account;

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

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date;
}
