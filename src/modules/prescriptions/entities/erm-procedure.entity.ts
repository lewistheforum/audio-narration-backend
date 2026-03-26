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
import { BodySide, ImmediateOutcome } from '../enums';

/**
 * ERMProcedure Entity
 *
 * Stores medical procedure records
 */
@Entity('erm_procedures')
@Index('idx_erm_procedure_erm_id', ['ermId'])
export class ERMProcedure {
  @PrimaryGeneratedColumn('uuid', { name: '_id' })
  _id: string;

  @Column({ name: 'erm_id', type: 'uuid' })
  ermId: string;

  @ManyToOne(() => ERM, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'erm_id' })
  erm?: ERM;

  @Column({ name: 'procedure_code', type: 'varchar', length: 50, nullable: true })
  procedureCode?: string;

  @Column({ name: 'indication', type: 'text', nullable: true })
  indication?: string;

  @Column({ name: 'body_site', type: 'varchar', length: 100, nullable: true })
  bodySite?: string;

  @Column({
    name: 'side',
    type: 'enum',
    enum: BodySide,
    nullable: true,
  })
  side?: BodySide;

  @Column({ name: 'anesthesia_type', type: 'varchar', length: 100, nullable: true })
  anesthesiaType?: string;

  @Column({ name: 'performed_start', type: 'timestamptz', nullable: true })
  performedStart?: Date;

  @Column({ name: 'performed_end', type: 'timestamptz', nullable: true })
  performedEnd?: Date;

  @Column({ name: 'medications', type: 'jsonb', nullable: true })
  medications?: any;

  @Column({ name: 'devices', type: 'text', nullable: true })
  devices?: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'pain_score_before', type: 'smallint', nullable: true })
  painScoreBefore?: number;

  @Column({ name: 'pain_score_after', type: 'smallint', nullable: true })
  painScoreAfter?: number;

  @Column({
    name: 'immediate_outcome',
    type: 'enum',
    enum: ImmediateOutcome,
    nullable: true,
  })
  immediateOutcome?: ImmediateOutcome;

  @Column({ name: 'complications', type: 'jsonb', nullable: true })
  complications?: any;

  @Column({ name: 'post_care_instructions', type: 'text', nullable: true })
  postCareInstructions?: string;

  @Column({ name: 'follow_up_plan', type: 'text', nullable: true })
  followUpPlan?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date;
}
