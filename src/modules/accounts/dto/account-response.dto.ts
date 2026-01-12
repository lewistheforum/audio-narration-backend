import { ApiProperty } from '@nestjs/swagger';
import { Account } from '../entities/accounts.entity';
import { GeneralAccount } from '../entities/general_accounts.entity';
import { Gender, AccountRole, AccountStatus, ClinicRole } from '../enums';
import {
  ClinicInformation,
  ClinicStaffInformation,
  DoctorInformation,
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
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2023-10-27T10:00:00.000Z',
  })
  updatedAt: Date;

  @ApiProperty({
    description: 'Soft delete timestamp (null if not deleted)',
    example: '2023-10-27T10:00:00.000Z',
    required: false,
    nullable: true,
  })
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
  professionalLicense?: string;

  @ApiProperty({
    description: 'Certificate of practical training URL',
    required: false,
    nullable: true,
  })
  certificatePracticalTraining?: string;

  @ApiProperty({
    description: 'Medical license document URL',
    required: false,
    nullable: true,
  })
  medicalLicense?: string;

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

  constructor(
    account: Partial<Account>,
    generalAccount?: Partial<GeneralAccount>,
    staffAccount?: Partial<ClinicStaffInformation>,
    doctorAccount?: Partial<DoctorInformation>,
    clinicManagerAccount?: Partial<ClinicInformation>,
  ) {
    this.id = account._id;
    this.email = account.email;
    this.username = account.username;
    this.phone = account.phone;
    this.role = account.role;
    this.status = account.status ?? AccountStatus.PENDING;
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
    }

    // ClinicInformation data
    if (clinicManagerAccount) {
      this.clinicName = clinicManagerAccount.clinicName;
      this.dob = clinicManagerAccount.dob;
      this.profilePicture = clinicManagerAccount.profilePicture;
      this.description = clinicManagerAccount.description;
      this.specializedIn = clinicManagerAccount.specializedIn;
      this.pros = clinicManagerAccount.pros;
      this.paraclinical = clinicManagerAccount.paraclinical;
    }
  }
}
