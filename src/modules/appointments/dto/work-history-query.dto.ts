import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsDateString } from 'class-validator';
import { PaginationQueryDto } from '../../admin/dto/pagination-query.dto';
import { AppointmentStatus } from '../enums';

export class WorkHistoryQueryDto extends PaginationQueryDto {
    @ApiPropertyOptional({ description: 'Filter from appointment date (YYYY-MM-DD)' })
    @IsOptional()
    @IsDateString()
    fromDate?: string;

    @ApiPropertyOptional({ description: 'Filter to appointment date (YYYY-MM-DD)' })
    @IsOptional()
    @IsDateString()
    toDate?: string;

    @ApiPropertyOptional({ enum: AppointmentStatus, description: 'Filter by appointment status' })
    @IsOptional()
    @IsEnum(AppointmentStatus)
    status?: AppointmentStatus;
}
