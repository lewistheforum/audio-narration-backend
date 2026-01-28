import { IsNotEmpty, IsUUID, IsString, IsDateString, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ContractRole } from '../enums/contract-role.enum';

export class CreateContractPackageDto {
    @ApiProperty({
        description: 'The ID of the employee (Doctor/Staff) being hired',
        example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    })
    @IsNotEmpty()
    @IsUUID()
    employeeId: string;

    // @ApiProperty({
    //     description: 'The ID of the Clinic (Manager) - Extracted from Token',
    //     required: false
    // })
    @IsOptional()
    clinicId?: string;

    @ApiProperty({
        description: 'The role of the contract (MANAGER or EMPLOYEE - usually determined by who is creating)',
        enum: ContractRole,
        example: ContractRole.EMPLOYEE,
    })
    @IsNotEmpty()
    @IsEnum(ContractRole)
    role: ContractRole;

    @ApiProperty({
        description: 'Address in the contract header',
        example: 'Ho Chi Minh City, Vietnam',
        required: false
    })
    @IsOptional()
    @IsString()
    headerAddress?: string;

    @ApiProperty({
        description: 'Date in the contract header',
        example: '2023-10-27T10:00:00.000Z',
        required: false
    })
    @IsOptional()
    @IsDateString()
    headerDate?: string;

    @ApiProperty({
        description: 'Name of the clinic representative',
        example: 'Dr. Nguyen Van A',
        required: false
    })
    @IsOptional()
    @IsString()
    clinicRepresentative?: string;

    @ApiProperty({
        description: 'Position of the representative',
        example: 'Clinic Director',
        required: false
    })
    @IsOptional()
    @IsString()
    position?: string;
}
