import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';

/**
 * Ban Account DTO
 * 
 * Request body for banning an account
 */
export class BanAccountDto {
    @ApiProperty({
        description: 'Reason for banning the client',
        example: 'Violated terms of service by posting inappropriate content',
        minLength: 10,
        maxLength: 500,
    })
    @IsString()
    @IsNotEmpty({ message: 'Ban reason is required' })
    @MinLength(10, { message: 'Ban reason must be at least 10 characters' })
    @MaxLength(500, { message: 'Ban reason must not exceed 500 characters' })
    reason: string;
}
