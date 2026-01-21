import { ApiProperty } from '@nestjs/swagger';
import { AccountRole, AccountStatus, Gender } from '../enums';
import { AddressDto } from './clinic-list-response.dto';

/**
 * Doctor Info DTO
 *
 * Doctor information from doctor_information table
 */
export class DoctorInfoDto {
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
    description: 'Profile picture URL',
    example: 'https://example.com/doctor-avatar.jpg',
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

  @ApiProperty({
    description: 'Academic Degree',
    example: 'MD, PhD',
    required: false,
    nullable: true,
  })
  academicDegree?: string;

  @ApiProperty({
    description: 'Experience',
    example: '10 years',
    required: false,
    nullable: true,
  })
  experience?: string;

  @ApiProperty({
    description: 'Position',
    example: 'Head of Department',
    required: false,
    nullable: true,
  })
  position?: string;

  @ApiProperty({
    description: 'Introduction',
    example: 'Experienced cardiologist...',
    required: false,
    nullable: true,
  })
  introduction1?: string;
}

/**
 * Doctor Item DTO
 *
 * Single doctor item in list response
 */
export class DoctorItemDto {
  @ApiProperty({
    description: 'Account ID',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  id: string;

  @ApiProperty({
    description: 'Username',
    example: 'drjohn',
  })
  username: string;

  @ApiProperty({
    description: 'Email',
    example: 'drjohn@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'Phone number',
    example: '+84987654321',
    required: false,
    nullable: true,
  })
  phone?: string;

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
    description: 'Address',
    type: AddressDto,
  })
  address: AddressDto;

  constructor(account: any, doctorInfo: any, address: any) {
    this.id = account._id;
    this.username = account.username;
    this.email = account.email;
    this.phone = account.phone;
    this.role = account.role;
    this.status = account.status;

    this.doctorInfo = {
      id: doctorInfo._id,
      fullName: doctorInfo.fullName,
      gender: doctorInfo.gender,
      profilePicture: doctorInfo.profilePicture,
      dob: doctorInfo.dob,
      academicDegree: doctorInfo.academicDegree,
      experience: doctorInfo.experience,
      position: doctorInfo.position,
      introduction1: doctorInfo.introduction1,
    };

    if (address) {
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
}

/**
 * Doctor Pagination DTO
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
