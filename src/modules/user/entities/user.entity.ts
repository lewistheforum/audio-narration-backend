import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
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
 * User Status Enumeration
 * 
 * Defines the account status and access state:
 * - ACTIVE: Normal active account, full access to all features
 * - INACTIVE: Temporarily deactivated by user, can be reactivated
 * - BANNED: Suspended by admin due to policy violation, cannot login
 * - PENDING_VERIFICATION: New account waiting for email verification
 */
export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  BANNED = 'BANNED',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
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
  firstName: string;

  @Column({ nullable: true })
  lastName: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.PATIENT,
  })
  role: UserRole;

  /**
   * Account Status
   * 
   * Controls user access to the system:
   * - PENDING_VERIFICATION: New accounts waiting for email verification
   * - ACTIVE: Normal active account with full access
   * - INACTIVE: Temporarily deactivated, can be reactivated
   * - BANNED: Suspended by admin, cannot login
   */
  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.PENDING_VERIFICATION,
  })
  status: UserStatus;

  /**
   * Ban Information
   * 
   * Stores reason and timestamp when account was banned
   * Only populated when status is BANNED
   */
  @Column({ nullable: true })
  banReason?: string;

  @Column({ nullable: true })
  bannedAt?: Date;

  @Column({ nullable: true })
  bannedBy?: string; // Admin ID who banned this user

  /**
   * Email Verification Fields
   * Used for standard registration flow (not OAuth)
   * Stores a 6-digit verification code that expires after 15 minutes
   */
  @Column({ default: false })
  isEmailVerified: boolean;

  @Column({ nullable: true })
  emailVerificationCode?: string;

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

  /**
   * Soft Delete Timestamp
   * 
   * When set, the user is considered deleted but data is retained
   * Allows for account recovery and data audit trails
   * TypeORM automatically excludes soft-deleted records from queries
   */
  @DeleteDateColumn()
  deletedAt?: Date;

  /**
   * Profile Relationship
   * 
   * One-to-one relationship with Profile entity
   * Contains extended user information (health data, emergency contacts, etc.)
   * Automatically deleted when user is deleted (CASCADE)
   */
  @OneToOne('Profile', 'user', { cascade: true })
  profile?: any;
}
