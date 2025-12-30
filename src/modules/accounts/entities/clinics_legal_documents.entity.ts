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
import { BankName } from '../enums';

/**
 * ClinicsLegalDocuments Entity
 *
 * Stores legal documents for clinics
 */
@Entity('clinics_legal_documents')
export class ClinicsLegalDocuments {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column({ name: 'account_id', type: 'uuid' })
  accountId: string;

  @OneToOne(() => Account, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'account_id' })
  account?: Account;

  @Column({ name: 'operating_license', type: 'text', nullable: true })
  operatingLicense?: string;

  @Column({ name: 'business_license', type: 'text', nullable: true })
  businessLicense?: string;

  @Column({
    name: 'bank_name',
    type: 'enum',
    enum: BankName,
    nullable: true,
  })
  bankName?: BankName;

  @Column({ name: 'sepay_va', type: 'text', nullable: true })
  sepayVa?: string;

  @Column({ name: 'is_sepay_verify', type: 'boolean', default: false })
  isSepayVerify: boolean;

  @Column({ name: 'processing_step', type: 'integer', nullable: true })
  processingStep?: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date;
}
