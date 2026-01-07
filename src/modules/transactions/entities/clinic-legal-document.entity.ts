import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('clinics_legal_documents')
export class ClinicLegalDocument {
  @PrimaryGeneratedColumn('uuid', { name: '_id' })
  id: string;

  @Column({ name: 'account_id', type: 'uuid' })
  accountId: string;

  @Column({ name: 'operating_license', type: 'text', nullable: true })
  operatingLicense?: string;

  @Column({ name: 'business_license', type: 'text', nullable: true })
  businessLicense?: string;

  @Column({ name: 'bank_name', type: 'text', nullable: true })
  bankName?: string;

  @Column({ name: 'sepay_va', type: 'text', nullable: true })
  sepayVa?: string;

  @Column({ name: 'is_sepay_verify', type: 'boolean', default: false })
  isSepayVerify: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;
}
