import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { PaymentDirection, PaymentStatus } from '../entities/transaction.entity';
import { formatToVietnamTime } from '../../../common/utils/date.util';

export class TransactionDetailDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ required: false })
  prescriptionId?: string;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  currency: string;

  @ApiProperty({ enum: PaymentStatus })
  status: PaymentStatus;

  @ApiProperty({ required: false })
  gateway?: string;

  @ApiProperty({ required: false })
  referenceCode?: string;

  @ApiProperty({ required: false })
  @Transform(({ value }) => value ? formatToVietnamTime(value) : value)
  transactionDate?: Date;

  @ApiProperty()
  @Transform(({ value }) => formatToVietnamTime(value))
  createdAt: Date;

  @ApiProperty({ required: false })
  clinicName?: string;

  @ApiProperty({ required: false })
  senderFullName?: string;

  @ApiProperty({ required: false })
  senderGender?: string;

  @ApiProperty({ required: false })
  senderDob?: Date;

  @ApiProperty({ required: false })
  content?: string;

  @ApiProperty({ required: false })
  accountNumber?: string;

  @ApiProperty({ enum: PaymentDirection, required: false })
  transferType?: PaymentDirection;

  @ApiProperty({ required: false })
  transferAmount?: number;
}
