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
        label: 'Tên panel xét nghiệm',
      },
      specimenType: {
        type: 'text',
        required: true,
        label: 'Loại mẫu (máu, nước tiểu...)',
      },
      collectedAt: {
        type: 'datetime',
        required: true,
        label: 'Thời gian lấy mẫu',
      },
      receivedAt: {
        type: 'datetime',
        required: true,
        label: 'Thời gian nhận mẫu',
      },
      reportedAt: {
        type: 'datetime',
        required: true,
        label: 'Thời gian có kết quả',
      },
      results: {
        type: 'json',
        required: true,
        label: 'Kết quả',
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
        label: 'Có bất thường hay không',
      },
      conclusion: {
        type: 'textarea',
        required: true,
        label: 'Kết luận',
      },
      recommendations: {
        type: 'textarea',
        required: true,
        label: 'Các khuyến nghị',
      },
    },
  })
  fields: any;

  @ApiProperty({ required: false, description: 'Current saved data if exists' })
  currentData?: any;
}
