import { ApiProperty } from '@nestjs/swagger';
import { Account } from '../entities/accounts.entity';
import { GeneralAccount } from '../entities/general_accounts.entity';
import { Gender, AccountRole, AccountStatus } from '../enums';

/**
 * Account Response DTO
 *
 * Sanitized account data returned to API consumers
 * Combines data from Account entity and GeneralAccount entity
 * Excludes sensitive fields like password, verification codes, etc.
 *
 * Usage:
 * - API responses for account queries
 * - Account profile information
 * - Authentication responses
 */
export class AccountResponseDto {
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
    enum: AccountRole,
    example: AccountRole.PATIENT,
  })
  role: AccountRole;

  @ApiProperty({
    description: 'Account status',
    enum: AccountStatus,
    example: AccountStatus.ACTIVE,
  })
  status: AccountStatus;

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

  @ApiProperty({
    description: 'Number of times account has been banned',
    example: 0,
  })
  banCounts: number;

  @ApiProperty({
    description: 'Description of ban reason',
    example: 'Violation of terms of service',
    required: false,
    nullable: true,
  })
  banDescription?: string;

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

  constructor(account: Partial<Account>, generalAccount?: Partial<GeneralAccount>) {
    this.id = account.id;
    this.email = account.email;
    this.username = account.username;
    this.phone = account.phone;
    this.dob = account.dob;
    this.role = account.role;
    this.status = account.status ?? AccountStatus.PENDING_VERIFICATION;
    this.isEmailVerified = account.isEmailVerified ?? false;
    this.isOAuthUser = account.isOAuthUser ?? false;
    this.profilePicture = account.profilePicture;
    this.parentId = account.parentId;
    this.banCounts = account.banCounts ?? 0;
    this.banDescription = account.banDescription;
    this.createdAt = account.createdAt;
    this.updatedAt = account.updatedAt;
    this.deletedAt = account.deletedAt;

    // GeneralAccount data
    if (generalAccount) {
      this.fullName = generalAccount.fullName;
      this.gender = generalAccount.gender;
    }
  }
}
