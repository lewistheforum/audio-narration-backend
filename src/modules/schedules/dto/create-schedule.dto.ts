import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsArray,
    IsDateString,
    IsNotEmpty,
    IsOptional,
    IsUUID,
    ValidateNested,
} from 'class-validator';

export class ScheduleItemDto {
    @ApiProperty({
        description: 'Clinic Shift ID',
        example: 'uuid-shift-id',
    })
    @IsNotEmpty({ message: 'Clinic Shift ID is required' })
    @IsUUID('4', { message: 'Invalid Clinic Shift ID format' })
    clinicShiftId: string;

    @ApiProperty({
        description: 'Work Date (YYYY-MM-DD)',
        example: '2024-05-20',
    })
    @IsNotEmpty({ message: 'Work Date is required' })
    @IsDateString({}, { message: 'Invalid Work Date format' })
    workDate: string;

    @ApiProperty({
        description: 'Room ID (Optional)',
        example: 'uuid-room-id',
        required: false,
    })
    @IsOptional()
    @IsUUID('4', { message: 'Invalid Room ID format' })
    roomId?: string;
}

export class CreateScheduleDto {


    @ApiProperty({
        description: 'Employee ID',
        example: 'uuid-employee-id',
    })
    @IsNotEmpty({ message: 'Employee ID is required' })
    @IsUUID('4', { message: 'Invalid Employee ID format' })
    employeeId: string;

    @ApiProperty({
        description: 'List of schedule items',
        type: [ScheduleItemDto],
    })
    @IsArray({ message: 'Items must be an array' })
    @ValidateNested({ each: true })
    @Type(() => ScheduleItemDto)
    items: ScheduleItemDto[];
}
