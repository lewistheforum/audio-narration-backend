import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Account } from '../../entities/accounts.entity';
import { AccountStatus, Gender } from '../../enums';
import { formatToVietnamTime } from '../../../../common/utils/date.util';

export class PatientAddressDto {
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

export class PatientResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  username: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ required: false })
  phone?: string;

  @ApiProperty({ required: false })
  fullName?: string;

  @ApiProperty({ enum: Gender, required: false })
  gender?: Gender;

  @ApiProperty({ required: false })
  @Transform(({ value }) => value ? formatToVietnamTime(value) : value)
  dob?: Date;

  @ApiProperty({ enum: AccountStatus, required: false })
  status?: AccountStatus;

  @ApiProperty({ required: false })
  profilePicture?: string;

  @ApiProperty({ required: false })
  banCounts?: number;

  @ApiProperty({ required: false })
  banDescription?: string;

  @ApiProperty({ type: [PatientAddressDto], required: false })
  addresses?: PatientAddressDto[];

  @ApiProperty()
  @Transform(({ value }) => formatToVietnamTime(value))
  createdAt: Date;

  constructor(account: Account) {
    this.id = account._id;
    this.username = account.username;
    this.email = account.email;
    this.phone = account.phone;
    this.banCounts = account.banCounts;
    this.status = account.status;
    this.banDescription = account.banDescription;
    this.createdAt = account.createdAt;

    if (account.generalAccount) {
      this.fullName = account.generalAccount.fullName;
      this.gender = account.generalAccount.gender;
      this.dob = account.generalAccount.dob;
      this.profilePicture = account.generalAccount.profilePicture;
    }

    if (account.addresses) {
      this.addresses = account.addresses.map((addr) => ({
        _id: addr._id,
        address: addr.address,
        ward: addr.ward,
        district: addr.district,
        province: addr.province,
        wardName: addr.wardName,
        districtName: addr.districtName,
        provinceName: addr.provinceName,
      }));
    }
  }
}
