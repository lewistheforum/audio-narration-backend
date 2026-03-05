import { ApiProperty } from '@nestjs/swagger';
import { AccountStatus } from '../enums/account-status.enum';

/**
 * Pagination Metadata DTO
 * Used for paginated responses
 */
export class PaginationMetaDto {
  @ApiProperty({ description: 'Current page number' })
  currentPage: number;

  @ApiProperty({ description: 'Total number of items' })
  totalItems: number;

  @ApiProperty({ description: 'Items per page' })
  itemsPerPage: number;

  @ApiProperty({ description: 'Total number of pages' })
  totalPages: number;
}

/**
 * Manager List Item DTO
 * Represents a single manager in the paginated list
 */
export class ManagerListItemDto {
  @ApiProperty({ description: 'Manager account ID' })
  managerId: string;

  @ApiProperty({ description: 'Manager full name' })
  fullName: string;

  @ApiProperty({ description: 'Clinic branch name' })
  clinicBranchName: string;

  @ApiProperty({ description: 'Email address' })
  email: string;

  @ApiProperty({ 
    description: 'Account status',
    enum: AccountStatus
  })
  status: AccountStatus;

  @ApiProperty({ description: 'Legal document verification status' })
  legalDocStatus: string;

  @ApiProperty({ description: 'Total staff count under this manager' })
  staffCount: number;

  @ApiProperty({ description: 'Total doctor count under this manager' })
  doctorCount: number;

  @ApiProperty({ description: 'Address city/province' })
  province: string;

  @ApiProperty({ description: 'Account creation date' })
  createdAt: Date;
}

/**
 * Manager List Response DTO
 * Paginated list of managers with metadata
 */
export class ManagerListResponseDto {
  @ApiProperty({ 
    type: [ManagerListItemDto],
    description: 'Array of manager items'
  })
  data: ManagerListItemDto[];

  @ApiProperty({ 
    type: PaginationMetaDto,
    description: 'Pagination metadata'
  })
  meta: PaginationMetaDto;
}
