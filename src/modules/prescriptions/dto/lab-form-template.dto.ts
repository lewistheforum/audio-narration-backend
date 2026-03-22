import { ApiProperty } from '@nestjs/swagger';

/**
 * Lab Form Template DTO
 * Template for LAB type ERM form
 */
export class LabFormTemplateDto {
  @ApiProperty({ example: 'UUID' })
  ermId: string;

  @ApiProperty({ example: 'LAB' })
  recordType: string;

  @ApiProperty({ example: 'DRAFT' })
  status: string;

  @ApiProperty({
    description: 'Form fields structure',
    example: {
      panelName: {
        type: 'enum',
        required: true,
        options: ['INFLAMMATION', 'GOUT', 'METABOLIC', 'AUTOIMMUNE'],
        label: 'Test Panel Name',
      },
      specimenType: {
        type: 'text',
        required: true,
        label: 'Specimen Type (blood, urine...)',
      },
      collectedAt: {
        type: 'datetime',
        required: true,
        label: 'Collection Time',
      },
      receivedAt: {
        type: 'datetime',
        required: true,
        label: 'Received Time',
      },
      reportedAt: {
        type: 'datetime',
        required: true,
        label: 'Report Time',
      },
      results: {
        type: 'json',
        required: true,
        label: 'Results',
        structure: {
          testName: {
            value: 'number',
            unit: 'text',
            referenceRange: 'text',
            isAbnormal: 'boolean',
          },
        },
      },
      abnormalSummary: {
        type: 'boolean',
        required: true,
        label: 'Any Abnormalities',
      },
      conclusion: {
        type: 'textarea',
        required: true,
        label: 'Conclusion',
      },
      recommendations: {
        type: 'textarea',
        required: true,
        label: 'Recommendations',
      },
    },
  })
  fields: any;

  @ApiProperty({ required: false, description: 'Current saved data if exists' })
  currentData?: any;
}
