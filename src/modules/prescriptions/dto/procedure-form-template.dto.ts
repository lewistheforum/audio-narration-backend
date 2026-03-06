import { ApiProperty } from '@nestjs/swagger';

/**
 * Procedure Form Template DTO
 * Template for PROCEDURE type ERM form
 */
export class ProcedureFormTemplateDto {
  @ApiProperty({ example: 'UUID' })
  ermId: string;

  @ApiProperty({ example: 'PROCEDURE' })
  recordType: string;

  @ApiProperty({ example: 'DRAFT' })
  status: string;

  @ApiProperty({
    description: 'Form fields structure',
    example: {
      procedureCode: {
        type: 'text',
        required: false,
        label: 'Mã thủ thuật',
      },
      indication: {
        type: 'textarea',
        required: false,
        label: 'Chỉ định',
      },
      bodySite: {
        type: 'text',
        required: false,
        label: 'Vị trí thực hiện',
      },
      side: {
        type: 'enum',
        required: false,
        options: ['LEFT', 'RIGHT', 'BILATERAL'],
        label: 'Bên trái/phải/hai bên',
      },
      anesthesiaType: {
        type: 'text',
        required: false,
        label: 'Loại vô cảm/gây mê',
      },
      performedStart: {
        type: 'datetime',
        required: false,
        label: 'Thời gian bắt đầu',
      },
      performedEnd: {
        type: 'datetime',
        required: false,
        label: 'Thời gian kết thúc',
      },
      medications: {
        type: 'json',
        required: false,
        label: 'Thuốc sử dụng',
      },
      devices: {
        type: 'textarea',
        required: false,
        label: 'Thiết bị sử dụng',
      },
      description: {
        type: 'textarea',
        required: false,
        label: 'Mô tả quá trình',
      },
      painScoreBefore: {
        type: 'number',
        required: false,
        min: 0,
        max: 10,
        label: 'Điểm đau trước thủ thuật',
      },
      painScoreAfter: {
        type: 'number',
        required: false,
        min: 0,
        max: 10,
        label: 'Điểm đau sau thủ thuật',
      },
      immediateOutcome: {
        type: 'enum',
        required: false,
        options: ['GOOD', 'FAIR', 'POOR'],
        label: 'Kết quả ngay sau thủ thuật',
      },
      complications: {
        type: 'json',
        required: false,
        label: 'Biến chứng',
      },
      postCareInstructions: {
        type: 'textarea',
        required: false,
        label: 'Hướng dẫn chăm sóc sau',
      },
      followUpPlan: {
        type: 'textarea',
        required: false,
        label: 'Kế hoạch theo dõi',
      },
    },
  })
  fields: any;

  @ApiProperty({ required: false, description: 'Current saved data if exists' })
  currentData?: any;
}
