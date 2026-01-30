import { ApiProperty } from '@nestjs/swagger';
import { LegalDocumentVerificationStatus } from '../../accounts/enums/legal-document-verification-status.enum';
import { RegistrationStatus } from '../../subscriptions/enums/subscription-status.enum';

/**
 * Clinic Admin Info DTO
 *
 * Clinic admin account information
 */
export class ClinicAdminInfoDto {
  @ApiProperty({ description: 'Account ID' })
  accountId: string;

  @ApiProperty({ description: 'Username' })
  username: string;

  @ApiProperty({ description: 'Email' })
  email: string;

  @ApiProperty({ description: 'Phone' })
  phone: string;

  @ApiProperty({ description: 'Clinic name' })
  clinicName: string;

  @ApiProperty({ description: 'Clinic description', required: false })
  description?: string;

  @ApiProperty({ description: 'Specialized in', required: false })
  specializedIn?: string[];
}

/**
 * Clinic Manager Info DTO
 *
 * Clinic manager account information
 */
export class ClinicManagerInfoDto {
  @ApiProperty({ description: 'Manager account ID' })
  accountId: string;

  @ApiProperty({ description: 'Full name' })
  fullName: string;

  @ApiProperty({ description: 'Email' })
  email: string;

  @ApiProperty({ description: 'Phone' })
  phone: string;

  @ApiProperty({ description: 'Clinic branch name' })
  clinicBranchName: string;
}

/**
 * Legal Documents Info DTO
 *
 * Legal documents information
 */
export class LegalDocumentsInfoDto {
  @ApiProperty({ description: 'Manager account ID' })
  managerAccountId: string;

  @ApiProperty({ description: 'Operating license URL' })
  operatingLicense: string;

  @ApiProperty({ description: 'Business license URL' })
  businessLicense: string;

  @ApiProperty({ description: 'Tax ID URL', required: false })
  taxIdUrl?: string;

  @ApiProperty({
    description: 'Verification status',
    enum: LegalDocumentVerificationStatus,
  })
  verificationStatus: LegalDocumentVerificationStatus;
}

/**
 * Subscription Info DTO
 *
 * Subscription information
 */
export class SubscriptionInfoDto {
  @ApiProperty({ description: 'Subscription ID' })
  id: string;

  @ApiProperty({ description: 'Service ID' })
  serviceId: string;

  @ApiProperty({
    description: 'Subscription status',
    enum: RegistrationStatus,
  })
  subscriptionStatus: RegistrationStatus;

  @ApiProperty({ description: 'Subscription date', required: false })
  subscriptionDate?: Date;

  @ApiProperty({ description: 'Expiration date', required: false })
  expirationDate?: Date;
}

/**
 * Registration Detail Response DTO
 *
 * Full registration details for a single clinic
 */
export class RegistrationDetailResponseDto {
  @ApiProperty({ type: ClinicAdminInfoDto })
  clinicAdmin: ClinicAdminInfoDto;

  @ApiProperty({ type: ClinicManagerInfoDto })
  clinicManager: ClinicManagerInfoDto;

  @ApiProperty({ type: LegalDocumentsInfoDto })
  legalDocuments: LegalDocumentsInfoDto;

  @ApiProperty({ type: SubscriptionInfoDto })
  subscription: SubscriptionInfoDto;

  @ApiProperty({ description: 'Rejection reason (if rejected)', required: false })
  rejectionReason?: string;
}
