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
import { DoctorSchedule } from './doctor-schedule.entity';

/**
 * DoctorTimekeeping Entity
 *
 * Stores check-in and check-out records for doctors
 */
@Entity('doctors_timekeeping')
export class DoctorTimekeeping {
  @PrimaryGeneratedColumn('uuid')
  _id: string;

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

  @Column({ name: 'schedule_id', type: 'uuid' })
  scheduleId: string;

  @ManyToOne(() => DoctorSchedule, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'schedule_id' })
  schedule?: DoctorSchedule;

  @Column({ name: 'check_in', type: 'timestamptz', nullable: true })
  checkIn?: Date;

  @Column({ name: 'check_out', type: 'timestamptz', nullable: true })
  checkOut?: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date;
}
