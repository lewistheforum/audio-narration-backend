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
import { SubscriptionService } from './subscription-service.entity';
import { SubscriptionStatus } from '../enums';

/**
 * ClinicSubscriptionHistory Entity
 *
 * Stores historical subscription records for clinics
 */
@Entity('clinic_subcriptions_history')
export class ClinicSubscriptionHistory {
  @PrimaryGeneratedColumn('uuid')
  _id: string;

  @Column({ name: 'clinic_id', type: 'uuid' })
  clinicId: string;

  @ManyToOne(() => Account, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'clinic_id' })
  clinic?: Account;

  @Column({ name: 'service_id', type: 'uuid' })
  serviceId: string;

  @ManyToOne(() => SubscriptionService, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'service_id' })
  service?: SubscriptionService;

  @Column({ name: 'subscription_date', type: 'timestamptz' })
  subscriptionDate: Date;

  @Column({ name: 'expiration_date', type: 'timestamptz' })
  expirationDate: Date;

  @Column({
    name: 'subscription_status',
    type: 'enum',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.PENDING_DOCUMENT_UPLOAD,
  })
  subscriptionStatus: SubscriptionStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date;
}
