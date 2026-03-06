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
 * - PENDING_APPROVAL: Manager account created but legal documents not approved yet
 * - MANAGER_DISABLED: Manager account temporarily disabled by CLINIC_ADMIN
 */
export enum AccountStatus {
  UNVERIFIED = 'UNVERIFIED',
  ACTIVE = 'ACTIVE',
  DELETED = 'DELETED',
  BAN = 'BAN',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  MANAGER_DISABLED = 'MANAGER_DISABLED',
}
