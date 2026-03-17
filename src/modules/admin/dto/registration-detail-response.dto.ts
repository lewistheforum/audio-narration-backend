import { ApiProperty } from '@nestjs/swagger';
import { LegalDocumentVerificationStatus } from '../../accounts/enums/legal-document-verification-status.enum';
import { RegistrationStatus } from '../../subscriptions/enums/subscription-status.enum';

/**
 * Address Info DTO
 *
 * Account address information
 */
export class AddressInfoDto {
  @ApiProperty({ description: 'Specific address details' })
  address: string;

  @ApiProperty({ description: 'Ward code' })
  ward: string;

  @ApiProperty({ description: 'Ward name' })
  wardName: string;

  @ApiProperty({ description: 'District code' })
  district: string;

  @ApiProperty({ description: 'District name' })
  districtName: string;

  @ApiProperty({ description: 'Province/City code' })
  province: string;

  @ApiProperty({ description: 'Province/City name' })
  provinceName: string;
}

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

  @ApiProperty({ description: 'SePay Virtual Account', required: false })
  sepayVa?: string;

  @ApiProperty({ description: 'Verification status', required: false })
  isVerify?: boolean;

  @ApiProperty({ description: 'Pros', required: false })
  pros?: string[];

  @ApiProperty({ description: 'Paraclinical', required: false })
  paraclinical?: string[];

  @ApiProperty({ type: () => AddressInfoDto, required: false })
  address?: AddressInfoDto;
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

  @ApiProperty({ type: () => AddressInfoDto, required: false })
  address?: AddressInfoDto;
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

  @ApiProperty({ description: 'Other documents URLs', required: false })
  otherDocs?: string[];

  @ApiProperty({ description: 'Rejection reason', required: false })
  rejectionReason?: string;

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
}
