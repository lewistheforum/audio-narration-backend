/**
 * LegalDocumentVerificationStatus Enum
 *
 * Represents the admin verification status for clinic legal documents
 * Used in STEP 4 of clinic registration process
 */
export enum LegalDocumentVerificationStatus {
  /**
   * Documents have not been submitted yet
   * Default status when clinic account is first created (STEP 1)
   */
  NOT_SUBMITTED = 'NOT_SUBMITTED',

  /**
   * Documents are pending admin review
   * Status after documents are submitted (STEP 2)
   */
  PENDING_REVIEW = 'PENDING_REVIEW',

  /**
   * Admin approved the documents
   * Clinic can proceed to payment step
   */
  APPROVED = 'APPROVED',

  /**
   * Admin rejected the documents
   * Clinic needs to resubmit
   */
  REJECTED = 'REJECTED',
}
