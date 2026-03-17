import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { ClinicServiceConfig } from '../../service-configs/entities/clinic-service-config.entity';
import { AppointmentPackage } from './appointment-package.entity';
import { ERM } from '../../prescriptions/entities/erm.entity';

/**
 * ServiceAppointment Entity
 *
 * Stores services included in appointment packages
 */
@Entity('service_appointments')
export class ServiceAppointment {
  @PrimaryGeneratedColumn('uuid')
  _id: string;

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

  /**
   * Snapshot Price: Price at the time of booking
   * Source: clinic_service_config.price
   */
  @Column({ name: 'price', type: 'numeric', precision: 12, scale: 2, default: 0 })
  price: number;

  /**
   * Snapshot Discount: Discount at the time of booking
   * Source: clinic_service_config.discount
   */
  @Column({ name: 'discount', type: 'numeric', precision: 5, scale: 2, default: 0 })
  discount: number;

  @OneToOne(() => ERM, (erm) => erm.serviceAppointment, {
    nullable: true,
  })
  erm?: ERM;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date;
}
