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
  @PrimaryGeneratedColumn('uuid', { name: '_id' })
  id: string;

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

  @Column({ name: 'doctor_shift_hour_id', type: 'uuid' })
  doctorShiftHourId: string;

  @ManyToOne(() => ClinicShiftHour, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'doctor_shift_hour_id' })
  doctorShiftHour?: ClinicShiftHour;

  @Column({ name: 'appointment_date', type: 'date' })
  appointmentDate: Date;

  @Column({ name: 'appointment_hour', type: 'timestamptz' })
  appointmentHour: Date;

  @Column({ name: 'room', type: 'text', nullable: true })
  room?: string;

  @Column({ name: 'total', type: 'numeric', precision: 10, scale: 2 })
  total: number;

  @Column({
    name: 'status',
    type: 'enum',
    enum: AppointmentStatus,
  })
  status: AppointmentStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date;
}
