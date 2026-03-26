import { ApiProperty } from '@nestjs/swagger';
import { AccountStatus } from '../../accounts/enums/account-status.enum';
import { AccountRole } from '../../accounts/enums/account-role.enum';
import { RegistrationStatus } from '../../subscriptions/enums/subscription-status.enum';

export class ActiveClinicSubscriptionDto {
  @ApiProperty({ description: 'Subscription ID' })
  id: string;

  @ApiProperty({ description: 'Subscription status', enum: RegistrationStatus })
  subscriptionStatus: RegistrationStatus;

  @ApiProperty({ description: 'Service ID' })
  serviceId: string;

  @ApiProperty({ description: 'Expiration date', required: false })
  expirationDate?: Date;
}

export class ActiveClinicInfoDto {
  @ApiProperty({ description: 'Clinic information ID' })
  id: string;

  @ApiProperty({ description: 'Name of the clinic' })
  clinicName: string;

  @ApiProperty({ description: 'Clinic phone number', required: false })
  clinicPhone?: string;

  @ApiProperty({ description: 'Clinic description', required: false })
  description?: string;

  @ApiProperty({ description: 'Specializations', required: false })
  specializedIn?: string | string[];

  @ApiProperty({ description: 'Pros', required: false })
  pros?: string | string[];

  @ApiProperty({ description: 'Paraclinical services', required: false })
  paraclinical?: string | string[];

  @ApiProperty({ description: 'Date of birth', required: false })
  dob?: Date;

  @ApiProperty({ description: 'Profile picture URL', required: false })
  profilePicture?: string;

  @ApiProperty({ description: 'Bank name', required: false })
  bankName?: string;

  @ApiProperty({ description: 'Bank account number', required: false })
  bankNumber?: string;

  @ApiProperty({ description: 'Bank branch', required: false })
  bankBranch?: string;

  @ApiProperty({ description: 'SePay virtual account', required: false })
  sepayVa?: string;

  @ApiProperty({ description: 'Verification status' })
  isVerify?: boolean;
}

export class ActiveClinicAdminDto {
  @ApiProperty({ description: 'Account ID' })
  id: string;

  @ApiProperty({ description: 'Username' })
  username: string;

  @ApiProperty({ description: 'Email address' })
  email: string;

  @ApiProperty({ description: 'Phone number', required: false })
  phone?: string;

  @ApiProperty({ description: 'Account status', enum: AccountStatus })
  status: AccountStatus;

  @ApiProperty({ description: 'Account role', enum: AccountRole })
  role: AccountRole;

  @ApiProperty({ description: 'Account creation date' })
  createdAt: Date;

  @ApiProperty({ description: 'Clinic information', type: ActiveClinicInfoDto, required: false })
  clinicAdminInformation?: ActiveClinicInfoDto | null;

  @ApiProperty({ description: 'Active subscription information', type: ActiveClinicSubscriptionDto, required: false })
  subscription?: ActiveClinicSubscriptionDto | null;
}

export class ActiveClinicAdminsResponseDto {
  @ApiProperty({ description: 'List of active clinic admins', type: [ActiveClinicAdminDto] })
  data: ActiveClinicAdminDto[];

  @ApiProperty({ description: 'Response message' })
  message: string;
}
