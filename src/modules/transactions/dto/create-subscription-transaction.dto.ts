import { ApiProperty, ApiHideProperty } from '@nestjs/swagger';
import { IsUUID, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateSubscriptionTransactionDto {
    @ApiProperty({
        example: '550e8400-e29b-41d4-a716-446655440000',
        description: 'ID của lịch sử đăng ký gói (ClinicSubscriptionHistory ID)',
    })
    @IsNotEmpty()
    @IsUUID()
    subscriptionId: string;

    @ApiHideProperty()
    @IsOptional()
    @IsUUID()
    serviceId?: string;
}
