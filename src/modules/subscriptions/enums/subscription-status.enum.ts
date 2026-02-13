export enum RegistrationStatus {
  /**
   * STEP 2 START: Account created (Step 1.5 completed).
   * Status: User has account but hasn't configured payment gateway (Sepay) yet.
   * Action: User needs to configure Sepay.
   */
  PENDING_SEPAY_SETUP = 'PENDING_SEPAY_SETUP',

  /**
   * STEP 3 START: Account created (Step 2 completed).
   * Status: User has account but hasn't created Clinic Manager yet.
   * Action: User needs to create Clinic Manager account.
   */
  PENDING_MANAGER_SETUP = 'PENDING_MANAGER_SETUP',

  /**
   * STEP 4 START: Manager configured.
   * Status: User hasn't uploaded legal documents yet.
   * Action: User needs to upload Operating/Business License.
   */
  PENDING_LEGAL_SETUP = 'PENDING_LEGAL_SETUP',

  /**
   * STEP 4 START: All documents submitted.
   * Status: Waiting for System Admin to review and approve.
   * Action: User waits. System Admin reviews `clinic_legal_documents`.
   */
  PENDING_APPROVAL = 'PENDING_APPROVAL',

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
   * LIFECYCLE CHURN: User cancelled the subscription while Active.
   * Status: Account remains fully functional (same as ACTIVE) until expirationDate.
   * Action: System will NOT renew automatically. Transitions to EXPIRED after date passes.
   * History: Logged in clinic_subscriptions_history for churn analysis.
   */
  NON_RENEWING = 'NON_RENEWING',

  /**
   * LIFECYCLE END: Subscription duration ended.
   * Status: Account service suspended or limited until renewal.
   * Action: User needs to renew subscription manually (no auto-renewal).
   */
  EXPIRED = 'EXPIRED',

}
