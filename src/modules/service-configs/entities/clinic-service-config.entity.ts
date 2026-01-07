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
import { Account } from '../../accounts/entities/accounts.entity';
import { ClinicService } from '../../clinic-services/entities/clinic-service.entity';

/**
 * ClinicServiceConfig Entity
 *
 * Stores configuration for clinic services including pricing and duration
 */
@Entity('clinic_service_config')
export class ClinicServiceConfig {
  @PrimaryGeneratedColumn('uuid')
  _id: string;

  @Column({ name: 'service_id', type: 'uuid' })
  serviceId: string;

  @ManyToOne(() => ClinicService, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'service_id' })
  service?: ClinicService;

  @Column({ name: 'clinic_id', type: 'uuid' })
  clinicId: string;

  @ManyToOne(() => Account, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'clinic_id' })
  clinic?: Account;

  @Column({ name: 'price', type: 'numeric', precision: 12, scale: 2 })
  price: number;

  @Column({ name: 'discount', type: 'numeric', precision: 5, scale: 2, default: 0 })
  discount: number;

  @Column({ name: 'duration_min', type: 'integer', nullable: true })
  durationMin?: number;

  @Column({ name: 'note_for_patient', type: 'text', nullable: true })
  noteForPatient?: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date;
}
