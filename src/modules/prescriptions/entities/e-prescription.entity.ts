import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { ERM } from './erm.entity';
import { Appointment } from '../../appointments/entities/appointment.entity';

/**
 * EPrescription Entity
 *
 * Stores electronic prescriptions
 */
@Entity('e_prescriptions')
export class EPrescription {
  @PrimaryGeneratedColumn('uuid')
  _id: string;

  @Column({ name: 'appointment_id', type: 'uuid', unique: true })
  appointmentId: string;

  @OneToOne(() => Appointment, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'appointment_id' })
  appointment?: Appointment;

  @Column({ name: 'reference_id', type: 'varchar', nullable: true })
  referenceId?: string;

  @Column({ name: 'doctor_note', type: 'text', nullable: true })
  doctorNote?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date;
}
