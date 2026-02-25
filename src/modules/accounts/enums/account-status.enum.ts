/**
 * Account Status Enumeration
 *
 * Defines the status states for user accounts
 *
 * Simplified status workflow:
 * - UNVERIFIED: Account created but email not verified yet
 * - ACTIVE: Account is active and accessible
 * - DELETED: Account has been soft-deleted
 * - BAN: Account has been banned/suspended
 */
export enum AccountStatus {
  UNVERIFIED = 'UNVERIFIED',
  ACTIVE = 'ACTIVE',
  DELETED = 'DELETED',
  BAN = 'BAN',
}
