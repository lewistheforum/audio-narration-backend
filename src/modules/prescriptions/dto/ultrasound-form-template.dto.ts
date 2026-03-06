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
        label: 'Mã dịch vụ',
      },
      indication: {
        type: 'textarea',
        required: false,
        label: 'Chỉ định',
      },
      bodySite: {
        type: 'text',
        required: false,
        label: 'Vị trí siêu âm',
      },
      side: {
        type: 'enum',
        required: false,
        options: ['LEFT', 'RIGHT', 'BILATERAL'],
        label: 'Bên trái/phải/hai bên',
      },
      technique: {
        type: 'textarea',
        required: false,
        label: 'Kỹ thuật thực hiện',
      },
      findings: {
        type: 'textarea',
        required: false,
        label: 'Các phát hiện',
      },
      measurements: {
        type: 'json',
        required: false,
        label: 'Các số đo',
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
      performedAt: {
        type: 'datetime',
        required: false,
        label: 'Thời gian thực hiện',
      },
    },
  })
  fields: any;

  @ApiProperty({ required: false, description: 'Current saved data if exists' })
  currentData?: any;
}
