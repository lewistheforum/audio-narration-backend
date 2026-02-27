import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, Min, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class GetDoctorListDto {
    @ApiProperty({
        description: 'Search by name, email, username',
        required: false,
    })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiProperty({
        description: 'Filter by academic degree',
        required: false,
    })
    @IsOptional()
    @IsString()
    academicDegree?: string;

    @ApiProperty({
        description: 'Filter by creation date (from)',
        required: false,
        example: '2023-01-01',
    })
    @IsOptional()
    @IsDateString()
    fromDate?: string;

    @ApiProperty({
        description: 'Filter by creation date (to)',
        required: false,
        example: '2023-12-31',
    })
    @IsOptional()
    @IsDateString()
    toDate?: string;

    @ApiProperty({
        description: 'Page number',
        required: false,
        default: 1,
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    page?: number = 1;

    @ApiProperty({
        description: 'Items per page',
        required: false,
        default: 10,
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    limit?: number = 10;
}
