import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  ManyToMany,
  JoinTable,
  JoinColumn,
} from 'typeorm';
import { Account } from './accounts.entity';

/**
 * ClinicRoom Entity
 *
 * Manages clinic rooms and their staff assignments
 * - One clinic can have many rooms
 * - One room can be assigned to many staff members
 */
@Entity('clinic_room')
export class ClinicRoom {
  @PrimaryGeneratedColumn('uuid')
  _id: string;

  @Column({ name: 'clinic_id', type: 'uuid' })
  clinicId: string;

  @ManyToOne(() => Account, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'clinic_id' })
  clinic?: Account;

  @ManyToMany(() => Account)
  @JoinTable({
    name: 'room_staff_assignments',
    joinColumn: {
      name: 'room_id',
      referencedColumnName: 'id',
    },
    inverseJoinColumn: {
      name: 'staff_id',
      referencedColumnName: 'id',
    },
  })
  assignedStaff?: Account[];

  @Column({ name: 'room_name', type: 'text' })
  roomName: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date;
}
