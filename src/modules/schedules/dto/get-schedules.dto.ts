import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class GetSchedulesDto {
    @ApiProperty({
        description: 'Clinic ID',
        example: 'uuid-clinic-id',
    })
    @IsNotEmpty({ message: 'Clinic ID is required' })
    @IsUUID('4', { message: 'Invalid Clinic ID format' })
    clinicId: string;

    @ApiProperty({
        description: 'Filter by specific date (YYYY-MM-DD)',
        example: '2024-05-20',
        required: false,
    })
    @IsOptional()
    @IsDateString({}, { message: 'Invalid Date format' })
    date?: string;

    @ApiProperty({
        description: 'Filter by start date (YYYY-MM-DD)',
        example: '2024-05-01',
        required: false,
    })
    @IsOptional()
    @IsDateString({}, { message: 'Invalid Date format' })
    from?: string;

    @ApiProperty({
        description: 'Filter by end date (YYYY-MM-DD)',
        example: '2024-05-31',
        required: false,
    })
    @IsOptional()
    @IsDateString({}, { message: 'Invalid Date format' })
    to?: string;

    @ApiProperty({
        description: 'Filter by Employee ID',
        example: 'uuid-employee-id',
        required: false,
    })
    @IsOptional()
    @IsUUID('4', { message: 'Invalid Employee ID format' })
    employeeId?: string;
}
