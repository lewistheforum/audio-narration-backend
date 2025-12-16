import { ApiProperty } from '@nestjs/swagger';
import { User, UserRole, UserStatus } from '../entities/accounts.entity';
import { Gender, GeneralAccount } from '../entities/general_accounts.entity';

/**
 * Client Response DTO
 * 
 * Sanitized client data returned to API consumers
 * Combines data from User entity and GeneralAccount entity
 * Excludes sensitive fields like password, verification codes, etc.
 * 
 * Usage:
 * - API responses for client queries
 * - Client profile information
 * - Authentication responses
 */
export class ClientResponseDto {
    @ApiProperty({
        description: 'Unique client identifier',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    id: string;

    @ApiProperty({
        description: 'Client email address',
        example: 'user@example.com',
    })
    email: string;

    @ApiProperty({
        description: 'Client username',
        example: 'johndoe',
    })
    username: string;

    @ApiProperty({
        description: 'Client phone number',
        example: '+1234567890',
        required: false,
        nullable: true,
    })
    phone?: string;

    @ApiProperty({
        description: 'Client date of birth',
        example: '1990-01-15',
        required: false,
        nullable: true,
    })
    dob?: Date;

    @ApiProperty({
        description: 'Client role defining access permissions',
        enum: UserRole,
        example: UserRole.PATIENT,
    })
    role: UserRole;

    @ApiProperty({
        description: 'Account status',
        enum: UserStatus,
        example: UserStatus.ACTIVE,
    })
    status: UserStatus;

    @ApiProperty({
        description: 'Whether email has been verified',
        example: true,
    })
    isEmailVerified: boolean;

    @ApiProperty({
        description: 'Whether client registered via OAuth (Google)',
        example: false,
    })
    isOAuthUser: boolean;

    @ApiProperty({
        description: 'Profile picture URL',
        example: 'https://example.com/avatar.jpg',
        required: false,
        nullable: true,
    })
    profilePicture?: string;

    @ApiProperty({
        description: 'Parent account ID (for hierarchical relationships)',
        required: false,
        nullable: true,
    })
    parentId?: string;

    // GeneralAccount fields
    @ApiProperty({
        description: 'Client full name',
        example: 'John Doe',
        required: false,
        nullable: true,
    })
    fullName?: string;

    @ApiProperty({
        description: 'Client gender',
        enum: Gender,
        example: Gender.MALE,
        required: false,
        nullable: true,
    })
    gender?: Gender;

    @ApiProperty({
        description: 'Account creation timestamp',
        example: '2023-10-27T10:00:00.000Z',
    })
    createdAt: Date;

    @ApiProperty({
        description: 'Last update timestamp',
        example: '2023-10-27T10:00:00.000Z',
    })
    updatedAt: Date;

    @ApiProperty({
        description: 'Soft delete timestamp (null if not deleted)',
        example: '2023-10-27T10:00:00.000Z',
        required: false,
        nullable: true,
    })
    deletedAt?: Date;

    constructor(user: Partial<User>, generalAccount?: Partial<GeneralAccount>) {
        this.id = user.id;
        this.email = user.email;
        this.username = user.username;
        this.phone = user.phone;
        this.dob = user.dob;
        this.role = user.role;
        this.status = user.status ?? UserStatus.PENDING_VERIFICATION;
        this.isEmailVerified = user.isEmailVerified ?? false;
        this.isOAuthUser = user.isOAuthUser ?? false;
        this.profilePicture = user.profilePicture;
        this.parentId = user.parentId;
        this.createdAt = user.createdAt;
        this.updatedAt = user.updatedAt;
        this.deletedAt = user.deletedAt;

        // GeneralAccount data
        if (generalAccount) {
            this.fullName = generalAccount.fullName;
            this.gender = generalAccount.gender;
        }
    }
}
