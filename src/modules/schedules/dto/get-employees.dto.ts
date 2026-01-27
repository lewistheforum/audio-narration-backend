import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class GetEmployeesDto {
    @ApiProperty({
        description: 'Search by Name or Username',
        example: 'Nguyen Van A',
        required: false,
    })
    @IsOptional()
    @IsString()
    search?: string;
}
