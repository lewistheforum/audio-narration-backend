import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { RegistrationStatus } from '../../../subscriptions/enums';
import { PaymentStatus } from '../../../transactions/entities/transaction.entity';
import { formatToVietnamTime } from '../../../../common/utils/date.util';

/**
 * ClinicAdminSubscriptionHistoryItemDto
 *
 * Represents a single subscription registration history record
 */
export class ClinicAdminSubscriptionHistoryItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  serviceName: string;

  @ApiProperty({ required: false })
  serviceCode?: string;

  @ApiProperty({ required: false })
  @Transform(({ value }) => value ? formatToVietnamTime(value) : value)
  subscriptionDate?: Date;

  @ApiProperty({ required: false })
  @Transform(({ value }) => value ? formatToVietnamTime(value) : value)
  expirationDate?: Date;

  @ApiProperty({ enum: RegistrationStatus })
  subscriptionStatus: RegistrationStatus;

  @ApiProperty()
  @Transform(({ value }) => formatToVietnamTime(value))
  createdAt: Date;
}

/**
 * TransactionHistoryItemDto
 *
 * Represents a single transaction history record
 */
export class TransactionHistoryItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  amount: number;

  @ApiProperty({ required: false })
  currency?: string;

  @ApiProperty({ enum: PaymentStatus })
  status: PaymentStatus;

  @ApiProperty({ required: false })
  @Transform(({ value }) => value ? formatToVietnamTime(value) : value)
  transactionDate?: Date;

  @ApiProperty({ required: false })
  gateway?: string;

  @ApiProperty({ required: false })
  content?: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty({ required: false })
  code?: string;

  @ApiProperty({ required: false })
  transactionTypeName?: string;

  @ApiProperty()
  @Transform(({ value }) => formatToVietnamTime(value))
  createdAt: Date;
}
