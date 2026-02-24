import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { AccountRole } from '../enums';

export class GetEmployeesByClinicDto {
    @ApiPropertyOptional({
        description: 'Search by name or email',
        example: 'John',
    })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({
        description: 'Filter by role (DOCTOR or CLINIC_STAFF)',
        enum: AccountRole,
        example: AccountRole.DOCTOR,
    })
    @IsOptional()
    @IsEnum(AccountRole)
    role?: AccountRole;
}
