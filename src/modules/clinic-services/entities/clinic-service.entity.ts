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
import { ClinicServiceCategory } from './clinic-service-category.entity';

/**
 * ClinicService Entity
 *
 * Stores services offered by clinics
 */
@Entity('clinic_services')
export class ClinicService {
  @PrimaryGeneratedColumn('uuid')
  _id: string;

  @Column({ name: 'category_id', type: 'uuid' })
  categoryId: string;

  @ManyToOne(() => ClinicServiceCategory, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'category_id' })
  category?: ClinicServiceCategory;

  @Column({ name: 'service_name', type: 'text' })
  serviceName: string;

  @Column({ name: 'service_code', type: 'varchar', length: 50 })
  serviceCode: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'service_functions', type: 'text', array: true, nullable: true })
  serviceFunctions?: string[];

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'create_at', type: 'timestamptz' })
  createAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date;
}
