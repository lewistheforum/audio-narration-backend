/**
 * Appointment Status Enum - Appointment Lifecycle
 * 
 * Includes payment-related states for ERM (Electronic Medical Record) workflow
 */
export enum AppointmentStatus {
  // Appointment lifecycle
  PENDING = 'PENDING',                         // Awaiting clinic confirmation
  CONFIRMED = 'CONFIRMED',                     // Confirmed, ready for consultation
  
  // On-site workflow - At clinic
  CHECKED_IN = 'CHECKED_IN',                   // Checked in, waiting for consultation
  IN_PROGRESS = 'IN_PROGRESS',                 // Consultation in progress
  
  // Payment and completion
  NEED_FINAL_PAYMENT = 'NEED_FINAL_PAYMENT',   // Examination completed, awaiting payment (unpaid or additional services)
  COMPLETED = 'COMPLETED',                     // Consultation completed and payment settled
  
  // Cancellation states
  CANCELLED = 'CANCELLED',                     // Appointment cancelled
  ABSENT = 'ABSENT',                          // Patient did not attend
}
