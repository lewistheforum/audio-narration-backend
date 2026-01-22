/**
 * Accept Appointment DTO
 *
 * Used when a doctor accepts a pending appointment
 * Changes status from PENDING to CONFIRMED
 *
 * Note: This DTO is intentionally empty as accepting an appointment
 * only requires changing the status without additional data.
 * The doctor's identity is taken from the JWT token.
 */
export class AcceptAppointmentDto {}

