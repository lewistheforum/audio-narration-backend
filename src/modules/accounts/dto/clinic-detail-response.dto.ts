import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { AccountRole, AccountStatus } from '../enums';
import { formatToVietnamTime } from '../../../common/utils/date.util';
import { FeedbackDto } from './feedback.dto';

/**
 * Clinic Manager Account DTO
 *
 * Account fields for clinic manager
 */
export class ClinicManagerAccountDto {
  @ApiProperty({
    description: 'Clinic manager account ID',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  id: string;

  @ApiProperty({
    description: 'Clinic manager username',
    example: 'clinicmanager',
  })
  username: string;

  @ApiProperty({
    description: 'Clinic manager email',
    example: 'manager@clinic.com',
  })
  email: string;

  @ApiProperty({
    description: 'Clinic manager phone number',
    example: '0987654321',
    required: false,
    nullable: true,
  })
  phone?: string;

  @ApiProperty({
    description: 'Clinic manager date of birth',
    example: '1980-05-15',
    required: false,
    nullable: true,
  })
  @Transform(({ value }) => value ? formatToVietnamTime(value) : value)
  dob?: Date;

  @ApiProperty({
    description: 'Profile picture URL',
    example: 'https://example.com/manager-avatar.jpg',
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

  constructor(account: any) {
    this.id = account._id;
    this.username = account.username;
    this.email = account.email;
    this.phone = account.phone;
    this.dob = account.dob;
    this.profilePicture = account.profilePicture;
    this.role = account.role;
    this.status = account.status;
    this.isEmailVerified = account.isEmailVerified;
    this.createdAt = account.createdAt;
    this.updatedAt = account.updatedAt;
  }
}

/**
 * Clinic Admin Account DTO
 *
 * Account fields for clinic admin
 */
export class ClinicAdminAccountDto {
  @ApiProperty({
    description: 'Clinic admin account ID',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  id: string;

  @ApiProperty({
    description: 'Clinic admin username',
    example: 'clinicadmin',
  })
  username: string;

  @ApiProperty({
    description: 'Clinic admin email',
    example: 'admin@clinic.com',
  })
  email: string;

  @ApiProperty({
    description: 'Clinic admin phone number',
    example: '0987654321',
    required: false,
    nullable: true,
  })
  phone?: string;

  @ApiProperty({
    description: 'Clinic admin date of birth',
    example: '1980-05-15',
    required: false,
    nullable: true,
  })
  @Transform(({ value }) => value ? formatToVietnamTime(value) : value)
  dob?: Date;

  @ApiProperty({
    description: 'Profile picture URL',
    example: 'https://example.com/admin-avatar.jpg',
    required: false,
    nullable: true,
  })
  profilePicture?: string;

  @ApiProperty({
    description: 'Account role',
    enum: AccountRole,
    example: AccountRole.CLINIC_ADMIN,
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
  @Transform(({ value }) => formatToVietnamTime(value))
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2023-10-27T10:00:00.000Z',
  })
  @Transform(({ value }) => formatToVietnamTime(value))
  updatedAt: Date;

  constructor(account: any) {
    this.id = account._id;
    this.username = account.username;
    this.email = account.email;
    this.phone = account.phone;
    this.dob = account.dob;
    this.profilePicture = account.profilePicture;
    this.role = account.role;
    this.status = account.status;
    this.isEmailVerified = account.isEmailVerified;
    this.createdAt = account.createdAt;
    this.updatedAt = account.updatedAt;
  }
}

/**
 * Clinic Admin Info Detail DTO
 *
 * Clinic admin information from clinic_admin_information table
 */
export class ClinicAdminInfoDetailDto {
  @ApiProperty({
    description: 'Clinic admin information ID',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  id: string;

  @ApiProperty({
    description: 'Clinic name',
    example: 'City Medical Group',
  })
  clinicName: string;

  @ApiProperty({
    description: 'Clinic phone',
    example: '0987654321',
    required: false,
    nullable: true,
  })
  clinicPhone?: string;

  @ApiProperty({
    description: 'Clinic description',
    example: 'A modern healthcare facility',
    required: false,
    nullable: true,
  })
  description?: string;

  @ApiProperty({
    description: 'Medical specializations offered',
    example: ['Cardiology', 'Dermatology'],
    required: false,
    nullable: true,
  })
  specializedIn?: string[];

  @ApiProperty({
    description: 'Advantages or strengths of clinic',
    example: ['24/7 service', 'Modern equipment'],
    required: false,
    nullable: true,
  })
  pros?: string[];

  @ApiProperty({
    description: 'Paraclinical services offered',
    example: ['X-ray', 'Ultrasound'],
    required: false,
    nullable: true,
  })
  paraclinical?: string[];

  @ApiProperty({
    description: 'Date of birth of clinic administrator',
    example: '1980-05-15',
    required: false,
    nullable: true,
  })
  @Transform(({ value }) => value ? formatToVietnamTime(value) : value)
  dob?: Date;

  @ApiProperty({
    description: 'Profile picture URL',
    example: 'https://example.com/admin-avatar.jpg',
    required: false,
    nullable: true,
  })
  profilePicture?: string;

  @ApiProperty({
    description: 'Whether clinic administrator is verified',
    example: true,
    required: false,
    nullable: true,
  })
  isVerify?: boolean;

  constructor(clinicAdminInfo: any) {
    this.id = clinicAdminInfo._id;
    this.clinicName = clinicAdminInfo.clinicName;
    this.clinicPhone = clinicAdminInfo.clinicPhone;
    this.description = clinicAdminInfo.description;
    this.specializedIn = clinicAdminInfo.specializedIn;
    this.pros = clinicAdminInfo.pros;
    this.paraclinical = clinicAdminInfo.paraclinical;
    this.dob = clinicAdminInfo.dob;
    this.profilePicture = clinicAdminInfo.profilePicture;
    this.isVerify = clinicAdminInfo.isVerify;
  }
}

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
  @Transform(({ value }) => value ? formatToVietnamTime(value) : value)
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

  @ApiProperty({
    description: 'Average rating from feedbacks (0-5)',
    example: 4.5,
    required: false,
    nullable: true,
  })
  averageRating?: number;

  constructor(account: any, doctorInfo: any, averageRating?: number) {
    this.id = account._id;
    this.username = account.username;
    this.profilePicture = account.profilePicture;
    this.fullName = doctorInfo?.fullName || '';
    this.academicDegree = doctorInfo?.academicDegree;
    this.position = doctorInfo?.position;
    this.averageRating = averageRating !== undefined ? Number(averageRating) || 0 : undefined;
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
  @Transform(({ value }) => formatToVietnamTime(value))
  subscriptionDate: Date;

  @ApiProperty({
    description: 'Expiration date',
    example: '2024-10-27T10:00:00.000Z',
  })
  @Transform(({ value }) => formatToVietnamTime(value))
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
    example: '0987654321',
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
  @Transform(({ value }) => value ? formatToVietnamTime(value) : value)
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
  @Transform(({ value }) => formatToVietnamTime(value))
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2023-10-27T10:00:00.000Z',
  })
  @Transform(({ value }) => formatToVietnamTime(value))
  updatedAt: Date;

  @ApiProperty({
    description: 'Clinic manager account information',
    type: ClinicManagerAccountDto,
  })
  clinicManager: ClinicManagerAccountDto;

  @ApiProperty({
    description: 'Clinic manager information',
    type: ClinicInfoDetailDto,
  })
  clinicManagerInformation: ClinicInfoDetailDto;

  @ApiProperty({
    description: 'Clinic admin account information',
    type: ClinicAdminAccountDto,
    required: false,
    nullable: true,
  })
  clinicAdmin?: ClinicAdminAccountDto;

  @ApiProperty({
    description: 'Clinic admin information',
    type: ClinicAdminInfoDetailDto,
    required: false,
    nullable: true,
  })
  clinicAdminInformation?: ClinicAdminInfoDetailDto;

  @ApiProperty({
    description:
      'Final clinic name combining clinic admin name and branch name',
    example: 'City Medical Group Branch 1',
    required: false,
    nullable: true,
  })
  finalClinicName?: string | null;

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

  @ApiProperty({
    description: 'Average rating from feedbacks (0-5)',
    example: 4.5,
    required: false,
    nullable: true,
  })
  averageRating?: number;

  @ApiProperty({
    description: 'Clinic feedbacks',
    type: [FeedbackDto],
    required: false,
    nullable: true,
  })
  feedbacks?: FeedbackDto[];

  constructor(
    account: any,
    clinicInfo: any,
    addresses: AddressDetailDto[],
    doctors: DoctorSummaryDto[],
    subscription?: SubscriptionDto,
    clinicAdmin?: any,
    clinicAdminInfo?: any,
    finalClinicName?: string | null,
    averageRating?: number,
    feedbacks?: FeedbackDto[],
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

    this.clinicManager = new ClinicManagerAccountDto(account);
    this.clinicManagerInformation = {
      id: clinicInfo._id,
      clinicBranchName: clinicInfo.clinicBranchName,
      fullName: clinicInfo.fullName,
      gender: clinicInfo.gender,
      profilePicture: clinicInfo.profilePicture,
      dob: clinicInfo.dob,
    };

    if (clinicAdmin) {
      this.clinicAdmin = new ClinicAdminAccountDto(clinicAdmin);
    }

    if (clinicAdminInfo) {
      this.clinicAdminInformation = new ClinicAdminInfoDetailDto(
        clinicAdminInfo,
      );
    }

    this.finalClinicName = finalClinicName;

    this.addresses = addresses;
    this.doctors = doctors;
    this.subscription = subscription;
    this.averageRating = averageRating !== undefined ? Number(averageRating) || 0 : undefined;
    this.feedbacks = feedbacks;
  }
}
