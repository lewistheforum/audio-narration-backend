import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Account } from '../../accounts/entities/accounts.entity';
import { ClinicShiftHour } from '../../schedules/entities/clinic-shift-hour.entity';
import { ClinicRoom } from '../../schedules/entities/clinic_room.entity';
import { AppointmentStatus } from '../enums';

/**
 * Appointment Entity
 *
 * Stores patient appointment bookings
 */
@Entity('appointments')
@Index('idx_appointments_shift_date_status', ['clinicShiftHourId', 'appointmentDate', 'status'])
@Index('idx_appointments_shift_date_status_deleted', ['clinicShiftHourId', 'appointmentDate', 'status', 'deletedAt'])
@Index('idx_appointments_patient_deleted', ['patientId', 'deletedAt'])
@Index('idx_appointments_clinic_deleted', ['clinicId', 'deletedAt'])
@Index('idx_appointments_doctor_deleted', ['doctorId', 'deletedAt'])
@Index('idx_appointments_status_date', ['status', 'appointmentDate'])
@Index('idx_appointments_date_status_deleted', ['appointmentDate', 'status', 'deletedAt'])
@Index('idx_appointments_created_at', ['createdAt'])
@Index('idx_appointments_clinic_date', ['clinicId', 'appointmentDate'])
@Index('idx_appointments_patient_id', ['patientId'])
@Index('idx_appointments_patient_appointment_hour', ['patientId', 'appointmentHour'])
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

  @Column({ name: 'appointment_hour', type: 'timestamptz', nullable: true })
  appointmentHour: Date | null;

  @Column({ name: 'extra_hour', type: 'timestamptz', nullable: true })
  extraHour?: Date | null;

  /**
   * Extra Room ID: For Out-of-Hours Appointments (Option 4)
   * Manually assigned by Clinic Staff when patient arrives
   * nullable: true - Only populated for out-of-hours bookings
   */
  @Column({ name: 'extra_room_id', type: 'uuid', nullable: true })
  extraRoomId?: string | null;

  @ManyToOne(() => ClinicRoom, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'extra_room_id' })
  extraRoom?: ClinicRoom | null;

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

  /**
   * Final diagnosis from the doctor after consultation
   * Only populated for COMPLETED appointments
   */
  @Column({ type: 'text', nullable: true })
  diagnosis?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date;
}
