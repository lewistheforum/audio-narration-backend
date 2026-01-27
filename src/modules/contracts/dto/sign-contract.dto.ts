import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID, Length } from 'class-validator';

export class SignContractDto {
    @ApiProperty({
        description: 'UUID of the user signing the contract (Clinic Manager or Employee)',
        example: '123e4567-e89b-12d3-a456-426614174000'
    })
    @IsNotEmpty()
    @IsUUID()
    userId: string;

    @ApiProperty({
        description: '6-digit OTP code sent to email',
        example: '123456'
    })
    @IsNotEmpty()
    @IsString()
    @Length(6, 6)
    otp: string;
}
