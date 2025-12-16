import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
    DeleteDateColumn,
    ManyToOne,
    OneToMany,
    JoinColumn,
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
 * - Email verification system
 * - Role-based access control
 * - Parent-Child account relationship
 */
@Entity('accounts')
export class User {
    @PrimaryGeneratedColumn('uuid', { name: '_id' })
    id: string;

    /**
     * Parent Account Reference
     * 
     * UUID reference to parent account for hierarchical relationships
     */
    @Column({ name: 'parent_id', type: 'uuid', nullable: true })
    parentId?: string;

    @ManyToOne(() => User, (user) => user.children, {
        nullable: true,
        onDelete: 'SET NULL',
    })
    @JoinColumn({ name: 'parent_id' })
    parent?: User;

    @OneToMany(() => User, (user) => user.parent)
    children?: User[];

    @Column({ name: 'username', type: 'varchar', length: 100 })
    username: string;

    @Column({ name: 'email', type: 'varchar', length: 255, unique: true })
    email: string;

    @Column({ name: 'phone', type: 'varchar', length: 20, nullable: true })
    phone?: string;

    @Column({ name: 'dob', type: 'date', nullable: true })
    dob?: Date;

    @Column({ name: 'password', type: 'varchar', length: 255 })
    password: string;

    @Column({ name: 'profile_picture', type: 'text', nullable: true })
    profilePicture?: string;

    @Column({ name: 'is_OAuth_user', type: 'boolean', default: false })
    isOAuthUser: boolean;

    @Column({ name: 'is_email_verified', type: 'boolean', default: false })
    isEmailVerified: boolean;

    @Column({
        name: 'role',
        type: 'enum',
        enum: UserRole,
        default: UserRole.PATIENT,
    })
    role: UserRole;

    @Column({
        name: 'status',
        type: 'enum',
        enum: UserStatus,
        default: UserStatus.PENDING_VERIFICATION,
    })
    status: UserStatus;

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
    updatedAt: Date;

    @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
    deletedAt?: Date;
}
