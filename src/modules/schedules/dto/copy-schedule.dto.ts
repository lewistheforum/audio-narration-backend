import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsDateString, IsNotEmpty } from 'class-validator';

export class CopyScheduleDto {
    @ApiProperty({
        description: 'List of source dates to copy from',
        example: ['2024-05-20', '2024-05-25', '2024-05-28'],
        type: [String],
    })
    @IsNotEmpty()
    @IsArray()
    @IsDateString({}, { each: true })
    fromDates: string[];

    @ApiProperty({
        description: 'Target start date (consecutive pasting starts from here)',
        example: '2024-06-27',
    })
    @IsNotEmpty()
    @IsDateString()
    targetDate: string;
}
