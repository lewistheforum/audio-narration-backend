import { PartialType } from '@nestjs/swagger';
import { CreateScheduleDto, ScheduleItemDto } from './create-schedule.dto';
import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class UpdateScheduleDto {

    @ApiProperty({
        description: 'New Clinic Shift ID',
        example: 'uuid-shift-id',
        required: false,
    })
    @IsOptional()
    @IsUUID('4', { message: 'Invalid Shift ID format' })
    clinicShiftId?: string;

    @ApiProperty({
        description: 'New Work Date (YYYY-MM-DD)',
        example: '2024-05-21',
        required: false,
    })
    @IsOptional()
    @IsDateString({}, { message: 'Invalid Date format' })
    workDate?: string;

    @ApiProperty({
        description: 'New Room ID',
        example: 'uuid-room-id',
        required: false,
    })
    @IsOptional()
    @IsUUID('4', { message: 'Invalid Room ID format' })
    roomId?: string;

    @ApiProperty({
        description: 'New Employee ID (Doctor)',
        example: 'uuid-employee-id',
        required: false,
    })
    @IsOptional()
    @IsUUID('4', { message: 'Invalid Employee ID format' })
    employeeId?: string;
}
