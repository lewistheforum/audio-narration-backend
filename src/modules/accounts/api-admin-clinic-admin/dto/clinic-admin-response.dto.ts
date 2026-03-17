import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Account } from '../../entities/accounts.entity';
import { AccountStatus } from '../../enums';
import { RegistrationStatus } from '../../../subscriptions/enums';
import { formatToVietnamTime } from '../../../../common/utils/date.util';

export class ClinicAdminAddressDto {
  @ApiProperty()
  _id: string;

  @ApiProperty()
  address: string;

  @ApiProperty()
  ward: string;

  @ApiProperty()
  district: string;

  @ApiProperty()
  province: string;

  @ApiProperty()
  wardName: string;

  @ApiProperty()
  districtName: string;

  @ApiProperty()
  provinceName: string;
}

/**
 * ClinicAdminResponseDto
 *
 * Response DTO for clinic admin list items
 */
export class ClinicAdminResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  username: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ required: false })
  phone?: string;

  @ApiProperty({ required: false })
  clinicName?: string;

  @ApiProperty({ required: false })
  clinicPhone?: string;

  @ApiProperty({ required: false })
  profilePicture?: string;

  @ApiProperty({ required: false })
  isVerify?: boolean;

  @ApiProperty({ required: false })
  banCounts?: number;

  @ApiProperty({ required: false })
  banDescription?: string;

  @ApiProperty({ enum: AccountStatus })
  status: AccountStatus;

  @ApiProperty()
  @Transform(({ value }) => formatToVietnamTime(value))
  createdAt: Date;

  constructor(account: Account) {
    this.id = account._id;
    this.username = account.username;
    this.email = account.email;
    this.phone = account.phone;
    this.status = account.status;
    this.createdAt = account.createdAt;
    this.banCounts = account.banCounts;
    this.banDescription = account.banDescription;

    if (account.clinicAdminInformation) {
      this.clinicName = account.clinicAdminInformation.clinicName;
      this.clinicPhone = account.clinicAdminInformation.clinicPhone;
      this.profilePicture = account.clinicAdminInformation.profilePicture;
      this.isVerify = account.clinicAdminInformation.isVerify;
    }
  }
}

/**
 * ClinicAdminDetailResponseDto
 *
 * Response DTO for clinic admin detail view including
 * linked account statistics and current subscription info
 */
export class ClinicAdminDetailResponseDto extends ClinicAdminResponseDto {
  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty({ required: false })
  specializedIn?: string[];

  @ApiProperty({ required: false })
  pros?: string[];

  @ApiProperty({ required: false })
  paraclinical?: string[];

  @ApiProperty({ required: false })
  @Transform(({ value }) => value ? formatToVietnamTime(value) : value)
  dob?: Date;

  @ApiProperty({ required: false })
  bankName?: string;

  @ApiProperty({ required: false })
  sepayVa?: string;

  @ApiProperty({ description: 'Number of clinic manager accounts linked' })
  clinicManagerCount: number;

  @ApiProperty({ description: 'Number of doctor accounts linked' })
  doctorCount: number;

  @ApiProperty({ description: 'Number of staff accounts linked' })
  staffCount: number;

  @ApiProperty({
    required: false,
    description: 'Current subscription service name',
  })
  subscriptionServiceName?: string;

  @ApiProperty({
    required: false,
    description: 'Current subscription start date',
  })
  @Transform(({ value }) => value ? formatToVietnamTime(value) : value)
  subscriptionDate?: Date;

  @ApiProperty({
    required: false,
    description: 'Current subscription expiration date',
  })
  @Transform(({ value }) => value ? formatToVietnamTime(value) : value)
  expirationDate?: Date;

  @ApiProperty({
    required: false,
    enum: RegistrationStatus,
    description: 'Current subscription status',
  })
  subscriptionStatus?: RegistrationStatus;

  @ApiProperty({ type: ClinicAdminAddressDto, required: false })
  address?: ClinicAdminAddressDto;
}
