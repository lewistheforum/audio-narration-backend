import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { AccountStatus, ClinicRole } from '../enums';
import { PaginationDto } from './clinic-list-response.dto';
import { Gender } from '../enums';
import { formatToVietnamTime } from '../../../common/utils/date.util';

export class StaffItemDto {
    @ApiProperty({
        description: 'Staff account ID',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    id: string;

    @ApiProperty({
        description: 'Staff username',
        example: 'staffuser',
    })
    username: string;

    @ApiProperty({
        description: 'Staff email',
        example: 'staff@clinic.com',
    })
    email: string;

    @ApiProperty({
        description: 'Staff full name',
        example: 'Nguyen Van A',
    })
    fullName: string;

    @ApiProperty({
        description: 'Staff gender',
        enum: Gender,
        example: Gender.MALE,
    })
    gender: Gender;

    @ApiProperty({
        description: 'Staff role in clinic',
        enum: ClinicRole,
        example: ClinicRole.STAFF,
    })
    clinicRole: ClinicRole;

    @ApiProperty({
        description: 'Account status',
        enum: AccountStatus,
        example: AccountStatus.ACTIVE,
    })
    status: AccountStatus;

    @ApiProperty({
        description: 'Profile picture URL',
        required: false,
        nullable: true,
    })
    profilePicture?: string;

    @ApiProperty({
        description: 'Date of birth',
        required: false,
        nullable: true,
    })
    @Transform(({ value }) => value ? formatToVietnamTime(value) : value)
    dob?: Date;

    @ApiProperty({
        description: 'Creation timestamp',
    })
    @Transform(({ value }) => formatToVietnamTime(value))
    createdAt: Date;

    constructor(account: any, staffInfo: any) {
        this.id = account._id;
        this.username = account.username;
        this.email = account.email;
        this.status = account.status;
        this.createdAt = account.createdAt;

        if (staffInfo) {
            this.fullName = staffInfo.fullName;
            this.gender = staffInfo.gender;
            this.clinicRole = staffInfo.clinicRole;
            this.profilePicture = staffInfo.profilePicture;
            this.dob = staffInfo.dob;
        }
    }
}

export class StaffListResponseDto {
    @ApiProperty({
        description: 'Array of staff members',
        type: [StaffItemDto],
    })
    staff: StaffItemDto[];

    @ApiProperty({
        description: 'Pagination metadata',
        type: PaginationDto,
    })
    pagination: PaginationDto;
}
