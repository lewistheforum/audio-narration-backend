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
import { FeedbackType } from '../enums';

/**
 * Feedback Entity
 *
 * Stores feedback from patients about doctors and clinics
 */
@Entity('feedbacks')
export class Feedback {
  @PrimaryGeneratedColumn('uuid')
  _id: string;

  @Column({ name: 'appointment_id', type: 'uuid' })
  appointmentId: string;

  @Column({ name: 'clinic_id', type: 'uuid' })
  clinicId: string;

  @ManyToOne(() => Account, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Account;

  @Column({ name: 'doctor_id', type: 'uuid', nullable: true })
  doctorId?: string;

  @ManyToOne(() => Account, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'doctor_id' })
  doctor?: Account;

  @Column({ name: 'rating', type: 'smallint' })
  rating: number;

  @Column({ name: 'description', type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'description_label', type: 'jsonb', nullable: true })
  descriptionLabel?: any;

  @Column({ name: 'feedback_images', type: 'jsonb', nullable: true })
  feedbackImages?: any;

  @Column({ name: 'feedback_images_label', type: 'jsonb', nullable: true })
  feedbackImagesLabel?: any;

  @Column({
    name: 'type',
    type: 'enum',
    enum: FeedbackType,
  })
  type: FeedbackType;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date;
}
