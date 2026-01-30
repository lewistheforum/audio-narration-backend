import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  OneToOne,
} from 'typeorm';
import { Account } from '../../accounts/entities/accounts.entity';
import { ContractRole } from '../enums/contract-role.enum';
import { ClinicContractInformation } from './clinic-contract-information.entity';

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

  @OneToOne(
    () => ClinicContractInformation,
    (info) => info.contractPackage,
  )
  clinicContractInformation?: ClinicContractInformation;

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

  @Column({ name: 'manager_signature', type: 'text', nullable: true })
  managerSignature?: string;

  @Column({ name: 'employee_signature', type: 'text', nullable: true })
  employeeSignature?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date;
}
