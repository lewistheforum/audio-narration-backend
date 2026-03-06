import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { AccountStatus } from '../enums/account-status.enum';

/**
 * Query DTO for Get Manager List Endpoint
 * 
 * Supports pagination, sorting, and filtering on all accessible columns:
 * - fullName, clinicBranchName, email, province (text search)
 * - status (exact match)
 * - legalDocStatus (exact match)
 */
export class GetManagerListQueryDto {
  // Pagination
  @ApiProperty({ 
    description: 'Page number (1-indexed)', 
    required: false, 
    default: 1,
    minimum: 1 
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ 
    description: 'Items per page', 
    required: false, 
    default: 10,
    minimum: 1,
    maximum: 100 
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  // Sorting
  @ApiProperty({ 
    description: 'Sort field', 
    required: false, 
    default: 'createdAt',
    enum: ['fullName', 'clinicBranchName', 'email', 'status', 'verificationStatus', 'provinceName', 'createdAt']
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiProperty({ 
    description: 'Sort order', 
    required: false, 
    default: 'DESC',
    enum: ['ASC', 'DESC']
  })
  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'DESC';

  // Filters
  @ApiProperty({ 
    description: 'Filter by manager full name (partial match, case-insensitive)', 
    required: false 
  })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiProperty({ 
    description: 'Filter by clinic branch name (partial match, case-insensitive)', 
    required: false 
  })
  @IsOptional()
  @IsString()
  clinicBranchName?: string;

  @ApiProperty({ 
    description: 'Filter by email (partial match, case-insensitive)', 
    required: false 
  })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({ 
    description: 'Filter by account status (exact match)', 
    required: false,
    enum: AccountStatus
  })
  @IsOptional()
  @IsEnum(AccountStatus)
  status?: AccountStatus;

  @ApiProperty({ 
    description: 'Filter by legal document verification status (exact match)', 
    required: false,
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'NOT_SUBMITTED']
  })
  @IsOptional()
  @IsString()
  legalDocStatus?: string;

  @ApiProperty({ 
    description: 'Filter by province name (partial match, case-insensitive)', 
    required: false 
  })
  @IsOptional()
  @IsString()
  province?: string;
}
