import { ApiProperty } from '@nestjs/swagger';
import { PaymentStatus } from '../entities/payment-transaction.entity';

export class PaymentResponseDto {
  @ApiProperty({ 
    description: 'Primary identifier of the payment transaction (null if not yet saved to DB)',
    nullable: true 
  })
  id: string | null;

  @ApiProperty({ description: 'Order code registered with Seepay' })
  orderCode: string;

  @ApiProperty({ description: 'Amount required for the transaction' })
  amount: number;

  @ApiProperty({ description: 'Currency code', example: 'VND' })
  currency: string;

  @ApiProperty({
    description: 'Current status of the transaction',
    enum: PaymentStatus,
    example: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  @ApiProperty({ description: 'URL of the generated dynamic QR', nullable: true })
  qrCodeUrl?: string;

  @ApiProperty({ description: 'Raw QR payload that can be encoded on the client', nullable: true })
  qrPayload?: string;

  @ApiProperty({ description: 'Expiration time of the QR code', nullable: true })
  expiresAt?: Date;

  constructor(partial: Partial<PaymentResponseDto>) {
    Object.assign(this, partial);
  }
}
