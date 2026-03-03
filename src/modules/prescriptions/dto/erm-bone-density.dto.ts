import { ApiProperty } from '@nestjs/swagger';
import { BoneSite, WHOCategory } from '../enums';

/**
 * ERM Bone Density Detail DTO
 * 
 * Response DTO for bone density scan (DEXA) records
 */
export class ERMBoneDensityDto {
  @ApiProperty({
    description: 'Bone density record ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  _id: string;

  @ApiProperty({
    description: 'ERM record ID',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  erm_id: string;

  @ApiProperty({
    description: 'Bone site scanned',
    enum: BoneSite,
    example: BoneSite.LUMBAR_SPINE,
  })
  site: BoneSite;

  @ApiProperty({
    description: 'Bone mineral density value',
    example: '0.925',
    required: false,
  })
  bmd_value?: string;

  @ApiProperty({
    description: 'BMD measurement unit',
    example: 'g/cm²',
    required: false,
  })
  bmd_unit?: string;

  @ApiProperty({
    description: 'T-score (comparison to young adult)',
    example: -1.8,
    required: false,
  })
  t_score?: number;

  @ApiProperty({
    description: 'Z-score (comparison to age-matched)',
    example: -0.5,
    required: false,
  })
  z_score?: number;

  @ApiProperty({
    description: 'WHO diagnostic category',
    enum: WHOCategory,
    example: WHOCategory.OSTEOPENIA,
    required: false,
  })
  who_category?: WHOCategory;

  @ApiProperty({
    description: 'Fracture risk assessment',
    example: 'Moderate risk of osteoporotic fracture',
    required: false,
  })
  fracture_risk_comment?: string;

  @ApiProperty({
    description: 'Clinical recommendations',
    example: 'Calcium and Vitamin D supplementation, weight-bearing exercises',
    required: false,
  })
  recommendations?: string;

  @ApiProperty({
    description: 'Record creation timestamp',
    example: '2026-03-01T12:00:00Z',
  })
  created_at: Date;
}
