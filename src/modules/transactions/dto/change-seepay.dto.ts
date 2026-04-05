import { ApiProperty, ApiHideProperty } from '@nestjs/swagger';
import { IsUUID, IsNotEmpty, IsOptional, IsNumber, Min } from 'class-validator';

export class ChangeSeepayDto {
  @ApiProperty({
    example: 'MBBank',
    description: 'Bank name',
  })
  @IsNotEmpty()
  bankName: string;

  @ApiProperty({
    example: 'Branch Name',
    description: 'Bank branch',
  })
  @IsNotEmpty()
  bankBranch: string;

  @ApiProperty({
    example: '1234567890',
    description: 'Bank account number',
  })
  @IsNotEmpty()
  bankNumber: string;

  @ApiProperty({
    example: '1234567890',
    description: 'Seepay VA',
  })
  @IsNotEmpty()
  seepayVA: string;

  @ApiProperty({
    example: '1234567890',
    description: 'Seepay key',
    required: false,
  })
  @IsNotEmpty()
  seepayKey?: string;
}
