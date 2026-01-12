import { ApiProperty } from '@nestjs/swagger';
import { AccountRole, AccountStatus } from '../enums';
import { Gender } from '../enums/gender.enum';

/**
 * Doctor Info DTO
 *
 * Doctor information from doctor_information table
 */
export class DoctorInfoDto {
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
    description: 'Doctor introduction image URL',
    example: 'https://example.com/doctor-intro.jpg',
    required: false,
    nullable: true,
  })
  introductionImage?: string;

  @ApiProperty({
    description: 'Doctor profile picture URL (preferred for list UI)',
    example: 'https://example.com/doctor-avatar.jpg',
    required: false,
    nullable: true,
  })
  profilePicture?: string;
}

/**
 * Clinic Info Summary DTO
 *
 * Brief clinic information for doctor listing
 */
export class ClinicInfoSummaryDto {
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
    description: 'Clinic profile picture URL',
    example: 'https://example.com/clinic-avatar.jpg',
    required: false,
    nullable: true,
  })
  profilePicture?: string;
}

/**
 * Doctor Item DTO
 *
 * Single doctor item in list response
 */
export class DoctorItemDto {
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
    description: 'Doctor information',
    type: DoctorInfoDto,
  })
  doctorInfo: DoctorInfoDto;

  @ApiProperty({
    description: 'Clinic information (parent clinic)',
    type: ClinicInfoSummaryDto,
    required: false,
    nullable: true,
  })
  clinic?: ClinicInfoSummaryDto;

  constructor(
    account: any,
    doctorInfo: any,
    clinicInfo?: any,
  ) {
    this.id = account._id;
    this.username = account.username;
    this.email = account.email;
    this.phone = account.phone;
    this.profilePicture = account.profilePicture;
    this.role = account.role;
    this.status = account.status;

    this.doctorInfo = {
      fullName: doctorInfo.fullName,
      gender: doctorInfo.gender,
      academicDegree: doctorInfo.academicDegree,
      experience: doctorInfo.experience,
      position: doctorInfo.position,
      introduction1: doctorInfo.introduction1,
      introductionImage: doctorInfo.introductionImage,
      profilePicture: doctorInfo.profilePicture,
    };

    if (clinicInfo) {
      this.clinic = {
        id: clinicInfo._id,
        clinicName: clinicInfo.clinicName,
        profilePicture: clinicInfo.profilePicture,
      };
    }
  }
}

/**
 * Doctor Pagination DTO
 *
 * Pagination metadata for doctors list
 */
export class DoctorPaginationDto {
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
 * Doctor List Response DTO
 *
 * Response wrapper for doctor list with pagination
 */
export class DoctorListResponseDto {
  @ApiProperty({
    description: 'Array of doctors',
    type: [DoctorItemDto],
  })
  doctors: DoctorItemDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: DoctorPaginationDto,
  })
  pagination: DoctorPaginationDto;
}
