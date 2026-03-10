import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for individual clinic branch (CLINIC_MANAGER)
 */
export class ClinicBranchDto {
  @ApiProperty({
    description: 'Branch ID (CLINIC_MANAGER._id) - Use this ID for booking',
    example: '550e8400-e29b-41d4-a716-446655440010',
  })
  clinic_id: string;

  @ApiProperty({
    description: 'Branch name with parent clinic name (e.g., "Phòng khám Đa khoa Hoàn Mỹ - Chi nhánh Quận 1")',
    example: 'Phòng khám Đa khoa Hoàn Mỹ - Chi nhánh Quận 1',
  })
  branch_name: string;

  @ApiProperty({
    description: 'Branch address',
    example: '123 Đường X, Quận 1, TP.HCM',
  })
  address: string;

  @ApiProperty({
    description: 'District of the branch',
    example: 'Quận 1',
    nullable: true,
  })
  district: string | null;

  @ApiProperty({
    description: 'Number of available appointment slots at this branch',
    example: 25,
  })
  available_slots: number;

  @ApiProperty({
    description: 'Number of available doctors at this branch',
    example: 5,
  })
  available_doctors: number;
}

/**
 * DTO for clinic system (CLINIC_ADMIN) with its branches
 */
export class ClinicSystemDto {
  @ApiProperty({
    description: 'Clinic Admin ID (CLINIC_ADMIN._id) - DO NOT use this for booking',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  admin_id: string;

  @ApiProperty({
    description: 'Name of the clinic system',
    example: 'Phòng khám Đa khoa Hoàn Mỹ',
  })
  system_name: string;

  @ApiProperty({
    description: 'Logo URL of the clinic system',
    example: 'https://example.com/logo.png',
    nullable: true,
  })
  logo: string | null;

  @ApiProperty({
    description: 'Description of the clinic system',
    example: 'Hệ thống phòng khám đa khoa uy tín với nhiều chi nhánh',
    nullable: true,
  })
  description: string | null;

  @ApiProperty({
    description: 'List of branches belonging to this clinic system',
    type: [ClinicBranchDto],
  })
  branches: ClinicBranchDto[];
}

/**
 * DTO for paginated clinic list response
 */
export class ClinicsListResponseDto {
  @ApiProperty({
    description: 'List of clinic systems with their branches',
    type: [ClinicSystemDto],
  })
  data: ClinicSystemDto[];

  @ApiProperty({
    description: 'Metadata for pagination',
    example: {
      total_systems: 5,
      total_branches: 12,
      page: 1,
      limit: 20,
      total_pages: 1,
    },
  })
  meta: {
    total_systems: number;
    total_branches: number;
    page: number;
    limit: number;
    total_pages: number;
  };
}
