import { SetMetadata } from '@nestjs/common';

export const ALLOW_EXPIRED_SUBSCRIPTION_KEY = 'allowExpiredSubscription';

/**
 * Decorator to allow CLINIC_ADMIN to access specific endpoints
 * even when their subscription is EXPIRED.
 * 
 * Usage: @AllowExpiredSubscription()
 */
export const AllowExpiredSubscription = () => SetMetadata(ALLOW_EXPIRED_SUBSCRIPTION_KEY, true);
