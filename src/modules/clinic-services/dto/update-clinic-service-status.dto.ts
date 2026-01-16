import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty } from 'class-validator';

export class UpdateClinicServiceStatusDto {
    @ApiProperty({
        description: 'Is Active Status',
        example: true,
    })
    @IsNotEmpty({ message: 'Is Active is required' })
    @IsBoolean({ message: 'Is Active must be a boolean' })
    isActive: boolean;
}
