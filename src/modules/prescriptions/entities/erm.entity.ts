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
import { ServiceAppointment } from '../../appointments/entities/service-appointment.entity';
import { Appointment } from '../../appointments/entities/appointment.entity';
import { ERMRecordType, ERMStatus } from '../enums';

/**
 * ERM (Electronic Medical Record) Entity
 *
 * Stores electronic medical records for patient visits
 */
@Entity('erms')
export class ERM {
  @PrimaryGeneratedColumn('uuid', { name: '_id' })
  id: string;

  @Column({ name: 'service_appointments_id', type: 'uuid' })
  serviceAppointmentsId: string;

  @ManyToOne(() => ServiceAppointment, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'service_appointments_id' })
  serviceAppointment?: ServiceAppointment;

  @Column({ name: 'appointment_id', type: 'uuid' })
  appointmentId: string;

  @ManyToOne(() => Appointment, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'appointment_id' })
  appointment?: Appointment;

  @Column({
    name: 'record_type',
    type: 'enum',
    enum: ERMRecordType,
  })
  recordType: ERMRecordType;

  @Column({ name: 'service_id', type: 'varchar', length: 50, nullable: true })
  serviceId?: string;

  @Column({
    name: 'status',
    type: 'enum',
    enum: ERMStatus,
  })
  status: ERMStatus;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;

  @Column({ name: 'signed_at', type: 'timestamptz', nullable: true })
  signedAt?: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy?: string;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date;
}
