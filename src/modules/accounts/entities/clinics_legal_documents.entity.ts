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

/**
 * ClinicsLegalDocuments Entity
 *
 * Stores legal documents for clinics
 */
@Entity('clinics_legal_documents')
export class ClinicsLegalDocuments {
  @PrimaryGeneratedColumn('uuid', { name: '_id' })
  id: string;

  @Column({ name: 'account_id', type: 'uuid' })
  accountId: string;

  @ManyToOne(() => Account, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'account_id' })
  account?: Account;

  @Column({ name: 'operating_license', type: 'text', nullable: true })
  operatingLicense?: string;

  @Column({ name: 'business_license', type: 'text', nullable: true })
  businessLicense?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date;
}
