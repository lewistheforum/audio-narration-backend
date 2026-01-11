import { ApiProperty } from '@nestjs/swagger';
import { AccountRole, AccountStatus } from '../enums';
import { Gender } from '../enums/gender.enum';

/**
 * Doctor Info DTO
 *
 * Detailed doctor information from doctor_information table
 */
export class DoctorInfo {
  @ApiProperty({
    description: 'Doctor information ID',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  id: string;

  @ApiProperty({
    description: 'Doctor full name',
    example: 'Dr. John Smith',
  })
  fullName: string;

  @ApiProperty({
    description: 'Doctor gender',
    enum: Gender,
    example: Gender.MALE,
    required: false,
    nullable: true,
  })
  gender?: Gender;

  @ApiProperty({
    description: 'Doctor academic degree',
    example: 'MD, PhD',
    required: false,
    nullable: true,
  })
  academicDegree?: string;

  @ApiProperty({
    description: 'Doctor work process / experience',
    example: '10 years of experience in cardiology',
    required: false,
    nullable: true,
  })
  experience?: string;

  @ApiProperty({
    description: 'Doctor position',
    example: 'Senior Cardiologist',
    required: false,
    nullable: true,
  })
  position?: string;

  @ApiProperty({
    description: 'Doctor introduction',
    example: 'Specialized in treating heart diseases with modern techniques',
    required: false,
    nullable: true,
  })
  introduction1?: string;

  @ApiProperty({
    description: 'Doctor work process details',
    example: { hospitals: ['City Hospital', 'General Hospital'] },
    required: false,
    nullable: true,
  })
  workProcess2?: Record<string, any>;

  @ApiProperty({
    description: 'Doctor study process details',
    example: { degrees: ['MD', 'PhD'], schools: ['Medical University'] },
    required: false,
    nullable: true,
  })
  studyProcess3?: Record<string, any>;

  @ApiProperty({
    description: 'Doctor membership details',
    example: { associations: ['Medical Association'] },
    required: false,
    nullable: true,
  })
  members4?: Record<string, any>;

  @ApiProperty({
    description: 'Doctor scientific work details',
    example: { publications: 10, research: 'Cardiology' },
    required: false,
    nullable: true,
  })
  scientificWork5?: Record<string, any>;

  @ApiProperty({
    description: 'Doctor papers details',
    example: { count: 5, journals: ['Medical Journal'] },
    required: false,
    nullable: true,
  })
  papers6?: Record<string, any>;

  @ApiProperty({
    description: 'Doctor introduction image URL',
    example: 'https://example.com/doctor-intro.jpg',
    required: false,
    nullable: true,
  })
  introductionImage?: string;

  @ApiProperty({
    description: 'Professional license number',
    example: 'PL-12345',
    required: false,
    nullable: true,
  })
  professionalLicense?: string;

  @ApiProperty({
    description: 'Certificate of practical training',
    example: 'CPT-67890',
    required: false,
    nullable: true,
  })
  certificatePracticalTraining?: string;

  @ApiProperty({
    description: 'Medical license number',
    example: 'ML-54321',
    required: false,
    nullable: true,
  })
  medicalLicense?: string;

  @ApiProperty({
    description: 'Identity card number',
    example: '001234567890',
    required: false,
    nullable: true,
  })
  identityNumber?: string;

  @ApiProperty({
    description: 'Place of issue for identity card',
    example: 'Hanoi',
    required: false,
    nullable: true,
  })
  placeIdentityCard?: string;

  @ApiProperty({
    description: 'Identity card issue date',
    example: '2020-01-15',
    required: false,
    nullable: true,
  })
  identityDate?: Date;

  @ApiProperty({
    description: 'Bank account number',
    example: '12345678901234567890',
    required: false,
    nullable: true,
  })
  bankNumber?: number;

  @ApiProperty({
    description: 'Bank name',
    example: 'Vietcombank',
    required: false,
    nullable: true,
  })
  bankName?: string;

  @ApiProperty({
    description: 'Bank branch',
    example: 'Hanoi Branch',
    required: false,
    nullable: true,
  })
  bankBranch?: string;

  constructor(doctorInfo: any) {
    this.id = doctorInfo._id;
    this.fullName = doctorInfo.fullName;
    this.gender = doctorInfo.gender;
    this.academicDegree = doctorInfo.academicDegree;
    this.experience = doctorInfo.experience;
    this.position = doctorInfo.position;
    this.introduction1 = doctorInfo.introduction1;
    this.workProcess2 = doctorInfo.workProcess2;
    this.studyProcess3 = doctorInfo.studyProcess3;
    this.members4 = doctorInfo.members4;
    this.scientificWork5 = doctorInfo.scientificWork5;
    this.papers6 = doctorInfo.papers6;
    this.introductionImage = doctorInfo.introductionImage;
    this.professionalLicense = doctorInfo.professionalLicense;
    this.certificatePracticalTraining = doctorInfo.certificatePracticalTraining;
    this.medicalLicense = doctorInfo.medicalLicense;
    this.identityNumber = doctorInfo.identityNumber;
    this.placeIdentityCard = doctorInfo.placeIdentityCard;
    this.identityDate = doctorInfo.identityDate;
    this.bankNumber = doctorInfo.bankNumber;
    this.bankName = doctorInfo.bankName;
    this.bankBranch = doctorInfo.bankBranch;
  }
}

/**
 * Clinic Info DTO
 *
 * Clinic information for doctor details
 */
export class ClinicInfo {
  @ApiProperty({
    description: 'Clinic account ID',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  id: string;

  @ApiProperty({
    description: 'Clinic name',
    example: 'City Medical Clinic',
  })
  clinicName: string;

  @ApiProperty({
    description: 'Clinic phone number',
    example: '+84987654321',
    required: false,
    nullable: true,
  })
  phone?: string;

  constructor(clinicInfo: any) {
    this.id = clinicInfo._id;
    this.clinicName = clinicInfo.clinicName;
    this.phone = clinicInfo.phone;
  }
}

/**
 * Doctor Detail Data DTO
 *
 * Main data object for doctor details response
 */
export class DoctorDetailData {
  @ApiProperty({
    description: 'Doctor account ID',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  id: string;

  @ApiProperty({
    description: 'Doctor username',
    example: 'drjohnsmith',
  })
  username: string;

  @ApiProperty({
    description: 'Doctor email',
    example: 'doctor@clinic.com',
  })
  email: string;

  @ApiProperty({
    description: 'Doctor phone number',
    example: '+84987654321',
    required: false,
    nullable: true,
  })
  phone?: string;

  @ApiProperty({
    description: 'Doctor date of birth',
    example: '1985-06-15T00:00:00.000Z',
    required: false,
    nullable: true,
  })
  dob?: Date;

  @ApiProperty({
    description: 'Profile picture URL from accounts table',
    example: 'https://example.com/doctor-avatar.jpg',
    required: false,
    nullable: true,
  })
  profilePicture?: string;

  @ApiProperty({
    description: 'Account role',
    enum: AccountRole,
    example: AccountRole.DOCTOR,
  })
  role: AccountRole;

  @ApiProperty({
    description: 'Account status',
    enum: AccountStatus,
    example: AccountStatus.ACTIVE,
  })
  status: AccountStatus;

  @ApiProperty({
    description: 'Parent account ID (clinic ID)',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  parentId: string;

  @ApiProperty({
    description: 'Account creation timestamp',
    example: '2023-10-27T10:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Doctor detailed information',
    type: DoctorInfo,
  })
  doctorInfo: DoctorInfo;

  @ApiProperty({
    description: 'Clinic information (parent clinic)',
    type: ClinicInfo,
    required: false,
    nullable: true,
  })
  clinic?: ClinicInfo;

  constructor(
    account: any,
    doctorInfo: any,
    clinicInfo?: any,
  ) {
    this.id = account._id;
    this.username = account.username;
    this.email = account.email;
    this.phone = account.phone;
    this.dob = account.dob;
    this.profilePicture = account.profilePicture;
    this.role = account.role;
    this.status = account.status;
    this.parentId = account.parentId;
    this.createdAt = account.createdAt;

    this.doctorInfo = new DoctorInfo(doctorInfo);

    if (clinicInfo) {
      this.clinic = new ClinicInfo(clinicInfo);
    }
  }
}

/**
 * Doctor Detail Response DTO
 *
 * Response wrapper for doctor details
 */
export class DoctorDetailResponseDto {
  @ApiProperty({
    description: 'Response message',
    example: 'Doctor details retrieved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Doctor details data',
    type: DoctorDetailData,
  })
  data: DoctorDetailData;

  constructor(data: DoctorDetailData) {
    this.message = 'Doctor details retrieved successfully';
    this.data = data;
  }
}
