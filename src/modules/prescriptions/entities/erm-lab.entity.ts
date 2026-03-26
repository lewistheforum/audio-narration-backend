import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ERM } from './erm.entity';
import { PanelName } from '../enums';

/**
 * ERMLab Entity
 *
 * Stores laboratory test results for patient ERM records
 */
@Entity('erm_labs')
@Index('idx_erm_lab_erm_id', ['ermId'])
export class ERMLab {
  @PrimaryGeneratedColumn('uuid', { name: '_id' })
  _id: string;

  @Column({ name: 'erm_id', type: 'uuid' })
  ermId: string;

  @ManyToOne(() => ERM, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'erm_id' })
  erm?: ERM;

  @Column({
    name: 'panel_name',
    type: 'enum',
    enum: PanelName,
  })
  panelName: PanelName;

  @Column({ name: 'specimen_type', type: 'varchar', length: 50 })
  specimenType: string;

  @Column({ name: 'collected_at', type: 'timestamptz' })
  collectedAt: Date;

  @Column({ name: 'received_at', type: 'timestamptz' })
  receivedAt: Date;

  @Column({ name: 'reported_at', type: 'timestamptz' })
  reportedAt: Date;

  @Column({ name: 'results', type: 'jsonb' })
  results: any;

  @Column({ name: 'abnormal_summary', type: 'boolean' })
  abnormalSummary: boolean;

  @Column({ name: 'conclusion', type: 'text' })
  conclusion: string;

  @Column({ name: 'recommendations', type: 'text' })
  recommendations: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date;
}
