import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, ManyToOne, JoinColumn, ManyToMany, JoinTable, Index } from 'typeorm';
import { Account } from '../../accounts/entities/accounts.entity';
import { EmployeeSchedule } from './employee-schedule.entity';

@Entity('clinic_room')
@Index('idx_clinic_room_clinic_id', ['clinicId'])
export class ClinicRoom {
  @PrimaryGeneratedColumn('uuid')
  _id: string;

  @Column({ name: 'clinic_id', type: 'uuid' })
  clinicId: string;

  @ManyToOne(() => Account, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinic_id', referencedColumnName: '_id' })
  clinic?: Account;

  @Column({ name: 'room_name', type: 'text' })
  roomName: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date;

  @ManyToMany(() => EmployeeSchedule, (schedule) => schedule.rooms)
  @JoinTable({
    name: 'clinic_room_employee_schedule',
    joinColumn: { name: 'clinic_room_id', referencedColumnName: '_id' },
    inverseJoinColumn: { name: 'employee_schedule_id', referencedColumnName: '_id' },
  })
  employeeSchedules?: EmployeeSchedule[];
}
