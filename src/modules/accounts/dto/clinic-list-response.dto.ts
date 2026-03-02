import { ApiProperty } from '@nestjs/swagger';
import { AccountRole, AccountStatus } from '../enums';
import { ClinicAdminInformation } from '../entities';

/**
 * Clinic Info DTO
 *
 * Clinic manager information from clinic_manager_information table
 */
export class ClinicInfoDto {
  @ApiProperty({
    description: 'Clinic information ID',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  id: string;

  @ApiProperty({
    description: 'Clinic branch name',
    example: 'City Medical Clinic',
  })
  clinicBranchName: string;

  @ApiProperty({
    description: 'Clinic manager full name',
    example: 'Dr. John Smith',
  })
  fullName: string;

  @ApiProperty({
    description: 'Gender of clinic manager',
    enum: ['MALE', 'FEMALE', 'OTHER'],
    example: 'OTHER',
  })
  gender: string;

  @ApiProperty({
    description: 'Profile picture URL',
    example: 'https://example.com/clinic-avatar.jpg',
    required: false,
    nullable: true,
  })
  profilePicture?: string;

  @ApiProperty({
    description: 'Date of birth',
    example: '1980-05-15',
    required: false,
    nullable: true,
  })
  dob?: Date;
}

/**
 * Address DTO
 *
 * Address information from addresses table
 */
export class AddressDto {
  @ApiProperty({
    description: 'Address ID',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  id: string;

  @ApiProperty({
    description: 'Street address',
    example: '123 Main Street',
  })
  address: string;

  @ApiProperty({
    description: 'Ward code',
    example: '001',
  })
  ward: string;

  @ApiProperty({
    description: 'Ward name',
    example: 'Ward 1',
  })
  wardName: string;

  @ApiProperty({
    description: 'District code',
    example: '01',
  })
  district: string;

  @ApiProperty({
    description: 'District name',
    example: 'District 1',
  })
  districtName: string;

  @ApiProperty({
    description: 'Province code',
    example: '79',
  })
  province: string;

  @ApiProperty({
    description: 'Province name',
    example: 'Ho Chi Minh City',
  })
  provinceName: string;
}

/**
 * Clinic Item DTO
 *
 * Single clinic item in list response
 */
export class ClinicItemDto {
  @ApiProperty({
    description: 'Clinic account ID',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  id: string;

  @ApiProperty({
    description: 'Clinic username',
    example: 'citymedicalclinic',
  })
  username: string;

  @ApiProperty({
    description: 'Clinic email',
    example: 'contact@citymedicalclinic.com',
  })
  email: string;

  @ApiProperty({
    description: 'Clinic phone number',
    example: '+84987654321',
    required: false,
    nullable: true,
  })
  phone?: string;

  @ApiProperty({
    description: 'Profile picture URL',
    example: 'https://example.com/clinic-avatar.jpg',
    required: false,
    nullable: true,
  })
  profilePicture?: string;

  @ApiProperty({
    description: 'Account role',
    enum: AccountRole,
    example: AccountRole.CLINIC_MANAGER,
  })
  role: AccountRole;

  @ApiProperty({
    description: 'Account status',
    enum: AccountStatus,
    example: AccountStatus.ACTIVE,
  })
  status: AccountStatus;

  @ApiProperty({
    description: 'Subscription status',
    example: 'ACTIVE',
    required: false,
    nullable: true,
  })
  subscriptionStatus?: string;

  @ApiProperty({
    description: 'Clinic information',
    type: ClinicInfoDto,
  })
  clinicInfo: ClinicInfoDto;

  @ApiProperty({
    description: 'Clinic address',
    type: AddressDto,
  })
  address: AddressDto;

  @ApiProperty({
    description: 'Clinic admin name from clinic_admin_information',
    example: 'City Medical Group',
    required: false,
    nullable: true,
  })
  clinicAdminInfor?: ClinicAdminInformation;

  constructor(
    account: any,
    clinicInfo: any,
    address?: any,
    clinicAdminInfo?: any,
  ) {
    this.id = account._id;
    this.username = account.username;
    this.email = account.email;
    this.phone = account.phone;
    this.profilePicture = account.profilePicture;
    this.role = account.role;
    this.status = account.status;
    this.subscriptionStatus = account.subscription?.subscriptionStatus;

    this.clinicInfo = {
      id: clinicInfo._id,
      clinicBranchName: clinicInfo.clinicBranchName,
      fullName: clinicInfo.fullName,
      gender: clinicInfo.gender,
      profilePicture: clinicInfo.profilePicture,
      dob: clinicInfo.dob,
    };

    this.address = {
      id: address?._id,
      address: address?.address,
      ward: address?.ward,
      wardName: address?.wardName,
      district: address?.district,
      districtName: address?.districtName,
      province: address?.province,
      provinceName: address?.provinceName,
    };

    // Handle clinic admin information and compute final clinic name
    if (clinicAdminInfo) {
      this.clinicAdminInfor = clinicAdminInfo;

      // Compute final clinic name
      const adminName = (clinicAdminInfo.clinicName || '').trim();
      const branchName = (clinicInfo.clinicBranchName || '').trim();

      // For CLINIC_ADMIN, clinicInfo is adapted from clinicAdminInfo, so branchName === adminName.
      // Use adminName as finalClinicName.
      if (adminName) {
        this.clinicAdminInfor.clinicName = adminName;
      } else if (branchName) {
        this.clinicInfo.clinicBranchName = branchName;
      } else {
        this.clinicInfo.fullName = null;
      }
    } else {
      this.clinicAdminInfor = null;
      // If no admin info, fall back to branch name (typical for MANAGER accounts)
      this.clinicInfo.clinicBranchName =
        (clinicInfo.clinicBranchName || '').trim() || null;
    }
  }
}

/**
 * Pagination DTO
 *
 * Pagination metadata
 */
export class PaginationDto {
  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Number of items per page',
    example: 10,
  })
  limit: number;

  @ApiProperty({
    description: 'Total number of items',
    example: 50,
  })
  total: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 5,
  })
  totalPages: number;
}

/**
 * Clinic List Response DTO
 *
 * Response wrapper for clinic list with pagination
 */
export class ClinicListResponseDto {
  @ApiProperty({
    description: 'Array of clinics',
    type: [ClinicItemDto],
  })
  clinics: ClinicItemDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: PaginationDto,
  })
  pagination: PaginationDto;
}
