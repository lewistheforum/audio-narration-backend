import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class BanClinicManagerDto {
  @ApiProperty({
    description: 'Reason for banning the clinic manager',
    example: 'Violation of clinic policies',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;
}
