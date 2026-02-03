/**
 * Appointment Seeder Data Constants
 *
 * Configuration and sample data for appointment-related seeders.
 * This file contains all configurable values for generating realistic test data.
 */

import { AppointmentStatus } from '../../modules/appointments/enums';
import { ERMRecordType, ERMStatus } from '../../modules/prescriptions/enums';

// ============================================================================
// CONFIGURATION CONSTANTS
// ============================================================================

/**
 * Number of appointments to create per patient
 * Adjust this to control how many appointments each patient will have
 */
export const APPOINTMENTS_PER_PATIENT = 3;

/**
 * Number of ERMs to create per appointment (random between min and max)
 */
export const ERMS_PER_APPOINTMENT_MIN = 1;
export const ERMS_PER_APPOINTMENT_MAX = 3;

/**
 * Number of prescription details (medicines) per prescription (random between min and max)
 */
export const PRESCRIPTION_DETAILS_PER_PRESCRIPTION_MIN = 1;
export const PRESCRIPTION_DETAILS_PER_PRESCRIPTION_MAX = 5;

/**
 * Number of services per appointment package
 */
export const SERVICES_PER_APPOINTMENT_MIN = 1;
export const SERVICES_PER_APPOINTMENT_MAX = 3;

/**
 * Appointment date range (days in the past)
 * Appointments will be scheduled between 1 and 90 days ago
 */
export const APPOINTMENT_DAYS_PAST_MIN = 1;
export const APPOINTMENT_DAYS_PAST_MAX = 90;

// ============================================================================
// STATUS CONSTANTS
// ============================================================================

/**
 * Appointment status for seeded appointments
 * All seeded appointments must be COMPLETED
 */
export const APPOINTMENT_STATUS = AppointmentStatus.COMPLETED;

/**
 * Valid ERM statuses for completed appointments
 * Only COMPLETED or SIGNED are allowed (not DRAFT/IN_PROGRESS/CANCELLED)
 */
export const VALID_ERM_STATUSES: ERMStatus[] = [
  ERMStatus.COMPLETED,
  ERMStatus.SIGNED,
];

/**
 * ERM record types
 */
export const ERM_RECORD_TYPES: ERMRecordType[] = [
  ERMRecordType.CONSULTATION,
  ERMRecordType.ULTRASOUND,
  ERMRecordType.XRAY,
  ERMRecordType.LAB,
  ERMRecordType.BONE_DENSITY,
  ERMRecordType.PROCEDURE,
];

// ============================================================================
// SAMPLE DATA ARRAYS
// ============================================================================

/**
 * Sample patient notes for appointments
 */
export const PATIENT_NOTES = [
  'I have been experiencing headaches for the past week.',
  'Follow-up appointment for previous treatment.',
  'Annual checkup and health assessment.',
  'Experiencing mild fever and body aches.',
  'Consultation for recurring back pain.',
  'Review of test results from previous visit.',
  'Routine blood pressure check.',
  'Skin condition that needs evaluation.',
  'Joint pain in left knee.',
  'Digestive issues and stomach discomfort.',
];

/**
 * Sample ERM descriptions by record type
 */
export const ERM_DESCRIPTIONS = {
  [ERMRecordType.CONSULTATION]: [
    'Patient presented with symptoms of upper respiratory infection.',
    'General health consultation and lifestyle advice.',
    'Review of chronic condition management.',
    'Discussion of preventive care measures.',
    'Evaluation of ongoing treatment progress.',
  ],
  [ERMRecordType.ULTRASOUND]: [
    'Abdominal ultrasound performed - findings within normal limits.',
    'Pelvic ultrasound examination completed.',
    'Thyroid ultrasound scan performed.',
    'Soft tissue ultrasound of affected area.',
    'Obstetric ultrasound for pregnancy monitoring.',
  ],
  [ERMRecordType.XRAY]: [
    'Chest X-ray performed - no acute abnormalities detected.',
    'X-ray of right knee - mild degenerative changes noted.',
    'Spinal X-ray series completed.',
    'Extremity X-ray for fracture assessment.',
    'Dental X-ray examination.',
  ],
  [ERMRecordType.LAB]: [
    'Complete blood count and metabolic panel ordered.',
    'Urinalysis results within normal range.',
    'Lipid profile testing completed.',
    'Thyroid function tests performed.',
    'Inflammatory markers checked.',
  ],
  [ERMRecordType.BONE_DENSITY]: [
    'DEXA scan of lumbar spine and hip performed.',
    'Bone mineral density assessment completed.',
    'Osteoporosis screening examination.',
    'Follow-up bone density measurement.',
    'Baseline bone health assessment.',
  ],
  [ERMRecordType.PROCEDURE]: [
    'Minor procedure performed successfully.',
    'Wound care and dressing change completed.',
    'Injection administered as prescribed.',
    'Biopsy procedure performed.',
    'Cryotherapy treatment applied.',
  ],
};

/**
 * Sample doctor notes for prescriptions
 */
export const PRESCRIPTION_DOCTOR_NOTES = [
  'Take as prescribed. Follow up in 2 weeks.',
  'Complete full course of medication.',
  'Take with food to reduce stomach upset.',
  'Avoid alcohol while taking this medication.',
  'Monitor for side effects and report any concerns.',
  'Store in a cool, dry place away from children.',
  'Take at the same time each day for best results.',
  'May cause drowsiness - avoid driving if affected.',
  'Finish all medication even if symptoms improve.',
  'Consult if no improvement after 3 days.',
];

/**
 * Sample prescription checkout instructions
 */
export const PRESCRIPTION_CHECKOUT_NOTES = [
  'Dispense 1 month supply',
  'Dispense 2 weeks supply with 1 refill',
  'Dispense as directed',
  'Dispense complete course',
  'Dispense with patient counseling',
];

/**
 * Sample prescription notes for detail records
 */
export const PRESCRIPTION_NOTES = [
  'Take after meals',
  'Take on empty stomach',
  'Avoid dairy products',
  'Do not crush or chew',
  'Store at room temperature',
  'Shake well before use',
  'May cause drowsiness',
  'Complete full course',
  'Take with plenty of water',
  'Consult doctor if symptoms persist',
];

/**
 * Sample service codes for ERMs
 */
export const SERVICE_CODES = [
  'CONS-001',
  'CONS-002',
  'US-001',
  'US-002',
  'XR-001',
  'XR-002',
  'LAB-001',
  'LAB-002',
  'BD-001',
  'PROC-001',
  'PROC-002',
];

/**
 * Sample appointment package statuses
 */
export const APPOINTMENT_PACKAGE_STATUSES = [
  'PAID',
  'COMPLETED',
  'REFUNDED',
];

/**
 * Sample payment types
 */
export const PAYMENT_TYPES = [
  'CASH',
  'CARD',
  'TRANSFER',
  'SEEPAY',
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get a random item from an array
 */
export function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Get a random integer between min and max (inclusive)
 */
export function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Get a random ERM description for a given record type
 */
export function getRandomERMDescription(recordType: ERMRecordType): string {
  const descriptions = ERM_DESCRIPTIONS[recordType];
  if (descriptions && descriptions.length > 0) {
    return getRandomItem(descriptions);
  }
  return 'Medical record entry.';
}

/**
 * Generate a random date in the past (between minDays and maxDays ago)
 */
export function getRandomPastDate(minDays: number, maxDays: number): Date {
  const daysAgo = getRandomInt(minDays, maxDays);
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date;
}

/**
 * Generate a random time for an appointment (between 8:00 and 17:00)
 */
export function getRandomAppointmentHour(date: Date): Date {
  const hour = getRandomInt(8, 16); // 8 AM to 4 PM (allow time for appointment)
  const minute = getRandomInt(0, 3) * 15; // 0, 15, 30, or 45 minutes
  const appointmentHour = new Date(date);
  appointmentHour.setHours(hour, minute, 0, 0);
  return appointmentHour;
}

/**
 * Generate a random amount for appointment package
 */
export function getRandomPackageAmount(): number {
  // Generate amount between 100,000 and 2,000,000 (in smallest currency unit)
  return getRandomInt(100000, 2000000);
}
