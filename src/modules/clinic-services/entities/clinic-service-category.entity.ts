import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { ServiceCategoryType } from '../enums';

/**
 * ClinicServiceCategory Entity
 *
 * Stores categories for clinic services
 */
@Entity('clinic_service_category')
export class ClinicServiceCategory {
  @PrimaryGeneratedColumn('uuid')
  _id: string;

  @Column({ name: 'category_name', type: 'text' })
  categoryName: string;

  @Column({
    name: 'type',
    type: 'enum',
    enum: ServiceCategoryType,
  })
  type: ServiceCategoryType;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date;
}
