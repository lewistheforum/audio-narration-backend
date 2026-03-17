import { ApiProperty } from '@nestjs/swagger';
import { ServiceCategoryType } from '../enums';
import { ClinicServiceCategory } from '../entities';

import { ClinicUsingCategoryDto } from './clinic-using-category.dto';

export class ClinicServiceCategoryResponseDto {
  @ApiProperty({
    description: 'Category ID',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  id: string;

  @ApiProperty({
    description: 'Category Name',
    example: 'General Checkup',
  })
  categoryName: string;

  @ApiProperty({
    description: 'Category Type',
    enum: ServiceCategoryType,
    example: ServiceCategoryType.CONSULTATION,
  })
  type: ServiceCategoryType;

  @ApiProperty({
    description: 'Is Active Status',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Created At',
    example: '2023-10-27T10:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Updated At',
    example: '2023-10-27T10:00:00.000Z',
  })
  updatedAt: Date;

  @ApiProperty({
    description: 'Number of clinics using services in this category',
    example: 5,
    required: false,
  })
  clinicCount?: number;

  @ApiProperty({
    description: 'List of clinics using services in this category',
    type: [ClinicUsingCategoryDto],
    required: false,
  })
  clinicUsage?: ClinicUsingCategoryDto[];

  constructor(
    entity: ClinicServiceCategory,
    clinicCount?: number,
    clinicUsage?: ClinicUsingCategoryDto[],
  ) {
    this.id = entity._id;
    this.categoryName = entity.categoryName;
    this.type = entity.type;
    this.isActive = entity.isActive;
    this.createdAt = entity.createdAt;
    this.updatedAt = entity.updatedAt;
    this.clinicCount = clinicCount;
    this.clinicUsage = clinicUsage;
  }
}
