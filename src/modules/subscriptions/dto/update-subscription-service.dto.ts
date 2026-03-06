import { PartialType } from '@nestjs/swagger';
import { CreateSubscriptionServiceDto } from './create-subscription-service.dto';

export class UpdateSubscriptionServiceDto extends PartialType(
  CreateSubscriptionServiceDto,
) {}
