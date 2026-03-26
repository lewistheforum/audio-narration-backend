import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';
import { SubscriptionServiceStatus } from '../enums/subscription-service-status.enum';

/**
 * SubscriptionService Entity
 *
 * Stores subscription services available for clinics
 */
@Entity('subcription_services')
@Index('idx_subscription_service_status', ['status'])
@Index('idx_subscription_service_code', ['code'])
@Index('idx_subscription_service_is_popular', ['isPopular'])
export class SubscriptionService {
  @PrimaryGeneratedColumn('uuid')
  _id: string;

  @Column({ name: 'service_name', type: 'varchar', length: 150 })
  serviceName: string;

  @Column({ name: 'code', type: 'text' })
  code: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'price', type: 'numeric', precision: 10, scale: 2 })
  price: number;

  @Column({ name: 'discount', type: 'numeric', precision: 5, scale: 2, default: 0 })
  discount: number;

  @Column({ name: 'service_functions', type: 'text', array: true, nullable: true })
  serviceFunctions?: string[];

  @Column({ name: 'is_popular', type: 'boolean', default: false })
  isPopular: boolean;

  @Column({
    name: 'status',
    type: 'enum',
    enum: SubscriptionServiceStatus,
    default: SubscriptionServiceStatus.ACTIVE,
  })
  status: SubscriptionServiceStatus;

  @Column({ name: 'chart_color', type: 'text', nullable: true })
  chartColor?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date;
}
