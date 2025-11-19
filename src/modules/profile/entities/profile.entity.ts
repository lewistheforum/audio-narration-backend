import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

/**
 * Gender Enumeration
 */
export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
}

/**
 * Blood Type Enumeration
 */
export enum BloodType {
  A_POSITIVE = 'A+',
  A_NEGATIVE = 'A-',
  B_POSITIVE = 'B+',
  B_NEGATIVE = 'B-',
  AB_POSITIVE = 'AB+',
  AB_NEGATIVE = 'AB-',
  O_POSITIVE = 'O+',
  O_NEGATIVE = 'O-',
}

/**
 * Profile Entity
 * 
 * Extended user information for healthcare purposes
 * One-to-one relationship with User entity
 * 
 * Features:
 * - Personal information (phone, address, DOB)
 * - Health information (blood type, allergies, medical conditions)
 * - Emergency contact information
 * - Insurance details
 * 
 * Privacy:
 * - Users can control visibility of their profile information
 * - Sensitive health data is optional
 */
@Entity('profiles')
export class Profile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * User Relationship
   * One profile belongs to one user
   */
  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ name: 'userId' })
  userId: string;

  /**
   * Personal Information
   */
  @Column({ nullable: true })
  phoneNumber?: string;

  @Column({ type: 'date', nullable: true })
  dateOfBirth?: Date;

  @Column({
    type: 'enum',
    enum: Gender,
    nullable: true,
  })
  gender?: Gender;

  @Column({ type: 'text', nullable: true })
  address?: string;

  @Column({ nullable: true })
  city?: string;

  @Column({ nullable: true })
  state?: string;

  @Column({ nullable: true })
  country?: string;

  @Column({ nullable: true })
  postalCode?: string;

  /**
   * Health Information
   */
  @Column({
    type: 'enum',
    enum: BloodType,
    nullable: true,
  })
  bloodType?: BloodType;

  @Column({ 
    type: 'decimal', 
    precision: 5, 
    scale: 2, 
    nullable: true,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => value ? parseFloat(value) : null,
    },
  })
  height?: number; // in cm

  @Column({ 
    type: 'decimal', 
    precision: 5, 
    scale: 2, 
    nullable: true,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => value ? parseFloat(value) : null,
    },
  })
  weight?: number; // in kg

  @Column({ type: 'text', nullable: true })
  allergies?: string; // Comma-separated or JSON string

  @Column({ type: 'text', nullable: true })
  medicalConditions?: string; // Comma-separated or JSON string

  @Column({ type: 'text', nullable: true })
  currentMedications?: string; // Comma-separated or JSON string

  /**
   * Emergency Contact
   */
  @Column({ nullable: true })
  emergencyContactName?: string;

  @Column({ nullable: true })
  emergencyContactPhone?: string;

  @Column({ nullable: true })
  emergencyContactRelationship?: string;

  /**
   * Insurance Information
   */
  @Column({ nullable: true })
  insuranceProvider?: string;

  @Column({ nullable: true })
  insurancePolicyNumber?: string;

  /**
   * Additional Information
   */
  @Column({ type: 'text', nullable: true })
  bio?: string; // Short biography or description

  @Column({ nullable: true })
  occupation?: string;

  @Column({ nullable: true })
  avatar?: string; // Profile avatar/photo URL (Cloudinary or other CDN)

  @Column({ default: false })
  isProfileComplete: boolean; // Flag to track if user completed their profile

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
