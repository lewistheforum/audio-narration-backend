/**
 * Account Status Enumeration
 *
 * Defines the status states for user accounts
 */
export enum AccountStatus {
  INCOMPLETE = 'INCOMPLETE', // Account created but profile not completed
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  BANNED = 'BANNED',
}
