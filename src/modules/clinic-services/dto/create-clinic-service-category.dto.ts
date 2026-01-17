import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { ServiceCategoryType } from '../enums';

export class CreateClinicServiceCategoryDto {
    @ApiProperty({
        description: 'Category Name',
        example: 'General Checkup',
    })
    @IsNotEmpty({ message: 'Category Name is required' })
    @IsString({ message: 'Category Name must be a string' })
    categoryName: string;

    @ApiProperty({
        description: 'Category Type',
        enum: ServiceCategoryType,
        example: ServiceCategoryType.CONSULTATION,
    })
    @IsNotEmpty({ message: 'Type is required' })
    @IsEnum(ServiceCategoryType, { message: 'Invalid Category Type' })
    type: ServiceCategoryType;
}
