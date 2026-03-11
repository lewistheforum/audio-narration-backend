import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { AccountRole, AccountStatus } from '../enums';
import { PublicDoctorInfo } from './public-doctor-info.dto';
import { PublicClinicInfo } from './public-clinic-info.dto';
import { formatToVietnamTime } from '../../../common/utils/date.util';

/**
 * Public Doctor Detail Data DTO
 *
 * Main data object for public doctor details response.
 * Excludes sensitive encrypted fields (identity, bank info).
 */
export class PublicDoctorDetailData {
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
  @Transform(({ value }) => value ? formatToVietnamTime(value) : value)
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
  @Transform(({ value }) => formatToVietnamTime(value))
  createdAt: Date;

  @ApiProperty({
    description: 'Doctor detailed information (public view)',
    type: PublicDoctorInfo,
  })
  doctorInfo: PublicDoctorInfo;

  @ApiProperty({
    description: 'Clinic information (parent clinic)',
    type: PublicClinicInfo,
    required: false,
    nullable: true,
  })
  clinic?: PublicClinicInfo;

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

    this.doctorInfo = new PublicDoctorInfo(doctorInfo);

    if (clinicInfo) {
      this.clinic = new PublicClinicInfo(clinicInfo);
    }
  }
}
