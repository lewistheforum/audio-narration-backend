import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Account } from './accounts.entity';
import { Gender } from '../enums';

/**
 * DoctorInformation Entity
 *
 * Stores detailed information about doctors
 */
@Entity('doctor_information')
export class DoctorInformation {
  @PrimaryGeneratedColumn('uuid')
  _id: string;

  @Column({ name: 'account_id', type: 'uuid', unique: true })
  accountId: string;

  @OneToOne(() => Account, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'account_id' })
  account?: Account;

  @Column({ name: 'full_name', type: 'text' })
  fullName: string;

  @Column({
    name: 'gender',
    type: 'enum',
    enum: Gender,
    nullable: true,
  })
  gender?: Gender;

  @Column({ name: 'dob', type: 'date', nullable: true })
  dob?: Date;

  @Column({ name: 'profile_picture', type: 'text', nullable: true })
  profilePicture?: string;

  @Column({ name: 'academic_degree', type: 'text', nullable: true })
  academicDegree?: string;

  @Column({ name: 'experience', type: 'text', nullable: true })
  experience?: string;

  @Column({ name: 'position', type: 'text', nullable: true })
  position?: string;

  @Column({ name: 'introduction_1', type: 'text', nullable: true })
  introduction1?: string;

  @Column({ name: 'work_process_2', type: 'jsonb', nullable: true })
  workProcess2?: Record<string, any>;

  @Column({ name: 'study_process_3', type: 'jsonb', nullable: true })
  studyProcess3?: Record<string, any>;

  @Column({ name: 'members_4', type: 'jsonb', nullable: true })
  members4?: Record<string, any>;

  @Column({ name: 'scientific_work_5', type: 'jsonb', nullable: true })
  scientificWork5?: Record<string, any>;

  @Column({ name: 'papers_6', type: 'jsonb', nullable: true })
  papers6?: Record<string, any>;

  @Column({ name: 'introduction_image', type: 'text', nullable: true })
  introductionImage?: string;

  @Column({ name: 'professional_license', type: 'jsonb', nullable: true })
  professionalLicense?: Record<string, any>;

  @Column({ name: 'certificate_practical_training', type: 'jsonb', nullable: true })
  certificatePracticalTraining?: Record<string, any>;

  @Column({ name: 'medical_license', type: 'jsonb', nullable: true })
  medicalLicense?: Record<string, any>;

  @Column({ name: 'identity_number', type: 'text', nullable: true })
  identityNumber?: string;

  @Column({ name: 'place_identity_card', type: 'text', nullable: true })
  placeIdentityCard?: string;

  @Column({ name: 'identity_date', type: 'date', nullable: true })
  identityDate?: Date;

  @Column({
    name: 'bank_number',
    type: 'decimal',
    precision: 20,
    scale: 0,
    nullable: true,
  })
  bankNumber?: number;

  @Column({ name: 'bank_name', type: 'text', nullable: true })
  bankName?: string;

  @Column({ name: 'bank_branch', type: 'text', nullable: true })
  bankBranch?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date;
}
