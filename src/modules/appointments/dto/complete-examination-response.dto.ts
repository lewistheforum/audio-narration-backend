import { ApiProperty } from '@nestjs/swagger';

class ErmSummaryItemDto {
  @ApiProperty({
    description: 'Service name',
    example: 'Consultation',
  })
  serviceName: string;

  @ApiProperty({
    description: 'ERM ID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  ermId: string;

  @ApiProperty({
    description: 'ERM status',
    example: 'COMPLETED',
    enum: ['COMPLETED'],
  })
  status: string;
}

export class CompleteExaminationResponseDto {
  @ApiProperty({
    description: 'Appointment ID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  appointmentId: string;

  @ApiProperty({
    description: 'Appointment status after completion',
    example: 'COMPLETED',
    enum: ['COMPLETED', 'AWAITING_PAYMENT'],
  })
  appointmentStatus: string;

  @ApiProperty({
    description: 'Payment status',
    example: 'PAID',
    enum: ['PAID', 'UNPAID', 'PARTIAL'],
  })
  paymentStatus: string;

  @ApiProperty({
    description: 'Completion timestamp',
    example: '2026-02-25T10:30:00Z',
  })
  completedAt: Date;

  @ApiProperty({
    description: 'Summary of completed ERMs',
    type: [ErmSummaryItemDto],
  })
  ermsSummary: ErmSummaryItemDto[];

  @ApiProperty({
    description: 'Whether prescription exists',
    example: true,
  })
  hasPrescription: boolean;

  @ApiProperty({
    description: 'E-prescription ID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    required: false,
  })
  ePrescriptionId?: string;

  @ApiProperty({
    description: 'Whether additional services were added',
    example: false,
  })
  hasAdditionalServices: boolean;

  @ApiProperty({
    description: 'Additional amount to pay',
    example: 0,
  })
  additionalAmount: number;

  @ApiProperty({
    description: 'Next step',
    example: 'EXPORT_PRESCRIPTION',
    enum: ['EXPORT_PRESCRIPTION', 'PROCEED_TO_PAYMENT'],
  })
  nextStep: string;
}
