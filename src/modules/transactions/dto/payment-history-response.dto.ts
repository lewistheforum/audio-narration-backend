import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { formatToVietnamTime } from '../../../common/utils/date.util';

export class PaymentHistoryItemDto {
  @ApiProperty({ example: 'c0ca8af8-8ef3-4611-a67d-1b1dd815e5a8' })
  id: string;

  @ApiProperty({ example: 'f91af8b4-391e-4a41-a8c9-1f08b4b6a690' })
  prescriptionId: string;

  @ApiProperty({ example: 2277000 })
  amount: number;

  @ApiProperty({ example: 'VND' })
  currency: string;

  @ApiProperty({ enum: ['PENDING', 'SUCCESS', 'FAILED', 'EXPIRED'], example: 'SUCCESS' })
  status: string;

  @ApiProperty({ example: 'MBBank' })
  gateway: string;

  @ApiProperty({ example: 'MBVCB.3278907687' })
  referenceCode: string;

  @ApiProperty({ example: '2023-03-25T14:02:37.000Z' })
  @Transform(({ value }) => formatToVietnamTime(value))
  transactionDate: Date;

  @ApiProperty({ example: '2023-03-25T14:02:37.000Z' })
  @Transform(({ value }) => formatToVietnamTime(value))
  createdAt: Date;

  @ApiProperty({ example: 'Phòng khám ABC', required: false })
  clinicName?: string;

  @ApiProperty({ example: 'Nguyễn Văn A', required: false })
  senderFullName?: string;

  @ApiProperty({ enum: ['MALE', 'FEMALE', 'OTHER'], required: false })
  senderGender?: string;

  @ApiProperty({ example: '1990-01-01', required: false })
  @Transform(({ value }) => value ? formatToVietnamTime(value) : value)
  senderDob?: Date;
}

export class PaymentHistoryResponseDto {
  @ApiProperty({ type: [PaymentHistoryItemDto] })
  items: PaymentHistoryItemDto[];

  @ApiProperty({ example: 10 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;
}
