import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsPositive } from 'class-validator';

export class GenerateVerificationQrDto {
  @ApiProperty({ description: 'Test transfer amount (VND)', example: 1000, required: false })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  amount?: number;
}
