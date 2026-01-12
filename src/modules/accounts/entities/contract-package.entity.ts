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
import { ContractRole } from '../enums/contract-role.enum';

@Entity('contract_package')
export class ContractPackage {
  @PrimaryGeneratedColumn('uuid')
  _id: string;

  @Column({ name: 'clinic_id', type: 'uuid' })
  clinicId: string;

  @ManyToOne(() => Account, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'clinic_id', referencedColumnName: '_id' })
  clinicAccount?: Account;

  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId: string;

  @ManyToOne(() => Account, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'employee_id', referencedColumnName: '_id' })
  employeeAccount?: Account;

  @Column({
    name: 'role',
    type: 'enum',
    enum: ContractRole,
  })
  role: ContractRole;

  @Column({ name: 'header_address', type: 'text' })
  headerAddress: string;

  @Column({ name: 'header_date', type: 'timestamptz' })
  headerDate: Date;

  @Column({ name: 'clinic_representative', type: 'text' })
  clinicRepresentative: string;

  @Column({ name: 'position', type: 'text' })
  position: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date;
}
