import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ClinicShift } from './clinic-shift.entity';

/**
 * ClinicShiftHour Entity
 *
 * Stores shift hour details for clinic shifts
 */
@Entity('clinic_shift_hour')
export class ClinicShiftHour {
  @PrimaryGeneratedColumn('uuid', { name: '_id' })
  id: string;

  @Column({ name: 'shift_id', type: 'uuid' })
  shiftId: string;

  @ManyToOne(() => ClinicShift, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'shift_id' })
  shift?: ClinicShift;

  @Column({ name: 'star_hour', type: 'time' })
  starHour: string;

  @Column({ name: 'end_hour', type: 'time' })
  endHour: string;

  @Column({ name: 'limit', type: 'smallint' })
  limit: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date;
}
