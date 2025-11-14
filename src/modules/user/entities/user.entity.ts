import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';

/**
 * User Role Enumeration
 * 
 * Defines the access levels and capabilities for different user types:
 * - PATIENT: End users who can book appointments and manage their health data
 * - CLINIC_STAFF: Staff members linked to a patient's clinic account
 * - DOCTOR: Medical professionals (future feature)
 * - ADMIN: System administrators with full access
 */
export enum UserRole {
  PATIENT = 'PATIENT',
  CLINIC_STAFF = 'CLINIC_STAFF',
  DOCTOR = 'DOCTOR',
  ADMIN = 'ADMIN',
}

/**
 * User Entity
 * 
 * Core user account model supporting multiple authentication methods
 * 
 * Features:
 * - Standard email/password authentication
 * - Google OAuth authentication
 * - Email verification system (pending implementation)
 * - Role-based access control
 * - Patient-ClinicStaff relationship
 * 
 * Relationships:
 * - A PATIENT can own multiple CLINIC_STAFF accounts
 * - A CLINIC_STAFF must be linked to one PATIENT account
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ nullable: true })
  name: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.PATIENT,
  })
  role: UserRole;

  /**
   * Email Verification Fields
   * Used for standard registration flow (not OAuth)
   * TODO: Implement email verification service
   */
  @Column({ default: false })
  isEmailVerified: boolean;

  @Column({ nullable: true })
  emailVerificationToken?: string;

  @Column({ nullable: true })
  emailVerificationExpires?: Date;

  /**
   * OAuth Authentication Fields
   * Currently supports Google OAuth only
   */
  @Column({ nullable: true })
  googleId?: string;

  @Column({ default: false })
  isOAuthUser: boolean;

  @Column({ nullable: true })
  profilePicture?: string;

  /**
   * Patient-ClinicStaff Relationship
   * 
   * If this user has role CLINIC_STAFF, patientOwner references the PATIENT
   * who purchased the clinic service and owns this staff account
   */
  @ManyToOne(() => User, (user) => user.clinicStaffs, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  patientOwner?: User;

  /**
   * Clinic Staff Accounts
   * 
   * If this user has role PATIENT, clinicStaffs contains all CLINIC_STAFF
   * accounts they have created for their clinic
   */
  @OneToMany(() => User, (user) => user.patientOwner)
  clinicStaffs?: User[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
