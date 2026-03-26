import { ApiProperty } from '@nestjs/swagger';
import { AccountStatus } from '../../accounts/enums/account-status.enum';
import { AccountRole } from '../../accounts/enums/account-role.enum';
import { Gender } from '../../accounts/enums';

export class AdminGeneralAccountDto {
  @ApiProperty({ description: 'General account ID' })
  id: string;

  @ApiProperty({ description: 'Full name', required: false })
  fullName?: string;

  @ApiProperty({ description: 'Gender', enum: Gender, required: false })
  gender?: Gender;

  @ApiProperty({ description: 'Date of birth', required: false })
  dob?: Date;

  @ApiProperty({ description: 'Profile picture URL', required: false })
  profilePicture?: string;
}

export class AdminAccountDto {
  @ApiProperty({ description: 'Account ID' })
  id: string;

  @ApiProperty({ description: 'Username' })
  username: string;

  @ApiProperty({ description: 'Email address' })
  email: string;

  @ApiProperty({ description: 'Phone number', required: false })
  phone?: string;

  @ApiProperty({ description: 'Account role', enum: AccountRole })
  role: AccountRole;

  @ApiProperty({ description: 'Account status', enum: AccountStatus })
  status: AccountStatus;

  @ApiProperty({ description: 'Whether email is verified' })
  isEmailVerified: boolean;

  @ApiProperty({ description: 'Whether user is OAuth user' })
  isOAuthUser: boolean;

  @ApiProperty({ description: 'Account creation date' })
  createdAt: Date;

  @ApiProperty({ description: 'Account last update date' })
  updatedAt: Date;

  @ApiProperty({ description: 'General account information', type: AdminGeneralAccountDto, required: false })
  generalAccount?: AdminGeneralAccountDto | null;
}

export class AdminAccountsResponseDto {
  @ApiProperty({ description: 'List of admin accounts', type: [AdminAccountDto] })
  data: AdminAccountDto[];

  @ApiProperty({ description: 'Response message' })
  message: string;
}
