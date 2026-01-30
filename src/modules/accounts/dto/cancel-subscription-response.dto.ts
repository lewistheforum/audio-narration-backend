import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CancelSubscriptionResponseDto {
  @ApiProperty({ example: 'Subscription cancelled successfully' })
  @IsString()
  message: string;

  @ApiProperty({ example: 'NON_RENEWING' })
  @IsString()
  newStatus: string;
}
