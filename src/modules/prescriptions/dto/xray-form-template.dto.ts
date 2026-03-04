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
        label: 'Vùng chụp (chest, knee, spine...)',
      },
      projection: {
        type: 'text',
        required: false,
        label: 'Tư thế chụp (AP, Lateral, Oblique...)',
      },
      indication: {
        type: 'textarea',
        required: false,
        label: 'Chỉ định',
      },
      technique: {
        type: 'textarea',
        required: false,
        label: 'Kỹ thuật chụp',
      },
      findings: {
        type: 'textarea',
        required: false,
        label: 'Các phát hiện',
      },
      osteoarthritisGrade: {
        type: 'text',
        required: false,
        label: 'Độ thoái hóa khớp',
      },
      conclusion: {
        type: 'textarea',
        required: false,
        label: 'Kết luận',
      },
      recommendations: {
        type: 'textarea',
        required: false,
        label: 'Các khuyến nghị',
      },
      imageUrls: {
        type: 'array',
        required: false,
        label: 'URL hình ảnh',
      },
    },
  })
  fields: any;

  @ApiProperty({ required: false, description: 'Current saved data if exists' })
  currentData?: any;
}
