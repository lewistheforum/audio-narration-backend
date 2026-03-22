import { ApiProperty } from '@nestjs/swagger';

/**
 * X-ray Form Template DTO
 * Template for XRAY type ERM form
 */
export class XrayFormTemplateDto {
  @ApiProperty({ example: 'UUID' })
  ermId: string;

  @ApiProperty({ example: 'XRAY' })
  recordType: string;

  @ApiProperty({ example: 'DRAFT' })
  status: string;

  @ApiProperty({
    description: 'Form fields structure',
    example: {
      region: {
        type: 'text',
        required: false,
        label: 'Scan Region (chest, knee, spine...)',
      },
      projection: {
        type: 'text',
        required: false,
        label: 'Projection (AP, Lateral, Oblique...)',
      },
      indication: {
        type: 'textarea',
        required: false,
        label: 'Indication',
      },
      technique: {
        type: 'textarea',
        required: false,
        label: 'Imaging Technique',
      },
      findings: {
        type: 'textarea',
        required: false,
        label: 'Findings',
      },
      osteoarthritisGrade: {
        type: 'text',
        required: false,
        label: 'Osteoarthritis Grade',
      },
      conclusion: {
        type: 'textarea',
        required: false,
        label: 'Conclusion',
      },
      recommendations: {
        type: 'textarea',
        required: false,
        label: 'Recommendations',
      },
      imageUrls: {
        type: 'array',
        required: false,
        label: 'Image URLs',
      },
    },
  })
  fields: any;

  @ApiProperty({ required: false, description: 'Current saved data if exists' })
  currentData?: any;
}
