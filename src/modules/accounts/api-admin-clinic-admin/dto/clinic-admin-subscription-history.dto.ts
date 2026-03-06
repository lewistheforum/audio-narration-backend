import { ApiProperty } from '@nestjs/swagger';
import { RegistrationStatus } from '../../../subscriptions/enums';
import { PaymentStatus } from '../../../transactions/entities/transaction.entity';

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
  subscriptionDate?: Date;

  @ApiProperty({ required: false })
  expirationDate?: Date;

  @ApiProperty({ enum: RegistrationStatus })
  subscriptionStatus: RegistrationStatus;

  @ApiProperty()
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
  createdAt: Date;
}
