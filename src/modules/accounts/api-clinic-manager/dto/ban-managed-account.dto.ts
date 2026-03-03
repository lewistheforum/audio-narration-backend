import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class BanManagedAccountDto {
  @ApiProperty({
    description: 'Reason for banning the managed account (doctor or staff)',
    example: 'Violation of clinic policies',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;
}
