/**
 * Subscription Service Status Enum
 *
 * Defines the possible status values for subscription services.
 * Used to control which services are visible and available for purchase.
 */
export enum SubscriptionServiceStatus {
  /**
   * Service is active and available for purchase
   */
  ACTIVE = 'ACTIVE',

  /**
   * Service is inactive and not available for purchase
   */
  INACTIVE = 'INACTIVE',
}
