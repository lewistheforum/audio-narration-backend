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
import { ERM } from './erm.entity';
import { BoneSite, WHOCategory } from '../enums';

/**
 * ERMBoneDensity Entity
 *
 * Stores bone density scan records (DEXA scan)
 */
@Entity('erm_bone_density')
export class ERMBoneDensity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column({ name: 'erm_id', type: 'uuid' })
  ermId: string;

  @ManyToOne(() => ERM, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'erm_id' })
  erm?: ERM;

  @Column({
    name: 'site',
    type: 'enum',
    enum: BoneSite,
  })
  site: BoneSite;

  @Column({ name: 'bmd_value', type: 'varchar', length: 50, nullable: true })
  bmdValue?: string;

  @Column({ name: 't_score', type: 'numeric', precision: 3, scale: 1, nullable: true })
  tScore?: number;

  @Column({ name: 'z_score', type: 'numeric', precision: 4, scale: 2, nullable: true })
  zScore?: number;

  @Column({
    name: 'who_category',
    type: 'enum',
    enum: WHOCategory,
    nullable: true,
  })
  whoCategory?: WHOCategory;

  @Column({ name: 'fracture_risk_comment', type: 'text', nullable: true })
  fractureRiskComment?: string;

  @Column({ name: 'recommendations', type: 'text', nullable: true })
  recommendations?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date;
}
