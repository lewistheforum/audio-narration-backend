import { ApiProperty } from '@nestjs/swagger';
import {
    IsArray,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUUID,
    IsNumber,
    Min,
    Max,
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

    @ApiProperty({
        description: 'Price of the service',
        example: 150000,
    })
    @IsNotEmpty({ message: 'Price is required' })
    @IsNumber({}, { message: 'Price must be a number' })
    @Min(0, { message: 'Price must be greater than or equal to 0' })
    price: number;

    @ApiProperty({
        description: 'Discount percentage (0-100)',
        example: 10,
        required: false,
    })
    @IsOptional()
    @IsNumber({}, { message: 'Discount must be a number' })
    @Min(0, { message: 'Discount must be greater than or equal to 0' })
    @Max(100, { message: 'Discount cannot exceed 100' })
    discount?: number;

    @ApiProperty({
        description: 'Duration in minutes',
        example: 30,
        required: false,
    })
    @IsOptional()
    @IsNumber({}, { message: 'Duration must be a number' })
    @Min(1, { message: 'Duration must be at least 1 minute' })
    durationMin?: number;

    @ApiProperty({
        description: 'Note for patient',
        example: 'Please fast for 8 hours before the test',
        required: false,
    })
    @IsOptional()
    @IsString({ message: 'Note for patient must be a string' })
    noteForPatient?: string;
}
