import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';

/**
 * Gender Enumeration
 *
 * Defines gender options for user profiles
 */
export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
}

/**
 * GeneralAccount Entity
 *
 * Stores general account information for patients and admins
 * Linked to the main User entity via general_acc_id
 */
@Entity('general_accounts')
export class GeneralAccount {
  @PrimaryGeneratedColumn('uuid', { name: '_id' })
  id: string;

  /**
   * Reference to the main User account
   */
  @Column({ name: 'general_acc_id', type: 'uuid' })
  generalAccId: string;

  // @ManyToOne(() => User, {
  //     onDelete: 'CASCADE',
  // })
  // @JoinColumn({ name: 'general_acc_id' })
  // generalAccount?: User;

  @Column({ name: 'full_name', type: 'text', nullable: true })
  fullName?: string;

  @Column({
    name: 'gender',
    type: 'enum',
    enum: Gender,
    nullable: true,
  })
  gender?: Gender;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date;
}
