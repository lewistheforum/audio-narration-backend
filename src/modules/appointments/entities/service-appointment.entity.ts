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
import { ClinicServiceConfig } from '../../service-configs/entities/clinic-service-config.entity';
import { AppointmentPackage } from './appointment-package.entity';

/**
 * ServiceAppointment Entity
 *
 * Stores services included in appointment packages
 */
@Entity('service_appointments')
export class ServiceAppointment {
  @PrimaryGeneratedColumn('uuid', { name: '_id' })
  id: string;

  @Column({ name: 'clinic_service_id', type: 'uuid' })
  clinicServiceId: string;

  @ManyToOne(() => ClinicServiceConfig, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'clinic_service_id' })
  clinicService?: ClinicServiceConfig;

  @Column({ name: 'appointment_package_id', type: 'uuid' })
  appointmentPackageId: string;

  @ManyToOne(() => AppointmentPackage, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'appointment_package_id' })
  appointmentPackage?: AppointmentPackage;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date;
}
