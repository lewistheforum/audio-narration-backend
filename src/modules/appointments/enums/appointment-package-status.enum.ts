/**
 * Appointment Package Status Enum
 *
 * Tracks the payment lifecycle for individual service packages within an appointment.
 */
export enum AppointmentPackageStatus {
  PENDING_PAYMENT = 'pending_payment',
  PAID = 'paid',
  CANCELLED = 'cancelled',
}
