import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Account } from '../../entities/accounts.entity';
import { AccountStatus, Gender } from '../../enums';
import { formatToVietnamTime } from '../../../../common/utils/date.util';

export class GoogleIframeDto {
  @ApiProperty()
  _id: string;

  @ApiProperty({ required: false })
  location?: string;

  @ApiProperty({ required: false })
  googleMapIframe?: string;
}

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

  @ApiProperty({ type: GoogleIframeDto, required: false })
  googleIframe?: GoogleIframeDto;
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

  @ApiProperty({ type: PatientAddressDto, required: false })
  address?: PatientAddressDto;

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

    if (account.address) {
      this.address = {
        _id: account.address._id,
        address: account.address.address,
        ward: account.address.ward,
        district: account.address.district,
        province: account.address.province,
        wardName: account.address.wardName,
        districtName: account.address.districtName,
        provinceName: account.address.provinceName,
      };

      if (account.address.googleIframe) {
        this.address.googleIframe = {
          _id: account.address.googleIframe._id,
          location: account.address.googleIframe.location,
          googleMapIframe: account.address.googleIframe.googleMapIframe,
        };
      }
    }
  }
}
