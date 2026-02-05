import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, IsUUID, Min } from 'class-validator';

export class ConfigureShiftDto {
    @ApiProperty({ description: 'Clinic Shift ID' })
    @IsUUID()
    @IsNotEmpty()
    shiftId: string;

    @ApiProperty({ description: 'Start Hour (HH:mm)', example: '07:00' })
    @IsString()
    @IsNotEmpty()
    startHour: string;

    @ApiProperty({ description: 'End Hour (HH:mm)', example: '11:00' })
    @IsString()
    @IsNotEmpty()
    endHour: string;

    @ApiProperty({ description: 'Step in Hours (e.g. 1 for 1 hour, 0.5 for 30 mins)', example: 1 })
    @IsNumber()
    @Min(0.1) // Minimum step constraint
    step: number;

    @ApiProperty({ description: 'Limit of patients per slot', example: 10 })
    @IsNumber()
    @Min(1)
    limit: number;
}
