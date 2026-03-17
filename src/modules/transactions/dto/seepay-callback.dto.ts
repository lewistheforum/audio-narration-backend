import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { PaymentDirection } from '../entities/transaction.entity';

export class SeepayCallbackDto {
  @ApiProperty({ description: 'Seepay transaction identifier', example: 92704 })
  @IsNumber()
  id: number;

  @ApiProperty({ description: 'Gateway brand name', example: 'Vietcombank' })
  @IsString()
  gateway: string;

  @ApiProperty({
    description: 'Datetime when the transaction occurred on the bank side',
    example: '2023-03-25 14:02:37',
  })
  @IsDateString()
  transactionDate: string;

  @ApiProperty({ description: 'Bank account number', example: '0123499999' })
  @IsString()
  accountNumber: string;

  @ApiProperty({ description: 'Code recognized by Seepay', nullable: true })
  @IsOptional()
  @IsString()
  code?: string | null;

  @ApiProperty({ description: 'Transfer content/description' })
  @IsString()
  content: string;

  @ApiProperty({ description: 'Direction of the transfer', enum: PaymentDirection })
  @IsEnum(PaymentDirection)
  transferType: PaymentDirection;

  @ApiProperty({ description: 'Amount transferred', example: 2277000 })
  @IsNumber()
  transferAmount: number;

  @ApiProperty({ description: 'Accumulated balance after the transfer', example: 19077000 })
  @IsNumber()
  accumulated: number;

  @ApiProperty({ description: 'Sub-account number', nullable: true })
  @IsOptional()
  @IsString()
  subAccount?: string | null;

  @ApiProperty({ description: 'Reference code from SMS', example: 'MBVCB.3278907687' })
  @IsString()
  referenceCode: string;

  @ApiProperty({ description: 'Full SMS description', nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Signature header/body to verify request authenticity', required: false })
  @IsOptional()
  @IsString()
  signature?: string;

  @ApiProperty({
    description: 'Prescription ID (UUID format)',
    example: 'f91af8b4-391e-4a41-a8c9-1f08b4b6a690',
    required: false,
  })
  @IsOptional()
  @IsString()
  prescriptionId?: string;
}
