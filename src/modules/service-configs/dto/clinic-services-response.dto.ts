import { ApiProperty } from '@nestjs/swagger';

/**
 * Clinic Service Item DTO
 *
 * Individual service item in the response list
 */
export class ClinicServiceItemDto {
  @ApiProperty({
    description: 'Clinic service config ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  clinicServiceId: string;

  @ApiProperty({
    description: 'Service name',
    example: 'Khám tổng quát',
  })
  serviceName: string;

  @ApiProperty({
    description: 'Service code',
    example: 'GC001',
  })
  serviceCode: string;

  @ApiProperty({
    description: 'Service description',
    example: 'Khám sức khỏe tổng quát bao gồm đo huyết áp, nghe tim phổi, khám nội khoa',
    required: false,
  })
  description?: string;

  @ApiProperty({
    description: 'Duration in minutes',
    example: 30,
    required: false,
  })
  duration?: number;

  @ApiProperty({
    description: 'Price in VND',
    example: 500000,
  })
  price: number;

  @ApiProperty({
    description: 'Discount percentage (0-100)',
    example: 0,
  })
  discount: number;

  @ApiProperty({
    description: 'Final price after discount',
    example: 500000,
  })
  finalPrice: number;

  @ApiProperty({
    description: 'Is service active',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Service category name',
    example: 'GENERAL',
    required: false,
  })
  categoryName?: string;

  @ApiProperty({
    description: 'Note for patient',
    example: 'Nhịn ăn 8 tiếng trước khi khám',
    required: false,
  })
  noteForPatient?: string;

  @ApiProperty({
    description: 'Created at timestamp',
    example: '2025-01-15T10:00:00Z',
  })
  createdAt: string;

  @ApiProperty({
    description: 'Updated at timestamp',
    example: '2025-03-01T14:30:00Z',
  })
  updatedAt: string;
}

/**
 * Pagination Metadata DTO
 */
export class PaginationDto {
  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  currentPage: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 5,
  })
  totalPages: number;

  @ApiProperty({
    description: 'Total number of items',
    example: 50,
  })
  totalItems: number;

  @ApiProperty({
    description: 'Items per page',
    example: 10,
  })
  itemsPerPage: number;
}

/**
 * Clinic Info DTO
 */
export class ClinicInfoDto {
  @ApiProperty({
    description: 'Clinic ID',
    example: '123e4567-e89b-12d3-a456-426614174010',
  })
  clinicId: string;

  @ApiProperty({
    description: 'Clinic name',
    example: 'Phòng khám Đa khoa ABC',
  })
  clinicName: string;

  @ApiProperty({
    description: 'Clinic address',
    example: '123 Nguyễn Văn Linh, Q.7, TP.HCM',
    required: false,
  })
  address?: string;

  @ApiProperty({
    description: 'Clinic phone number',
    example: '0281234567',
    required: false,
  })
  phone?: string;
}

/**
 * Clinic Services Response DTO
 *
 * Response for getting clinic services list
 */
export class ClinicServicesResponseDto {
  @ApiProperty({
    description: 'List of clinic services',
    type: [ClinicServiceItemDto],
  })
  services: ClinicServiceItemDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: PaginationDto,
  })
  pagination: PaginationDto;

  @ApiProperty({
    description: 'Clinic information',
    type: ClinicInfoDto,
  })
  clinicInfo: ClinicInfoDto;
}
