import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AccountStatus } from '../enums/account-status.enum';
import { Gender } from '../enums/gender.enum';

/**
 * Manager Staff/Doctor Item DTO
 * Represents personnel under the manager
 */
export class ManagerPersonnelDto {
  @ApiProperty({ description: 'Account ID' })
  accountId: string;

  @ApiProperty({ description: 'Full name' })
  fullName: string;

  @ApiProperty({ description: 'Role (DOCTOR or CLINIC_STAFF)' })
  role: string;

  @ApiProperty({ description: 'Email address' })
  email: string;

  @ApiProperty({ description: 'Account status' })
  status: AccountStatus;

  @ApiPropertyOptional({ description: 'Clinic role (for staff only)' })
  clinicRole?: string;

  @ApiPropertyOptional({ description: 'Specialization (for doctor only)' })
  specialization?: string;
}

/**
 * Manager Legal Documents DTO
 */
export class ManagerLegalDocumentsDto {
  @ApiPropertyOptional({ description: 'Operating license URL (encrypted)' })
  operatingLicense?: string;

  @ApiPropertyOptional({ description: 'Business license URL (encrypted)' })
  businessLicense?: string;

  @ApiPropertyOptional({ description: 'Tax ID document URL (encrypted)' })
  taxIdUrl?: string;

  @ApiProperty({ description: 'Verification status' })
  verificationStatus: string;

  @ApiPropertyOptional({ description: 'Rejection reason (if rejected)' })
  rejectionReason?: string;

  @ApiPropertyOptional({ description: 'Last updated timestamp' })
  updatedAt?: Date;
}

/**
 * Manager Address with Google Maps DTO
 */
export class ManagerAddressDto {
  @ApiProperty({ description: 'Full address string' })
  address: string;

  @ApiProperty({ description: 'Ward name' })
  wardName: string;

  @ApiProperty({ description: 'District name' })
  districtName: string;

  @ApiProperty({ description: 'Province name' })
  provinceName: string;

  @ApiPropertyOptional({ description: 'Google Maps iframe HTML' })
  googleMapIframe?: string;
}

/**
 * Manager Detail Response DTO
 * Complete information about a single manager
 */
export class ManagerDetailResponseDto {
  @ApiProperty({ description: 'Manager account ID' })
  managerId: string;

  @ApiProperty({ description: 'Clinic Admin parent ID' })
  clinicAdminId: string;

  @ApiProperty({ description: 'Manager full name' })
  fullName: string;

  @ApiProperty({ description: 'Clinic branch name' })
  clinicBranchName: string;

  @ApiProperty({ description: 'Email address' })
  email: string;

  @ApiProperty({ 
    description: 'Account status',
    enum: AccountStatus
  })
  status: AccountStatus;

  @ApiProperty({ 
    description: 'Gender',
    enum: Gender
  })
  gender: Gender;

  @ApiPropertyOptional({ description: 'Date of birth' })
  dob?: Date;

  @ApiPropertyOptional({ description: 'Profile picture URL' })
  profilePicture?: string;

  @ApiProperty({ 
    type: ManagerAddressDto,
    description: 'Address information'
  })
  address: ManagerAddressDto;

  @ApiProperty({ 
    type: ManagerLegalDocumentsDto,
    description: 'Legal documents with verification status'
  })
  legalDocuments: ManagerLegalDocumentsDto;

  @ApiProperty({ 
    type: [ManagerPersonnelDto],
    description: 'List of staff and doctors under this manager'
  })
  personnel: ManagerPersonnelDto[];

  @ApiProperty({ description: 'Account creation date' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update date' })
  updatedAt: Date;
}
