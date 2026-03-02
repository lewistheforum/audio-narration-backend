import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, IsUUID, Min } from 'class-validator';

export class CreateClinicShiftHourDto {
    @ApiProperty({
        example: 'uuid-shift-id',
        description: 'Clinic Shift ID',
    })
    @IsUUID()
    @IsNotEmpty()
    shiftId: string;

    @ApiProperty({
        example: '07:00',
        description: 'Start hour (HH:mm)',
    })
    @IsString()
    @IsNotEmpty()
    startHour: string;

    @ApiProperty({
        example: '08:00',
        description: 'End hour (HH:mm)',
    })
    @IsString()
    @IsNotEmpty()
    endHour: string;

    @ApiProperty({
        example: 10,
        description: 'Patient limit for this slot',
    })
    @IsNumber()
    @Min(0)
    limit: number;
}
