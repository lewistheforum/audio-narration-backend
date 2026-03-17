/**
 * Generate 6-digit Verification Code
 *
 * Utility function to generate random verification codes
 *
 * @returns 6-digit string code
 */
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
