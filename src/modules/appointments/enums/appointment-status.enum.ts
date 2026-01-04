/**
 * Appointment Status Enum - Complete Lifecycle
 */
export enum AppointmentStatus {
  // Payment lifecycle - Pre-confirmation
  AWAITING_PAYMENT = 'AWAITING_PAYMENT',      // Awaiting payment
  PAYMENT_FAILED = 'PAYMENT_FAILED',          // Payment failed (bank/gateway error)
  PAYMENT_CANCELLED = 'PAYMENT_CANCELLED',    // Payment cancelled by user
  PAYMENT_EXPIRED = 'PAYMENT_EXPIRED',        // Payment link expired
  
  // Appointment lifecycle - Post-payment
  PENDING = 'PENDING',                         // Awaiting clinic confirmation
  CONFIRMED = 'CONFIRMED',                     // Confirmed, ready for consultation
  
  // On-site workflow - At clinic
  CHECKED_IN = 'CHECKED_IN',                   // Checked in, waiting for consultation
  IN_PROGRESS = 'IN_PROGRESS',                 // Consultation in progress
  
  // Final states
  COMPLETED = 'COMPLETED',                     // Consultation completed
  CANCELLED = 'CANCELLED',                     // Appointment cancelled
  ABSENT = 'ABSENT',                          // Patient did not attend
}
