import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  ManyToMany,
  JoinColumn,
} from 'typeorm';
import { Account } from '../../accounts/entities/accounts.entity';
import { ClinicRoom } from '../../accounts/entities/clinic_room.entity';
import { ClinicShift } from './clinic-shift.entity';
import { WeekDay } from '../enums';

/**
 * EmployeeSchedule Entity
 *
 * Stores employee schedules for appointments and work assignments
 * Note: Table name is 'employee_schedule' to support all employee types
 */
@Entity('employee_schedule')
export class EmployeeSchedule {
  @PrimaryGeneratedColumn('uuid')
  _id: string;

  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId: string;

  @ManyToOne(() => Account, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'employee_id', referencedColumnName: '_id' })
  employee?: Account;

  @Column({ name: 'clinic_id', type: 'uuid' })
  clinicId: string;

  @ManyToOne(() => Account, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'clinic_id', referencedColumnName: '_id' })
  clinic?: Account;

  @Column({ name: 'clinic_shift_id', type: 'uuid' })
  clinicShiftId: string;

  @ManyToOne(() => ClinicShift, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'clinic_shift_id', referencedColumnName: '_id' })
  clinicShift?: ClinicShift;

  @Column({ name: 'work_date', type: 'date' })
  workDate: Date;

  @Column({
    name: 'week_day',
    type: 'enum',
    enum: WeekDay,
  })
  weekDay: WeekDay;

  @ManyToMany(() => ClinicRoom, (room) => room.employeeSchedules)
  rooms?: ClinicRoom[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date;
}
