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
import { BodySide } from '../enums';

/**
 * ERMXray Entity
 *
 * Stores X-ray examination records
 */
@Entity('erm_xrays')
export class ERMXray {
  @PrimaryGeneratedColumn('uuid', { name: '_id' })
  _id: string;

  @Column({ name: 'erm_id', type: 'uuid' })
  ermId: string;

  @ManyToOne(() => ERM, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'erm_id' })
  erm?: ERM;

  @Column({ name: 'region', type: 'varchar', length: 100, nullable: true })
  region?: string;

  @Column({ name: 'projection', type: 'varchar', length: 60, nullable: true })
  projection?: string;

  @Column({ name: 'indication', type: 'text', nullable: true })
  indication?: string;

  @Column({ name: 'technique', type: 'text', nullable: true })
  technique?: string;

  @Column({ name: 'findings', type: 'text', nullable: true })
  findings?: string;

  @Column({ name: 'osteoarthritis_grade', type: 'varchar', length: 60, nullable: true })
  osteoarthritisGrade?: string;

  @Column({ name: 'conclusion', type: 'text', nullable: true })
  conclusion?: string;

  @Column({ name: 'recommendations', type: 'text', nullable: true })
  recommendations?: string;

  @Column({ name: 'image_urls', type: 'jsonb', nullable: true })
  imageUrls?: any;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date;
}
