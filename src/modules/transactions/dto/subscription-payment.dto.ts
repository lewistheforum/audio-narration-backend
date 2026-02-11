import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID, IsOptional, IsInt, Min, Max } from 'class-validator';

export class CreateNewSubscriptionDto {
    @ApiProperty({
        example: '550e8400-e29b-41d4-a716-446655440000',
        description: 'ID của dịch vụ đăng ký mới',
    })
    @IsNotEmpty()
    @IsUUID()
    serviceId: string;

    @ApiProperty({
        example: 1,
        description: 'Thời hạn gói (tháng). Mặc định 1 = 1 tháng, 12 = 1 năm',
        default: 1,
        required: false,
    })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(12)
    duration?: number = 1;
}

export class RenewSubscriptionDto {
    // Empty DTO - uses current subscription's duration/service
}

export class ChangePackageDto {
    @ApiProperty({
        example: '550e8400-e29b-41d4-a716-446655440000',
        description: 'ID của dịch vụ mục tiêu muốn chuyển đổi sang',
    })
    @IsNotEmpty()
    @IsUUID()
    targetServiceId: string;

    @ApiProperty({
        example: 1,
        description: 'Thời hạn gói mới (tháng). Mặc định 1 = 1 tháng, 12 = 1 năm',
        default: 1,
        required: false,
    })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(12)
    duration?: number = 1;
}

