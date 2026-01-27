export enum RegistrationStatus {
  /**
   * STEP 2 START: Account created (Step 1.5 completed).
   * Status: User has account but hasn't configured payment gateway (Sepay) yet.
   * Action: User needs to configure Sepay.
   */
  PENDING_SEPAY_SETUP = 'PENDING_SEPAY_SETUP',

  /**
   * STEP 3 START: Sepay configured.
   * Status: User hasn't created Manager account or hasn't uploaded legal documents yet.
   * Action: User needs to create first Manager and upload Operating/Business License.
   */
  PENDING_LEGAL_SETUP = 'PENDING_LEGAL_SETUP',

  /**
   * STEP 4 START: All documents submitted.
   * Status: Waiting for System Admin to review and approve.
   * Action: User waits. System Admin reviews `clinic_legal_documents`.
   */
  PENDING_APPROVAL = 'PENDING_APPROVAL',

  /**
   * STEP 4 FAIL: Admin rejected the registration.
   * Status: Documents invalid or insufficient info.
   * Action: User needs to update documents/manager info and resubmit (Back to PENDING_APPROVAL).
   */
  REJECTED = 'REJECTED',

  /**
   * STEP 5 START: Admin approved.
   * Status: Registration approved, but Subscription fee is not paid yet.
   * Action: User needs to make payment for the selected service package.
   */
  PENDING_PAYMENT = 'PENDING_PAYMENT',

  /**
   * STEP 6 DONE: Payment successful.
   * Status: Account fully activated. Service is running.
   * Action: User can access Dashboard.
   */
  ACTIVE = 'ACTIVE',

  /**
   * LIFECYCLE END: Subscription duration ended.
   * Status: Account service suspended or limited until renewal.
   * Action: User needs to renew subscription.
   */
  EXPIRED = 'EXPIRED',

  /**
   * LIFECYCLE END: User or Admin cancelled the service.
   * Status: Account is permanently disabled or archived.
   * Action: No further actions allowed. Data retention policy applies.
   */
  CANCELLED = 'CANCELLED',
}
