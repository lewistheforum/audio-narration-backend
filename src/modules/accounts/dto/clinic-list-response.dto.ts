import { ApiProperty } from '@nestjs/swagger';
import { AccountRole, AccountStatus } from '../enums';

/**
 * Clinic Info DTO
 *
 * Clinic information from clinic_information table
 */
export class ClinicInfoDto {
  @ApiProperty({
    description: 'Clinic information ID',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  id: string;

  @ApiProperty({
    description: 'Clinic name',
    example: 'City Medical Clinic',
  })
  clinicName: string;

  @ApiProperty({
    description: 'Clinic description',
    example: 'A modern healthcare facility',
    required: false,
    nullable: true,
  })
  description?: string;

  @ApiProperty({
    description: 'Specializations (JSONB array)',
    example: ['Cardiology', 'Dermatology'],
    required: false,
    nullable: true,
  })
  specializedIn?: string[];

  @ApiProperty({
    description: 'Procedures (JSONB array)',
    example: ['ECG', 'X-Ray'],
    required: false,
    nullable: true,
  })
  pros?: string[];

  @ApiProperty({
    description: 'Paraclinical services (JSONB array)',
    example: ['Blood Test', 'MRI'],
    required: false,
    nullable: true,
  })
  paraclinical?: string[];
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
 * Single clinic item in the list response
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
    description: 'Clinic information',
    type: ClinicInfoDto,
  })
  clinicInfo: ClinicInfoDto;

  @ApiProperty({
    description: 'Clinic address',
    type: AddressDto,
  })
  address: AddressDto;

  constructor(
    account: any,
    clinicInfo: any,
    address: any,
  ) {
    this.id = account._id;
    this.username = account.username;
    this.email = account.email;
    this.phone = account.phone;
    this.profilePicture = account.profilePicture;
    this.role = account.role;
    this.status = account.status;

    this.clinicInfo = {
      id: clinicInfo._id,
      clinicName: clinicInfo.clinicName,
      description: clinicInfo.description,
      specializedIn: clinicInfo.specializedIn,
      pros: clinicInfo.pros,
      paraclinical: clinicInfo.paraclinical,
    };

    this.address = {
      id: address._id,
      address: address.address,
      ward: address.ward,
      wardName: address.wardName,
      district: address.district,
      districtName: address.districtName,
      province: address.province,
      provinceName: address.provinceName,
    };
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
