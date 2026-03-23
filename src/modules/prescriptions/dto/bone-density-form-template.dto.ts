import { ApiProperty } from '@nestjs/swagger';

/**
 * Bone Density Form Template DTO
 * Template for BONE_DENSITY type ERM form
 */
export class BoneDensityFormTemplateDto {
  @ApiProperty({ example: 'UUID' })
  ermId: string;

  @ApiProperty({ example: 'BONE_DENSITY' })
  recordType: string;

  @ApiProperty({ example: 'DRAFT' })
  status: string;

  @ApiProperty({
    description: 'Form fields structure',
    example: {
      site: {
        type: 'enum',
        required: true,
        options: ['LUMBAR_SPINE', 'TOTAL_HIP', 'FEMORAL_NECK', 'FOREARM'],
        label: 'Measurement Site',
      },
      bmdValue: {
        type: 'text',
        required: false,
        label: 'BMD Value',
      },
      bmdUnit: {
        type: 'text',
        required: false,
        label: 'Unit (g/cm2)',
      },
      tScore: {
        type: 'number',
        required: false,
        label: 'T-score',
      },
      zScore: {
        type: 'number',
        required: false,
        label: 'Z-score',
      },
      whoCategory: {
        type: 'enum',
        required: false,
        options: ['NORMAL', 'OSTEOPENIA', 'OSTEOPOROSIS'],
        label: 'WHO Category',
      },
      fractureRiskComment: {
        type: 'textarea',
        required: false,
        label: 'Fracture Risk Comment',
      },
      recommendations: {
        type: 'textarea',
        required: false,
        label: 'Recommendations',
      },
    },
  })
  fields: any;

  @ApiProperty({ required: false, description: 'Current saved data if exists' })
  currentData?: any;
}
