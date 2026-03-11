import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Account } from '../entities/accounts.entity';
import { GeneralAccount } from '../entities/general_accounts.entity';
import { Gender, AccountRole, AccountStatus, ClinicRole } from '../enums';
import { formatToVietnamTime } from '../../../common/utils/date.util';
import {
  Address,
  ClinicAdminInformation,
  ClinicManagerInformation,
  ClinicStaffInformation,
  DoctorInformation,
  GoogleIframe,
} from '../entities';

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
  @Transform(({ value }) => value ? formatToVietnamTime(value) : value)
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
  @Transform(({ value }) => formatToVietnamTime(value))
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2023-10-27T10:00:00.000Z',
  })
  @Transform(({ value }) => formatToVietnamTime(value))
  updatedAt: Date;

  @ApiProperty({
    description: 'Soft delete timestamp (null if not deleted)',
    example: '2023-10-27T10:00:00.000Z',
    required: false,
    nullable: true,
  })
  @Transform(({ value }) => value ? formatToVietnamTime(value) : value)
  deletedAt?: Date;

  // ClinicStaffInformation specific fields
  @ApiProperty({
    description: 'Clinic role for staff members',
    enum: ClinicRole,
    example: ClinicRole.STAFF,
    required: false,
    nullable: true,
  })
  clinicRole?: ClinicRole;

  // DoctorInformation specific fields
  @ApiProperty({
    description: 'Academic degree of the doctor',
    example: 'MD, PhD',
    required: false,
    nullable: true,
  })
  academicDegree?: string;

  @ApiProperty({
    description: 'Years of experience or experience description',
    example: '10 years in cardiology',
    required: false,
    nullable: true,
  })
  experience?: string;

  @ApiProperty({
    description: 'Current position or title',
    example: 'Chief Cardiologist',
    required: false,
    nullable: true,
  })
  position?: string;

  @ApiProperty({
    description: 'Introduction text about the doctor',
    required: false,
    nullable: true,
  })
  introduction1?: string;

  @ApiProperty({
    description: 'Work process information',
    required: false,
    nullable: true,
  })
  workProcess2?: Record<string, any>;

  @ApiProperty({
    description: 'Study process information',
    required: false,
    nullable: true,
  })
  studyProcess3?: Record<string, any>;

  @ApiProperty({
    description: 'Members information',
    required: false,
    nullable: true,
  })
  members4?: Record<string, any>;

  @ApiProperty({
    description: 'Scientific work information',
    required: false,
    nullable: true,
  })
  scientificWork5?: Record<string, any>;

  @ApiProperty({
    description: 'Papers information',
    required: false,
    nullable: true,
  })
  papers6?: Record<string, any>;

  @ApiProperty({
    description: 'Introduction image URL',
    required: false,
    nullable: true,
  })
  introductionImage?: string;

  @ApiProperty({
    description: 'Professional license document URL',
    required: false,
    nullable: true,
  })
  professionalLicense?: Record<string, any>;

  @ApiProperty({
    description: 'Certificate of practical training URL',
    required: false,
    nullable: true,
  })
  certificatePracticalTraining?: Record<string, any>;

  @ApiProperty({
    description: 'Medical license document URL',
    required: false,
    nullable: true,
  })
  medicalLicense?: Record<string, any>;

  // ClinicInformation specific fields
  @ApiProperty({
    description: 'Name of the clinic',
    example: 'City Medical Center',
    required: false,
    nullable: true,
  })
  clinicName?: string;

  @ApiProperty({
    description: 'Description of the clinic',
    required: false,
    nullable: true,
  })
  description?: string;

  @ApiProperty({
    description: 'Areas of specialization',
    type: [String],
    example: ['Cardiology', 'Neurology'],
    required: false,
    nullable: true,
  })
  specializedIn?: string[];

  @ApiProperty({
    description: 'Clinic advantages or pros',
    type: [String],
    example: ['24/7 Emergency Care', 'Modern Equipment'],
    required: false,
    nullable: true,
  })
  pros?: string[];

  @ApiProperty({
    description: 'Paraclinical services available',
    type: [String],
    example: ['X-Ray', 'MRI', 'CT Scan'],
    required: false,
    nullable: true,
  })
  paraclinical?: string[];

  // Clinic Admin Banking fields
  @ApiProperty({
    description: 'Bank name for clinic admin',
    example: 'Vietcombank',
    required: false,
    nullable: true,
  })
  bankName?: string;

  @ApiProperty({
    description: 'Bank account number',
    example: 1234567890,
    required: false,
    nullable: true,
  })
  bankNumber?: string;

  @ApiProperty({
    description: 'Bank branch location',
    example: 'Ho Chi Minh City Branch',
    required: false,
    nullable: true,
  })
  bankBranch?: string;

  @ApiProperty({
    description: 'SePay virtual account number',
    example: 'SEPAY123456',
    required: false,
    nullable: true,
  })
  sepayVa?: string;

  // Clinic Manager fields
  @ApiProperty({
    description: 'Clinic branch name for managers',
    example: 'Downtown Branch',
    required: false,
    nullable: true,
  })
  clinicBranchName?: string;

  // Doctor Identity and Banking fields
  @ApiProperty({
    description: 'Identity card number',
    example: '123456789012',
    required: false,
    nullable: true,
  })
  identityNumber?: string;

  @ApiProperty({
    description: 'Place where identity card was issued',
    example: 'Ho Chi Minh City',
    required: false,
    nullable: true,
  })
  placeIdentityCard?: string;

  @ApiProperty({
    description: 'Date when identity card was issued',
    example: '2020-01-15',
    required: false,
    nullable: true,
  })
  identityDate?: Date;

  // Address fields
  @ApiProperty({
    description: 'Street address',
    example: '123 Nguyen Hue Street',
    required: false,
    nullable: true,
  })
  address?: string;

  @ApiProperty({
    description: 'Ward code',
    example: '00001',
    required: false,
    nullable: true,
  })
  ward?: string;

  @ApiProperty({
    description: 'District code',
    example: '001',
    required: false,
    nullable: true,
  })
  district?: string;

  @ApiProperty({
    description: 'Province code',
    example: '01',
    required: false,
    nullable: true,
  })
  province?: string;

  @ApiProperty({
    description: 'Province name',
    example: 'Ho Chi Minh City',
    required: false,
    nullable: true,
  })
  provinceName?: string;

  @ApiProperty({
    description: 'District name',
    example: 'District 1',
    required: false,
    nullable: true,
  })
  districtName?: string;

  @ApiProperty({
    description: 'Ward name',
    example: 'Ben Nghe Ward',
    required: false,
    nullable: true,
  })
  wardName?: string;

  // Google Iframe fields
  @ApiProperty({
    description: 'Address ID for Google iframe',
    required: false,
    nullable: true,
  })
  addressId?: string;

  @ApiProperty({
    description: 'Geographic location (point)',
    example: '(10.762622, 106.660172)',
    required: false,
    nullable: true,
  })
  location?: string;

  @ApiProperty({
    description: 'Map style configuration',
    required: false,
    nullable: true,
  })
  mapStyle?: string;

  @ApiProperty({
    description: 'Zoom level for the map',
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
    description: 'Whether the map is responsive',
    example: true,
    required: false,
  })
  responsive?: boolean;

  @ApiProperty({
    description: 'Google Map iframe embed code',
    required: false,
    nullable: true,
  })
  googleMapIframe?: string;

  constructor(
    account: Partial<Account>,
    generalAccount?: Partial<GeneralAccount>,
    staffAccount?: Partial<ClinicStaffInformation>,
    doctorAccount?: Partial<DoctorInformation>,
    clinicManagerAccount?: Partial<ClinicManagerInformation>,
    clinicAdminAccount?: Partial<ClinicAdminInformation>,
    addressData?: Partial<Address>,
    googleIframeData?: Partial<GoogleIframe>,
  ) {
    this.id = account._id;
    this.email = account.email;
    this.username = account.username;
    this.phone = account.phone;
    this.role = account.role;
    this.status = account.status ?? AccountStatus.ACTIVE;
    this.isEmailVerified = account.isEmailVerified ?? false;
    this.isOAuthUser = account.isOAuthUser ?? false;
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
      this.dob = generalAccount.dob;
      this.profilePicture = generalAccount.profilePicture;
    }

    // ClinicStaffInformation data
    if (staffAccount) {
      this.fullName = staffAccount.fullName;
      this.gender = staffAccount.gender;
      this.dob = staffAccount.dob;
      this.profilePicture = staffAccount.profilePicture;
      this.clinicRole = staffAccount.clinicRole;
    }

    // DoctorInformation data
    if (doctorAccount) {
      this.fullName = doctorAccount.fullName;
      this.gender = doctorAccount.gender;
      this.dob = doctorAccount.dob;
      this.profilePicture = doctorAccount.profilePicture;
      this.academicDegree = doctorAccount.academicDegree;
      this.experience = doctorAccount.experience;
      this.position = doctorAccount.position;
      this.introduction1 = doctorAccount.introduction1;
      this.workProcess2 = doctorAccount.workProcess2;
      this.studyProcess3 = doctorAccount.studyProcess3;
      this.members4 = doctorAccount.members4;
      this.scientificWork5 = doctorAccount.scientificWork5;
      this.papers6 = doctorAccount.papers6;
      this.introductionImage = doctorAccount.introductionImage;
      this.professionalLicense = doctorAccount.professionalLicense;
      this.certificatePracticalTraining =
        doctorAccount.certificatePracticalTraining;
      this.medicalLicense = doctorAccount.medicalLicense;
      this.identityNumber = doctorAccount.identityNumber;
      this.placeIdentityCard = doctorAccount.placeIdentityCard;
      this.identityDate = doctorAccount.identityDate;
      this.bankNumber = doctorAccount.bankNumber;
      this.bankName = doctorAccount.bankName;
      this.bankBranch = doctorAccount.bankBranch;
    }

    // ClinicManagerInformation data
    if (clinicManagerAccount) {
      this.clinicBranchName = clinicManagerAccount.clinicBranchName;
      this.fullName = clinicManagerAccount.fullName;
      this.gender = clinicManagerAccount.gender;
      this.dob = clinicManagerAccount.dob;
      this.profilePicture = clinicManagerAccount.profilePicture;
    }

    // ClinicAdminInformation data
    if (clinicAdminAccount) {
      this.clinicName = clinicAdminAccount.clinicName;
      this.description = clinicAdminAccount.description;
      this.specializedIn = clinicAdminAccount.specializedIn;
      this.pros = clinicAdminAccount.pros;
      this.paraclinical = clinicAdminAccount.paraclinical;
      this.dob = clinicAdminAccount.dob;
      this.profilePicture = clinicAdminAccount.profilePicture;
      this.bankName = clinicAdminAccount.bankName;
      this.bankNumber = clinicAdminAccount.bankNumber;
      this.bankBranch = clinicAdminAccount.bankBranch;
      this.sepayVa = clinicAdminAccount.sepayVa;
    }

    // Address data
    if (addressData) {
      this.address = addressData.address;
      this.ward = addressData.ward;
      this.district = addressData.district;
      this.province = addressData.province;
      this.provinceName = addressData.provinceName;
      this.districtName = addressData.districtName;
      this.wardName = addressData.wardName;
    }

    // Google Iframe data
    if (googleIframeData) {
      this.addressId = googleIframeData.addressId;
      this.location = googleIframeData.location;
      this.mapStyle = googleIframeData.mapStyle;
      this.zoomLevel = googleIframeData.zoomLevel;
      this.mapHeight = googleIframeData.mapHeight;
      this.mapWidth = googleIframeData.mapWidth;
      this.responsive = googleIframeData.responsive;
      this.googleMapIframe = googleIframeData.googleMapIframe;
    }
  }
}
