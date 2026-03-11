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
import { ContractPackage } from './contract-package.entity';
import { ContractType } from '../enums/contract-type.enum';
import { SalaryPaymentMethod } from '../enums/salary-payment-method.enum';
import { ContractStatus } from '../../accounts/enums/contract-status.enum';

@Entity('clinic_contract_information')
export class ClinicContractInformation {
  @PrimaryGeneratedColumn('uuid')
  _id: string;

  @Column({ name: 'contract_id', type: 'uuid', unique: true })
  contractId: string;

  @OneToOne(() => ContractPackage, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'contract_id', referencedColumnName: '_id' })
  contractPackage?: ContractPackage;

  @Column({ name: 'doctor_specialty', type: 'text' })
  doctorSpecialty: string;

  @Column({ name: 'nationality', type: 'text' })
  nationality: string;

  @Column({ name: 'current_living', type: 'text' })
  currentLiving: string;

  @Column({ name: 'work_specialty_at_clinic', type: 'text' })
  workSpecialtyAtClinic: string;

  @Column({ name: 'contract_start_date', type: 'timestamptz' })
  contractStartDate: Date;

  @Column({ name: 'contract_end_date', type: 'timestamptz' })
  contractEndDate: Date;

  @Column({
    name: 'contract_type',
    type: 'enum',
    enum: ContractType,
  })
  contractType: ContractType;

  @Column({ name: 'job_description', type: 'text' })
  jobDescription: string;

  @Column({ name: 'working_time', type: 'timestamptz' })
  workingTime: Date;

  @Column({ name: 'rest_policy', type: 'text' })
  restPolicy: string;

  @Column({ name: 'leave_policy', type: 'text' })
  leavePolicy: string;

  @Column({
    name: 'base_salary',
    type: 'numeric',
    precision: 20,
    scale: 2,
  })
  baseSalary: number;

  @Column({ name: 'allowances', type: 'text' })
  allowances: string;

  @Column({ name: 'performance_bonus', type: 'text' })
  performanceBonus: string;

  @Column({
    name: 'salary_payment_method',
    type: 'enum',
    enum: SalaryPaymentMethod,
  })
  salaryPaymentMethod: SalaryPaymentMethod;

  @Column({ name: 'salary_payment_cycle', type: 'text' })
  salaryPaymentCycle: string;

  @Column({ name: 'effective_from', type: 'timestamptz' })
  effectiveFrom: Date;

  @Column({ name: 'effective_to', type: 'timestamptz' })
  effectiveTo: Date;

  @Column({ name: 'party_a_signer_name', type: 'text' })
  partyASignerName: string;

  @Column({ name: 'party_b_signer_name', type: 'text' })
  partyBSignerName: string;

  @Column({ name: 'contract_file', type: 'text', nullable: true })
  contractFile?: string;

  @Column({
    name: 'contract_status',
    type: 'enum',
    enum: ContractStatus,
    default: ContractStatus.DRAFT,
  })
  contractStatus: ContractStatus;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date;
}
