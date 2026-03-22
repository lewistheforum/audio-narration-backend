import { ApiProperty } from '@nestjs/swagger';

/**
 * Ultrasound Form Template DTO
 * Template for ULTRASOUND type ERM form
 */
export class UltrasoundFormTemplateDto {
  @ApiProperty({ example: 'UUID' })
  ermId: string;

  @ApiProperty({ example: 'ULTRASOUND' })
  recordType: string;

  @ApiProperty({ example: 'DRAFT' })
  status: string;

  @ApiProperty({
    description: 'Form fields structure',
    example: {
      serviceCode: {
        type: 'text',
        required: false,
        label: 'Service Code',
      },
      indication: {
        type: 'textarea',
        required: false,
        label: 'Indication',
      },
      bodySite: {
        type: 'text',
        required: false,
        label: 'Ultrasound Site',
      },
      side: {
        type: 'enum',
        required: false,
        options: ['LEFT', 'RIGHT', 'BILATERAL'],
        label: 'Side (Left/Right/Bilateral)',
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
      measurements: {
        type: 'json',
        required: false,
        label: 'Measurements',
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
      performedAt: {
        type: 'datetime',
        required: false,
        label: 'Procedure Time',
      },
    },
  })
  fields: any;

  @ApiProperty({ required: false, description: 'Current saved data if exists' })
  currentData?: any;
}
