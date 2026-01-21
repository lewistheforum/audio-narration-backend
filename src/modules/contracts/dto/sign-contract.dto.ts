import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID, IsOptional } from 'class-validator';

export class SignContractDto {
    // @ApiProperty({ description: 'User ID from Token', required: false })
    @IsOptional()
    userId?: string;
}
