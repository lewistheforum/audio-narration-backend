import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, IsOptional } from 'class-validator';

export class RejectContractDto {
    @ApiProperty({
        description: 'Reason for rejecting the contract',
        example: 'Thông tin lương chưa chính xác'
    })
    @IsNotEmpty()
    @IsString()
    @MaxLength(1000)
    reason: string;

    @ApiProperty({
        description: 'User ID (Optional, will be prioritized by Token if sent)',
        required: false
    })
    @IsOptional()
    @IsString()
    userId?: string;
}
