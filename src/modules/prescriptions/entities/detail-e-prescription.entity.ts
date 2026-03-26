import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { EPrescription } from './e-prescription.entity';
import { Medicine } from './medicine.entity';

/**
 * DetailEPrescription Entity
 *
 * Stores detailed medicine information for prescriptions
 */
@Entity('detail_e_prescriptions')
@Index('idx_detail_e_prescription_e_prescription_id', ['ePrescriptionId'])
@Index('idx_detail_e_prescription_medicine_id', ['medicineId'])
export class DetailEPrescription {
  @PrimaryGeneratedColumn('uuid')
  _id: string;

  @Column({ name: 'e_prescription_id', type: 'uuid' })
  ePrescriptionId: string;

  @ManyToOne(() => EPrescription, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'e_prescription_id' })
  ePrescription?: EPrescription;

  @Column({ name: 'medicine_id', type: 'uuid' })
  medicineId: string;

  @ManyToOne(() => Medicine, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'medicine_id' })
  medicine?: Medicine;

  @Column({ name: 'check_out', type: 'text', nullable: true })
  checkOut?: string;

  @Column({ name: 'quantity', type: 'integer', nullable: true })
  quantity?: number;

  @Column({ name: 'note', type: 'text', nullable: true })
  note?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date;
}
