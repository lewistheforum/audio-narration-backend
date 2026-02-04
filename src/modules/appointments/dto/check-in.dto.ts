/**
 * Check-in Patient DTO
 *
 * Data transfer object for checking in a patient for their appointment
 *
 * Note: This DTO is intentionally empty as checking in a patient
 * only requires changing the status from CONFIRMED to CHECKED_IN
 * without additional data. Staff identity is taken from the JWT token.
 */
export class CheckInDto {}

