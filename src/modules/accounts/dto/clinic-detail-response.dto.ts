import { ApiProperty } from '@nestjs/swagger';
import { AccountRole, AccountStatus } from '../enums';

/**
 * Clinic Info Detail DTO
 *
 * Clinic manager information from clinic_manager_information table
 */
export class ClinicInfoDetailDto {
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
 * Google Map DTO
 *
 * Google map iframe information from google_iframe table
 */
export class GoogleMapDto {
  @ApiProperty({
    description: 'Google map iframe ID',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  id: string;

  @ApiProperty({
    description: 'Location (PostGIS point type)',
    example: 'POINT(10.7769 106.7009)',
    required: false,
    nullable: true,
  })
  location?: string;

  @ApiProperty({
    description: 'Map style',
    example: 'roadmap',
    required: false,
    nullable: true,
  })
  mapStyle?: string;

  @ApiProperty({
    description: 'Zoom level',
    example: 15,
    required: false,
    nullable: true,
  })
  zoomLevel?: number;

  @ApiProperty({
    description: 'Map height in pixels',
    example: 400,
    required: false,
    nullable: true,
  })
  mapHeight?: number;

  @ApiProperty({
    description: 'Map width in pixels',
    example: 600,
    required: false,
    nullable: true,
  })
  mapWidth?: number;

  @ApiProperty({
    description: 'Responsive flag',
    example: true,
  })
  responsive: boolean;

  @ApiProperty({
    description: 'Full Google Maps iframe HTML embed code',
    example: '<iframe src="..."></iframe>',
    required: false,
    nullable: true,
  })
  googleMapIframe?: string;
}

/**
 * Address Detail DTO
 *
 * Address information with Google map from addresses and google_iframe tables
 */
export class AddressDetailDto {
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

  @ApiProperty({
    description: 'Google map information',
    type: GoogleMapDto,
    required: false,
    nullable: true,
  })
  googleMap?: GoogleMapDto;

  constructor(address: any, googleIframe: any) {
    this.id = address._id;
    this.address = address.address;
    this.ward = address.ward;
    this.wardName = address.wardName;
    this.district = address.district;
    this.districtName = address.districtName;
    this.province = address.province;
    this.provinceName = address.provinceName;

    if (googleIframe) {
      this.googleMap = {
        id: googleIframe._id,
        location: googleIframe.location,
        mapStyle: googleIframe.mapStyle,
        zoomLevel: googleIframe.zoomLevel,
        mapHeight: googleIframe.mapHeight,
        mapWidth: googleIframe.mapWidth,
        responsive: googleIframe.responsive,
        googleMapIframe: googleIframe.googleMapIframe,
      };
    }
  }
}

/**
 * Doctor Summary DTO
 *
 * Brief doctor information from accounts and doctor_information tables
 */
export class DoctorSummaryDto {
  @ApiProperty({
    description: 'Doctor account ID',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  id: string;

  @ApiProperty({
    description: 'Doctor username',
    example: 'drsmith',
  })
  username: string;

  @ApiProperty({
    description: 'Doctor profile picture URL',
    example: 'https://example.com/doctor-avatar.jpg',
    required: false,
    nullable: true,
  })
  profilePicture?: string;

  @ApiProperty({
    description: 'Doctor full name',
    example: 'Dr. John Smith',
  })
  fullName: string;

  @ApiProperty({
    description: 'Doctor academic degree',
    example: 'MD, PhD',
    required: false,
    nullable: true,
  })
  academicDegree?: string;

  @ApiProperty({
    description: 'Doctor position',
    example: 'Chief Cardiologist',
    required: false,
    nullable: true,
  })
  position?: string;

  constructor(account: any, doctorInfo: any) {
    this.id = account._id;
    this.username = account.username;
    this.profilePicture = account.profilePicture;
    this.fullName = doctorInfo?.fullName || '';
    this.academicDegree = doctorInfo?.academicDegree;
    this.position = doctorInfo?.position;
  }
}

/**
 * Subscription DTO
 *
 * Subscription information from clinic_subcriptions and subcription_services tables
 */
export class SubscriptionDto {
  @ApiProperty({
    description: 'Subscription ID',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  id: string;

  @ApiProperty({
    description: 'Service ID',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  serviceId: string;

  @ApiProperty({
    description: 'Service name',
    example: 'Premium Clinic Plan',
  })
  serviceName: string;

  @ApiProperty({
    description: 'Service type',
    example: 'PREMIUM',
  })
  serviceType: string;

  @ApiProperty({
    description: 'Subscription date',
    example: '2023-10-27T10:00:00.000Z',
  })
  subscriptionDate: Date;

  @ApiProperty({
    description: 'Expiration date',
    example: '2024-10-27T10:00:00.000Z',
  })
  expirationDate: Date;

  constructor(clinicSubscription: any, subscriptionService: any) {
    this.id = clinicSubscription._id;
    this.serviceId = clinicSubscription.serviceId;
    this.serviceName = subscriptionService.serviceName;
    this.serviceType = subscriptionService.code;
    this.subscriptionDate = clinicSubscription.subscriptionDate;
    this.expirationDate = clinicSubscription.expirationDate;
  }
}

/**
 * Clinic Detail Response DTO
 *
 * Full clinic details including addresses, doctors, and subscription
 */
export class ClinicDetailResponseDto {
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
    description: 'Clinic date of birth',
    example: '1980-05-15',
    required: false,
    nullable: true,
  })
  dob?: Date;

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
    description: 'Whether email has been verified',
    example: true,
  })
  isEmailVerified: boolean;

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
    description: 'Clinic information',
    type: ClinicInfoDetailDto,
  })
  clinicInfo: ClinicInfoDetailDto;

  @ApiProperty({
    description: 'Clinic addresses (branches)',
    type: [AddressDetailDto],
  })
  addresses: AddressDetailDto[];

  @ApiProperty({
    description: 'Clinic doctors',
    type: [DoctorSummaryDto],
  })
  doctors: DoctorSummaryDto[];

  @ApiProperty({
    description: 'Clinic subscription',
    type: SubscriptionDto,
    required: false,
    nullable: true,
  })
  subscription?: SubscriptionDto;

  constructor(
    account: any,
    clinicInfo: any,
    addresses: AddressDetailDto[],
    doctors: DoctorSummaryDto[],
    subscription?: SubscriptionDto,
  ) {
    this.id = account._id;
    this.username = account.username;
    this.email = account.email;
    this.phone = account.phone;
    this.dob = clinicInfo?.dob;
    this.profilePicture = account.profilePicture || clinicInfo?.profilePicture;
    this.role = account.role;
    this.status = account.status;
    this.isEmailVerified = account.isEmailVerified;
    this.createdAt = account.createdAt;
    this.updatedAt = account.updatedAt;

    this.clinicInfo = {
      id: clinicInfo._id,
      clinicBranchName: clinicInfo.clinicBranchName,
      fullName: clinicInfo.fullName,
      gender: clinicInfo.gender,
      profilePicture: clinicInfo.profilePicture,
      dob: clinicInfo.dob,
    };

    this.addresses = addresses;
    this.doctors = doctors;
    this.subscription = subscription;
  }
}
