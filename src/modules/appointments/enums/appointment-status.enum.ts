/**
 * Appointment Status Enum - Appointment Lifecycle Only
 * 
 * Note: Payment lifecycle has been separated into a dedicated payment module.
 * This enum only tracks the appointment/consultation workflow.
 */
export enum AppointmentStatus {
  // Appointment lifecycle
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
