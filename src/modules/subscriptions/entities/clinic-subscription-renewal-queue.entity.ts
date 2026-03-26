import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Account } from '../../accounts/entities/accounts.entity';
import { SubscriptionService } from './subscription-service.entity';

/**
 * ClinicSubscriptionRenewalQueue Entity
 *
 * Stores pending subscription renewal requests for clinics
 * Used for scheduling subscription activations at specific dates
 *
 * Constraint: One clinic can only have one pending renewal request at a time (clinic_id is unique)
 */
@Entity('clinic_subscription_renewal_queue')
@Index('idx_renewal_queue_clinic_id', ['clinicId'])
@Index('idx_renewal_queue_next_service_id', ['nextServiceId'])
@Index('idx_renewal_queue_target_start_date', ['targetStartDate'])
export class ClinicSubscriptionRenewalQueue {
  @PrimaryGeneratedColumn('uuid')
  _id: string;

  @Column({ name: 'clinic_id', type: 'uuid', unique: true })
  clinicId: string;

  @ManyToOne(() => Account, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'clinic_id' })
  clinic?: Account;

  @Column({ name: 'next_service_id', type: 'uuid' })
  nextServiceId: string;

  @ManyToOne(() => SubscriptionService, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'next_service_id' })
  nextService?: SubscriptionService;

  @Column({ name: 'target_start_date', type: 'timestamptz' })
  targetStartDate: Date;

  @Column({ name: 'target_end_date', type: 'timestamptz' })
  targetEndDate: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
