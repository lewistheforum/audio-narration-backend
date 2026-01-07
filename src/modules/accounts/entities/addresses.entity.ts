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
import { Account } from './accounts.entity';

/**
 * Address Entity
 *
 * Stores address information for accounts
 */
@Entity('addresses')
export class Address {
  @PrimaryGeneratedColumn('uuid')
  _id: string;

  @Column({ name: 'account_id', type: 'uuid' })
  accountId: string;

  @ManyToOne(() => Account, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'account_id' })
  account?: Account;

  @Column({ name: 'address', type: 'text' })
  address: string;

  @Column({ name: 'ward', type: 'varchar', length: 100 })
  ward: string;

  @Column({ name: 'district', type: 'varchar', length: 100 })
  district: string;

  @Column({ name: 'province', type: 'varchar', length: 100 })
  province: string;

  @Column({ name: 'province_name', type: 'text' })
  provinceName: string;

  @Column({ name: 'district_name', type: 'text' })
  districtName: string;

  @Column({ name: 'ward_name', type: 'text' })
  wardName: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date;
}
