import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CancelSubscriptionDto {
  @ApiPropertyOptional({ example: 'No longer need the service' })
  @IsOptional()
  @IsString()
  reason?: string;
}
