import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsPositive, IsString, IsUUID } from 'class-validator';

export class CreateTransactionDto {
  @ApiProperty({
    description: 'Prescription identifier the payment belongs to',
    example: 'f91af8b4-391e-4a41-a8c9-1f08b4b6a690',
  })
  @IsUUID()
  prescriptionId: string;

  @ApiProperty({
    description: 'Amount that should be collected for the prescription (VND)',
    example: 2277000,
  })
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty({
    description: 'Optional note appended to the generated transfer content',
    required: false,
    example: 'Thanh toan don thuoc #DH1001',
  })
  @IsString()
  @IsOptional()
  note?: string;
}
