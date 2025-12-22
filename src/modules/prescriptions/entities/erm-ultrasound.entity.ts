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
 * ERMUltrasound Entity
 *
 * Stores ultrasound examination records
 */
@Entity('erm_ultrasounds')
export class ERMUltrasound {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id: string;

  @Column({ name: 'erm_id', type: 'uuid' })
  ermId: string;

  @ManyToOne(() => ERM, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'erm_id' })
  erm?: ERM;

  @Column({ name: 'service_code', type: 'varchar', length: 50, nullable: true })
  serviceCode?: string;

  @Column({ name: 'indication', type: 'text', nullable: true })
  indication?: string;

  @Column({ name: 'body_site', type: 'text', nullable: true })
  bodySite?: string;

  @Column({
    name: 'side',
    type: 'enum',
    enum: BodySide,
    nullable: true,
  })
  side?: BodySide;

  @Column({ name: 'technique', type: 'text', nullable: true })
  technique?: string;

  @Column({ name: 'findings', type: 'text', nullable: true })
  findings?: string;

  @Column({ name: 'measurements', type: 'jsonb', nullable: true })
  measurements?: any;

  @Column({ name: 'conclusion', type: 'text', nullable: true })
  conclusion?: string;

  @Column({ name: 'recommendations', type: 'text', nullable: true })
  recommendations?: string;

  @Column({ name: 'image_urls', type: 'jsonb', nullable: true })
  imageUrls?: any;

  @CreateDateColumn({ name: 'performed_at', type: 'timestamptz' })
  performedAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date;
}
