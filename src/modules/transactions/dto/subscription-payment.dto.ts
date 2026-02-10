import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreateNewSubscriptionDto {
    @ApiProperty({
        example: '550e8400-e29b-41d4-a716-446655440000',
        description: 'ID của dịch vụ đăng ký mới',
    })
    @IsNotEmpty()
    @IsUUID()
    serviceId: string;
}

export class RenewSubscriptionDto {
    // Empty DTO - subscriptionId is inferred from token
}

export class ChangePackageDto {
    @ApiProperty({
        example: '550e8400-e29b-41d4-a716-446655440000',
        description: 'ID của dịch vụ mục tiêu muốn chuyển đổi sang',
    })
    @IsNotEmpty()
    @IsUUID()
    targetServiceId: string;
}
