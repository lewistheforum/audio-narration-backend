import { ApiProperty } from '@nestjs/swagger';
import { PaymentDirection, PaymentStatus } from '../entities/transaction.entity';

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
  transactionDate?: Date;

  @ApiProperty()
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
