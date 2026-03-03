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
import { Appointment } from './appointment.entity';
import { Transaction } from '../../transactions/entities/transaction.entity';
import { PaymentType, AppointmentPackageStatus } from '../enums';

/**
 * AppointmentPackage Entity
 *
 * Stores payment package information for appointments
 */
@Entity('appointment_package')
export class AppointmentPackage {
  @PrimaryGeneratedColumn('uuid')
  _id: string;

  @Column({ name: 'appointment_id', type: 'uuid' })
  appointmentId: string;

  @ManyToOne(() => Appointment, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'appointment_id' })
  appointment?: Appointment;

  @Column({ name: 'transaction_id', type: 'uuid', nullable: true })
  transactionId?: string | null;

  @ManyToOne(() => Transaction, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'transaction_id' })
  transaction?: Transaction;

  @Column({ name: 'amount', type: 'bigint' })
  amount: number;

  @Column({
    name: 'status',
    type: 'enum',
    enum: AppointmentPackageStatus,
    default: AppointmentPackageStatus.PENDING_PAYMENT,
  })
  status: AppointmentPackageStatus;

  @Column({
    name: 'payment_type',
    type: 'enum',
    enum: PaymentType,
    nullable: true,
  })
  paymentType?: PaymentType;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date;
}
