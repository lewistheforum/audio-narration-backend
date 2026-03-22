import { ApiProperty, ApiHideProperty } from '@nestjs/swagger';
import { IsUUID, IsNotEmpty, IsOptional, IsNumber, Min } from 'class-validator';

export class CreateSubscriptionTransactionDto {
    @ApiProperty({
        example: '550e8400-e29b-41d4-a716-446655440000',
        description: 'Subscription history ID (ClinicSubscriptionHistory ID)',
    })
    @IsNotEmpty()
    @IsUUID()
    subscriptionId: string;

    @ApiProperty({
        example: 6,
        description: 'Subscription duration in months',
        required: false,
    })
    @IsOptional()
    @IsNumber()
    @Min(1)
    duration?: number;

    @ApiHideProperty()
    @IsOptional()
    @IsUUID()
    serviceId?: string;
}
