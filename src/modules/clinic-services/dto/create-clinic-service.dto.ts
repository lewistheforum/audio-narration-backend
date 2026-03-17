import { ApiProperty } from '@nestjs/swagger';
import {
    IsArray,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUUID,
} from 'class-validator';

export class CreateClinicServiceDto {
    @ApiProperty({
        description: 'Category ID',
        example: 'uuid-category-id',
    })
    @IsNotEmpty({ message: 'Category ID is required' })
    @IsUUID('4', { message: 'Invalid Category ID format' })
    categoryId: string;

    @ApiProperty({
        description: 'Service Name',
        example: 'General Consultation',
    })
    @IsNotEmpty({ message: 'Service Name is required' })
    @IsString({ message: 'Service Name must be a string' })
    serviceName: string;

    @ApiProperty({
        description: 'Service Code',
        example: 'SV001',
    })
    @IsNotEmpty({ message: 'Service Code is required' })
    @IsString({ message: 'Service Code must be a string' })
    serviceCode: string;

    @ApiProperty({
        description: 'Description',
        example: 'Basic health checkup',
        required: false,
    })
    @IsOptional()
    @IsString({ message: 'Description must be a string' })
    description?: string;

    @ApiProperty({
        description: 'Service Functions',
        example: ['diagnosis', 'prescription'],
        required: false,
        type: [String],
    })
    @IsOptional()
    @IsArray({ message: 'Service Functions must be an array' })
    @IsString({ each: true, message: 'Each function must be a string' })
    serviceFunctions?: string[];
}
