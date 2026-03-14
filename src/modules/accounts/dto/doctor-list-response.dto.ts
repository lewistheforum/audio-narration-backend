import { ApiProperty } from '@nestjs/swagger';
import { AccountRole, AccountStatus } from '../enums';
import { PublicDoctorInfo } from './public-doctor-info.dto';
import { ClinicInfoDto } from './clinic-list-response.dto';
import { PaginationDto } from './clinic-list-response.dto';

/**
 * Doctor Pagination DTO
 */
export class DoctorPaginationDto extends PaginationDto {}

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
    example: 'john.smith@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'Doctor phone number',
    example: '0987654321',
    required: false,
    nullable: true,
  })
  phone?: string;

  @ApiProperty({
    description: 'Profile picture URL',
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
    type: PublicDoctorInfo,
  })
  doctorInfo: PublicDoctorInfo;

  @ApiProperty({
    description: 'Parent clinic information (if applicable)',
    type: ClinicInfoDto,
    required: false,
    nullable: true,
  })
  clinicInfo?: ClinicInfoDto;

  constructor(account: any, doctorInfo: any, clinicInfo?: any) {
    this.id = account._id;
    this.username = account.username;
    this.email = account.email;
    this.phone = account.phone;
    this.profilePicture = account.profilePicture;
    this.role = account.role;
    this.status = account.status;

    // Map doctor info
    this.doctorInfo = new PublicDoctorInfo(doctorInfo);

    // Map clinic info if exists
    if (clinicInfo && clinicInfo.length > 0) {
      // Handle case if clinicInfo is passed as direct object or array
      // Based on logic in service: clinicInfo = findByAccountId which might return object or array?
      // ClinicManagerInfoRepository.findByAccountId likely returns a single object logic-wise but strict typing matters.
      // Let's assume object for now, adapting if needed.
      // In service: clinicInfo = await this.clinicManagerInfoRepository.findByAccountId(doctor.parentId);
      // Checking clinic-list-response: ClinicInfoDto construction

      const info = Array.isArray(clinicInfo) ? clinicInfo[0] : clinicInfo;

      if (info) {
        this.clinicInfo = {
          id: info._id,
          clinicBranchName: info.clinicBranchName,
          fullName: info.fullName,
          gender: info.gender,
          profilePicture: info.profilePicture,
          dob: info.dob,
        };
      }
    } else if (clinicInfo && !Array.isArray(clinicInfo)) {
      this.clinicInfo = {
        id: clinicInfo._id,
        clinicBranchName: clinicInfo.clinicBranchName,
        fullName: clinicInfo.fullName,
        gender: clinicInfo.gender,
        profilePicture: clinicInfo.profilePicture,
        dob: clinicInfo.dob,
      };
    }
  }
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
