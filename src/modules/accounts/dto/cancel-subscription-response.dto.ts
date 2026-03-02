import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CancelSubscriptionResponseDto {
  @ApiProperty({ 
    example: 'Subscription cancelled successfully. Access retained until expiration date.' 
  })
  @IsString()
  message: string;

  @ApiProperty({ 
    example: 'NON_RENEWING',
    description: 'New subscription status after cancellation'
  })
  @IsString()
  newStatus: string;
}
