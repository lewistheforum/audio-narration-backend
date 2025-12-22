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
import { ClinicShift } from './clinic-shift.entity';
import { WeekDay } from '../enums';

/**
 * DoctorSchedule Entity
 *
 * Stores doctor schedules for appointments
 */
@Entity('doctor_schedule')
export class DoctorSchedule {
  @PrimaryGeneratedColumn('uuid', { name: '_id' })
  id: string;

  @Column({ name: 'doctor_id', type: 'uuid' })
  doctorId: string;

  @ManyToOne(() => Account, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'doctor_id' })
  doctor?: Account;

  @Column({ name: 'clinic_id', type: 'uuid' })
  clinicId: string;

  @ManyToOne(() => Account, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'clinic_id' })
  clinic?: Account;

  @Column({ name: 'clinic_shift_id', type: 'uuid' })
  clinicShiftId: string;

  @ManyToOne(() => ClinicShift, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'clinic_shift_id' })
  clinicShift?: ClinicShift;

  @Column({ name: 'work_date', type: 'date' })
  workDate: Date;

  @Column({
    name: 'week_day',
    type: 'enum',
    enum: WeekDay,
  })
  weekDay: WeekDay;

  @Column({ name: 'room', type: 'text', nullable: true })
  room?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date;
}
