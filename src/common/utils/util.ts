/**
 * Generate 6-digit Verification Code
 *
 * may cai ham nay viet trong util
 *
 * @returns 6-digit string code
 */
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
