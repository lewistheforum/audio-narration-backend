import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class GetSchedulesDto {

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

    @ApiProperty({
        description: 'Filter by Room ID',
        example: 'uuid-room-id',
        required: false,
    })
    @IsOptional()
    @IsUUID('4', { message: 'Invalid Room ID format' })
    roomId?: string;

    @ApiProperty({
        description: 'Filter by Shift ID',
        example: 'uuid-shift-id',
        required: false,
    })
    @IsOptional()
    @IsUUID('4', { message: 'Invalid Shift ID format' })
    shiftId?: string;
}
