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
import { Address } from './addresses.entity';

/**
 * GoogleIframe Entity
 *
 * Stores Google Map iframe information for addresses
 */
@Entity('google_iframe')
export class GoogleIframe {
  @PrimaryGeneratedColumn('uuid')
  _id: string;

  @Column({ name: 'address_id', type: 'uuid' })
  addressId: string;

  @ManyToOne(() => Address, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'address_id' })
  address?: Address;

  @Column({ name: 'location', type: 'text', nullable: true })
  location?: string;

  @Column({ name: 'map_style', type: 'text', nullable: true })
  mapStyle?: string;

  @Column({ name: 'zoom_level', type: 'smallint', nullable: true })
  zoomLevel?: number;

  @Column({ name: 'map_height', type: 'integer', nullable: true })
  mapHeight?: number;

  @Column({ name: 'map_width', type: 'integer', nullable: true })
  mapWidth?: number;

  @Column({ name: 'responsive', type: 'boolean', default: true })
  responsive: boolean;

  @Column({ name: 'google_map_iframe', type: 'text', nullable: true })
  googleMapIframe?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date;
}
