/**
 * SubscriptionStatus Enum
 *
 * Represents the status of a clinic subscription with integrated step tracking
 * Flow: PENDING_DOCUMENT_UPLOAD → PENDING_PAYMENT_CONFIG → PENDING_APPROVAL → (REJECTED | PENDING_PAYMENT) → ACTIVE → (EXPIRED | CANCELLED)
 */
export enum SubscriptionStatus {
  /**
   * After STEP 1: Account created, waiting for legal documents upload
   * Before STEP 2: User needs to submit operatingLicense and businessLicense
   */
  PENDING_DOCUMENT_UPLOAD = 'PENDING_DOCUMENT_UPLOAD',

  /**
   * After STEP 2: Legal documents submitted, waiting for payment gateway configuration
   * Before STEP 3: User needs to configure Sepay (bankName, sepayVa)
   */
  PENDING_PAYMENT_CONFIG = 'PENDING_PAYMENT_CONFIG',

  /**
   * After STEP 3: Payment gateway configured, waiting for admin approval
   * During STEP 4: Admin is reviewing the registration
   */
  PENDING_APPROVAL = 'PENDING_APPROVAL',

  /**
   * Admin rejected during STEP 4: Registration rejected, needs resubmission
   * User can go back to PENDING_DOCUMENT_UPLOAD to resubmit documents
   */
  REJECTED = 'REJECTED',

  /**
   * Admin approved during STEP 4: Waiting for subscription payment
   * Before STEP 5: User needs to complete payment
   */
  PENDING_PAYMENT = 'PENDING_PAYMENT',

  /**
   * After STEP 5: Payment completed, subscription is active
   * STEP 6: Account activation completed
   */
  ACTIVE = 'ACTIVE',

  /**
   * Subscription has expired, can be extended
   */
  EXPIRED = 'EXPIRED',

  /**
   * Subscription was cancelled by user or admin
   */
  CANCELLED = 'CANCELLED',
}
