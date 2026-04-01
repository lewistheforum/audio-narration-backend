import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { AccountRole, AccountStatus } from '../enums';
import { PublicDoctorInfo } from './public-doctor-info.dto';
import { PublicClinicInfo } from './public-clinic-info.dto';
import { formatToVietnamTime } from '../../../common/utils/date.util';
import { FeedbackDto } from './feedback.dto';

export class DoctorWorkingScheduleDto {
  @ApiProperty({
    description: 'Day of week',
    example: 'MONDAY',
  })
  dayOfWeek: string;

  @ApiProperty({
    description: 'Shift code',
    example: 'MORNING',
    required: false,
    nullable: true,
  })
  shift?: string;

  @ApiProperty({
    description: 'Start time',
    example: '07:00:00',
  })
  startTime: string;

  @ApiProperty({
    description: 'End time',
    example: '11:00:00',
  })
  endTime: string;

  constructor(schedule: {
    dayOfWeek: string;
    shift?: string | null;
    startTime: string;
    endTime: string;
  }) {
    this.dayOfWeek = schedule.dayOfWeek;
    this.shift = schedule.shift || undefined;
    this.startTime = schedule.startTime;
    this.endTime = schedule.endTime;
  }
}


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
    example: '0987654321',
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
    description: 'Profile picture URL from doctor_information table',
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

  @ApiProperty({
    description: 'Doctor working schedules',
    type: [DoctorWorkingScheduleDto],
  })
  workingSchedules: DoctorWorkingScheduleDto[];

  @ApiProperty({
    description: 'Average rating from feedbacks (0-5)',
    example: 4.5,
    required: false,
    nullable: true,
  })
  averageRating?: number;

  @ApiProperty({
    description: 'Doctor feedbacks',
    type: [FeedbackDto],
    required: false,
    nullable: true,
  })
  feedbacks?: FeedbackDto[];

  constructor(
    account: any,
    doctorInfo: any,
    clinicInfo?: any,
    workingSchedules: DoctorWorkingScheduleDto[] = [],
    averageRating?: number,
    feedbacks?: FeedbackDto[],
  ) {
    this.id = account._id;
    this.username = account.username;
    this.email = account.email;
    this.phone = account.phone;
    this.dob = account.dob;
    this.profilePicture = doctorInfo?.profilePicture || null;
    this.role = account.role;
    this.status = account.status;
    this.parentId = account.parentId;
    this.createdAt = account.createdAt;

    this.doctorInfo = new PublicDoctorInfo(doctorInfo);

    if (clinicInfo) {
      this.clinic = new PublicClinicInfo(clinicInfo);
    }

    this.workingSchedules = workingSchedules;
    this.averageRating = averageRating !== undefined ? Number(averageRating) || 0 : undefined;
    this.feedbacks = feedbacks;
  }
}
