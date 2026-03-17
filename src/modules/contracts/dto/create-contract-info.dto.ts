import { IsNotEmpty, IsString, IsNumber, IsDateString, IsEnum, IsOptional, ValidateIf } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ContractType } from '../enums/contract-type.enum';
import { SalaryPaymentMethod } from '../enums/salary-payment-method.enum';
import { ContractStatus } from '../enums/contract-status.enum';

export class CreateContractInfoDto {
    @ApiProperty({ description: 'Specialty of the doctor/staff', example: 'Cardiology' })
    @IsNotEmpty()
    @IsString()
    doctorSpecialty: string;

    @ApiProperty({ description: 'Nationality', example: 'Vietnamese' })
    @IsNotEmpty()
    @IsString()
    nationality: string;

    @ApiProperty({ description: 'Current place of residence', example: 'District 1, HCMC' })
    @IsNotEmpty()
    @IsString()
    currentLiving: string;

    @ApiProperty({ description: 'Specialty work at the clinic', example: 'General Examination' })
    @IsNotEmpty()
    @IsString()
    workSpecialtyAtClinic: string;

    @ApiProperty({ description: 'Contract start date', example: '2023-11-01T00:00:00.000Z' })
    @IsNotEmpty()
    @IsDateString()
    contractStartDate: string;

    @ApiProperty({ description: 'Contract end date', example: '2024-11-01T00:00:00.000Z', required: false })
    @ValidateIf((o) => o.contractEndDate !== null && o.contractEndDate !== undefined)
    @IsDateString()
    contractEndDate?: string;

    @ApiProperty({ description: 'Type of contract', enum: ContractType, example: ContractType.INDEFINITE })
    @IsNotEmpty()
    @IsEnum(ContractType)
    contractType: ContractType;

    @ApiProperty({ description: 'Job description text', example: 'Examine patients...' })
    @IsOptional()
    @IsString()
    jobDescription: string;

    @ApiProperty({ description: 'Working time details', example: '2023-11-01T08:00:00.000Z' }) // Schema says timestamptz, usually a shift start time or description?
    @IsNotEmpty()
    @IsDateString()
    workingTime: string;

    @ApiProperty({ description: 'Policy regarding rest/breaks', example: '1 hour lunch break' })
    @IsNotEmpty()
    @IsString()
    restPolicy: string;

    @ApiProperty({ description: 'Leave policy details', example: '12 days annual leave' })
    @IsNotEmpty()
    @IsString()
    leavePolicy: string;

    @ApiProperty({ description: 'Base salary amount', example: 20000000 })
    @IsNotEmpty()
    @IsNumber()
    baseSalary: number;

    @ApiProperty({ description: 'Allowance details', example: 'Lunch, Parking' })
    @IsNotEmpty()
    @IsString()
    allowances: string;

    @ApiProperty({ description: 'Performance bonus details', example: 'Based on KPIs' })
    @IsNotEmpty()
    @IsString()
    performanceBonus: string;

    @ApiProperty({ description: 'Method of salary payment', enum: SalaryPaymentMethod, example: SalaryPaymentMethod.BANK_TRANSFER })
    @IsNotEmpty()
    @IsEnum(SalaryPaymentMethod)
    salaryPaymentMethod: SalaryPaymentMethod;

    @ApiProperty({ description: 'Cycle of salary payment', example: 'Monthly on the 5th' })
    @IsNotEmpty()
    @IsString()
    salaryPaymentCycle: string;

    @ApiProperty({ description: 'Effective from date', example: '2023-11-01T00:00:00.000Z' })
    @IsNotEmpty()
    @IsDateString()
    effectiveFrom: string;

    @ApiProperty({ description: 'Effective to date', example: '2024-11-01T00:00:00.000Z', required: false })
    @ValidateIf((o) => o.effectiveTo !== null && o.effectiveTo !== undefined)
    @IsDateString()
    effectiveTo?: string;

    @ApiProperty({ description: 'Name of Party A signer (Clinic)', example: 'Dr. Nguyen Van A' })
    @IsNotEmpty()
    @IsString()
    partyASignerName: string;

    @ApiProperty({ description: 'Name of Party B signer (Employee)', example: 'Dr. Tran Van B' })
    @IsNotEmpty()
    @IsString()
    partyBSignerName: string;

    @ApiProperty({ description: 'URL or path to the contract file', required: false })
    @IsOptional()
    @IsString()
    contractFile?: string;

    @ApiProperty({ description: 'Initial contract status', enum: ContractStatus, default: ContractStatus.DRAFT, required: false })
    @IsOptional()
    @IsEnum(ContractStatus)
    contractStatus?: ContractStatus;
}
