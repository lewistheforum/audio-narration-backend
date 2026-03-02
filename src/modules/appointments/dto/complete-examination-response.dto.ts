import { ApiProperty } from '@nestjs/swagger';

class ErmSummaryItemDto {
  @ApiProperty({
    description: 'Tên dịch vụ',
    example: 'Khám tư vấn',
  })
  serviceName: string;

  @ApiProperty({
    description: 'ID của ERM',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  ermId: string;

  @ApiProperty({
    description: 'Trạng thái ERM',
    example: 'COMPLETED',
    enum: ['COMPLETED'],
  })
  status: string;
}

export class CompleteExaminationResponseDto {
  @ApiProperty({
    description: 'ID của appointment',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  appointmentId: string;

  @ApiProperty({
    description: 'Trạng thái appointment sau khi hoàn tất',
    example: 'COMPLETED',
    enum: ['COMPLETED', 'AWAITING_PAYMENT'],
  })
  appointmentStatus: string;

  @ApiProperty({
    description: 'Trạng thái thanh toán',
    example: 'PAID',
    enum: ['PAID', 'UNPAID', 'PARTIAL'],
  })
  paymentStatus: string;

  @ApiProperty({
    description: 'Thời gian hoàn tất',
    example: '2026-02-25T10:30:00Z',
  })
  completedAt: Date;

  @ApiProperty({
    description: 'Tóm tắt các ERM đã hoàn thành',
    type: [ErmSummaryItemDto],
  })
  ermsSummary: ErmSummaryItemDto[];

  @ApiProperty({
    description: 'Có đơn thuốc hay không',
    example: true,
  })
  hasPrescription: boolean;

  @ApiProperty({
    description: 'ID của đơn thuốc điện tử',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    required: false,
  })
  ePrescriptionId?: string;

  @ApiProperty({
    description: 'Có dịch vụ phát sinh hay không',
    example: false,
  })
  hasAdditionalServices: boolean;

  @ApiProperty({
    description: 'Số tiền phát sinh cần thanh toán thêm',
    example: 0,
  })
  additionalAmount: number;

  @ApiProperty({
    description: 'Bước tiếp theo',
    example: 'EXPORT_PRESCRIPTION',
    enum: ['EXPORT_PRESCRIPTION', 'PROCEED_TO_PAYMENT'],
  })
  nextStep: string;
}
