import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class BanClinicAdminDto {
  @ApiProperty({
    description: 'Reason for banning the clinic admin',
    example: 'Violation of community guidelines',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;
}
