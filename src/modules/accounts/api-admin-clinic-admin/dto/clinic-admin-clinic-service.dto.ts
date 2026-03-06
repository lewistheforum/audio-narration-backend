import { ApiProperty } from '@nestjs/swagger';

/**
 * ClinicAdminClinicServiceDto
 *
 * Represents a clinic service with its configuration
 */
export class ClinicAdminClinicServiceDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  serviceName: string;

  @ApiProperty()
  serviceCode: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty({ required: false })
  categoryName?: string;

  @ApiProperty()
  price: number;

  @ApiProperty()
  discount: number;

  @ApiProperty({ required: false })
  durationMin?: number;

  @ApiProperty({ required: false })
  noteForPatient?: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({
    required: false,
    description: 'Branch name where this service is configured',
  })
  branchName?: string;

  @ApiProperty({ required: false, description: 'Clinic manager account ID' })
  clinicManagerId?: string;
}
