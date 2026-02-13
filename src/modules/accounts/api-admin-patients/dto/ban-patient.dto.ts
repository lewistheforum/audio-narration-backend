import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class BanPatientDto {
  @ApiProperty({
    description: 'Reason for banning the patient',
    required: false,
    example: 'Violation of terms of service',
  })
  @IsOptional()
  @IsString()
  banDescription?: string;
}
