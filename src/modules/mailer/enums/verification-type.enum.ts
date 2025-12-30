/**
 * Verification Type Enumeration
 *
 * Defines the types of verification codes used in the mailer module:
 * - VERIFY: For account verification emails (email verification)
 * - RESET: For password reset emails (forgot password)
 */
export enum VerificationType {
  VERIFY = 'VERIFY',
  RESET = 'RESET',
}
