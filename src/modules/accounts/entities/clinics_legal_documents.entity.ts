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
import { LegalDocumentVerificationStatus } from '../enums';
import { encryptionTransformer } from '../../../common/transformers/encryption.transformer';

/**
 * ClinicsLegalDocuments Entity
 *
 * Stores legal documents for clinics
 *
 * WARNING: Data Loss Risk
 * This entity has had the following columns removed:
 * - bank_name (bankName property)
 * - sepay_va (sepayVa property)
 * - is_sepay_verify (isSepayVerify property)
 *
 * Due to TypeORM synchronize: true, these columns will be automatically dropped
 * from the database on application startup, resulting in permanent data loss
 * for any existing data in these columns.
 */
@Entity('clinics_legal_documents')
export class ClinicsLegalDocuments {
  @PrimaryGeneratedColumn('uuid')
  _id: string;

  @Column({ name: 'account_id', type: 'uuid', unique: true })
  accountId: string;

  @OneToOne(() => Account, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'account_id' })
  account?: Account;

  @Column({ name: 'operating_license', type: 'text', nullable: true, transformer: encryptionTransformer })
  operatingLicense?: string;

  @Column({ name: 'business_license', type: 'text', nullable: true, transformer: encryptionTransformer })
  businessLicense?: string;

  @Column({
    name: 'verification_status',
    type: 'enum',
    enum: LegalDocumentVerificationStatus,
    default: LegalDocumentVerificationStatus.NOT_SUBMITTED,
  })
  verificationStatus: LegalDocumentVerificationStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date;
}
