import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID, IsOptional, IsInt, Min, Max } from 'class-validator';

export class CreateNewSubscriptionDto {
    @ApiProperty({
        example: '550e8400-e29b-41d4-a716-446655440000',
        description: 'New subscription service ID',
    })
    @IsNotEmpty()
    @IsUUID()
    serviceId: string;

    @ApiProperty({
        example: 1,
        description: 'Package duration in months. Default 1 = 1 month, 12 = 1 year',
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
        description: 'Target service ID to switch to',
    })
    @IsNotEmpty()
    @IsUUID()
    targetServiceId: string;

    @ApiProperty({
        example: 1,
        description: 'New package duration in months. Default 1 = 1 month, 12 = 1 year',
        default: 1,
        required: false,
    })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(12)
    duration?: number = 1;
}

