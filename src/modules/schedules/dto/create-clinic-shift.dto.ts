import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { ShiftType } from '../enums';

export class CreateClinicShiftDto {
    @ApiProperty({
        enum: ShiftType,
        description: 'Clinic Shift Name (Morning, Afternoon, Evening)',
        example: ShiftType.MORNING,
    })
    @IsEnum(ShiftType)
    @IsNotEmpty()
    shift: ShiftType;
}
