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
import { ClinicShiftHour } from '../../schedules/entities/clinic-shift-hour.entity';
import { AppointmentStatus } from '../enums';

/**
 * Appointment Entity
 *
 * Stores patient appointment bookings
 */
@Entity('appointments')
export class Appointment {
  @PrimaryGeneratedColumn('uuid')
  _id: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Account, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'patient_id' })
  patient?: Account;

  @Column({ name: 'clinic_id', type: 'uuid' })
  clinicId: string;

  @ManyToOne(() => Account, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'clinic_id' })
  clinic?: Account;

  @Column({ name: 'doctor_id', type: 'uuid', nullable: true })
  doctorId: string | null;

  @ManyToOne(() => Account, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'doctor_id' })
  doctor?: Account | null;

  @Column({ name: 'clinic_shift_hour_id', type: 'uuid', nullable: true })
  clinicShiftHourId: string | null;

  @ManyToOne(() => ClinicShiftHour, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'clinic_shift_hour_id' })
  clinicShiftHour?: ClinicShiftHour | null;

  @Column({ name: 'appointment_date', type: 'date' })
  appointmentDate: Date;

  @Column({ name: 'appointment_hour', type: 'timestamptz' })
  appointmentHour: Date;

  @Column({ name: 'extra_hour', type: 'timestamptz', nullable: true })
  extraHour?: Date | null;

  @Column({ name: 'total', type: 'numeric', precision: 10, scale: 2 })
  total: number;

  @Column({
    name: 'status',
    type: 'enum',
    enum: AppointmentStatus,
  })
  status: AppointmentStatus;

  @Column({ name: 'is_remider', type: 'boolean', default: false })
  isRemider: boolean;

  @Column({ name: 'patient_note', type: 'text', nullable: true })
  patientNote?: string | null;

  @Column({ name: 'reject_reason', type: 'text', nullable: true })
  rejectReason?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date;
}
