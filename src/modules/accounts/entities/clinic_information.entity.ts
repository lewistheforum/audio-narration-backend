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
 * ClinicInformation Entity
 *
 * Stores detailed information about clinics
 */
@Entity('clinic_information')
export class ClinicInformation {
  @PrimaryGeneratedColumn('uuid', { name: '_id' })
  id: string;

  @Column({ name: 'clinic_id', type: 'uuid' })
  clinicId: string;

  @ManyToOne(() => Account, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'clinic_id' })
  clinic?: Account;

  @Column({ name: 'clinic_name', type: 'text' })
  clinicName: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'specialized_in', type: 'jsonb', nullable: true })
  specializedIn?: string[];

  @Column({ name: 'pros', type: 'jsonb', nullable: true })
  pros?: string[];

  @Column({ name: 'paraclinical', type: 'jsonb', nullable: true })
  paraclinical?: string[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date;
}
