/**
 * Appointment Seeder Data Constants
 *
 * Configuration and sample data for appointment-related seeders.
 * This file contains all configurable values for generating realistic test data.
 */

import { AppointmentStatus, PaymentType, AppointmentPackageStatus } from '../../modules/appointments/enums';
import { ERMRecordType, ERMStatus } from '../../modules/prescriptions/enums';
import { subtractFromVietnamTime, VIETNAM_TIMEZONE } from '../utils/date.util';
import * as dayjs from 'dayjs';

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
 * Number of ERM detail records per ERM (random between min and max)
 */
export const ERM_DETAILS_PER_ERM_MIN = 1;
export const ERM_DETAILS_PER_ERM_MAX = 5;

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
 * All valid appointment statuses (excluding payment-related statuses)
 * Use this array to create diverse sample data if needed
 */
export const VALID_APPOINTMENT_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.PENDING,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.CHECKED_IN,
  AppointmentStatus.IN_PROGRESS,
  AppointmentStatus.COMPLETED,
  AppointmentStatus.CANCELLED,
  AppointmentStatus.ABSENT,
];

/**
 * Valid ERM statuses
 * Includes all valid statuses except SIGNED
 */
export const VALID_ERM_STATUSES: ERMStatus[] = [
  ERMStatus.DRAFT,
  ERMStatus.IN_PROGRESS,
  ERMStatus.COMPLETED,
  ERMStatus.CANCELLED,
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
  AppointmentPackageStatus.PENDING_PAYMENT,
  AppointmentPackageStatus.PAID,
  AppointmentPackageStatus.CANCELLED,
];

/**
 * Sample payment types
 */
export const PAYMENT_TYPES: PaymentType[] = [
  PaymentType.ONLINE,
  PaymentType.COD,
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

const enumCounters: Record<string, number> = {};
/**
 * Get an item sequentially from an array to guarantee 100% coverage
 */
export function getSequentialItem<T>(array: T[], key: string): T {
  if (enumCounters[key] === undefined) {
    enumCounters[key] = 0;
  }
  const item = array[enumCounters[key] % array.length];
  enumCounters[key]++;
  return item;
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
  return subtractFromVietnamTime(daysAgo, 'day');
}

/**
 * Generate a random time for an appointment (between 8:00 and 17:00)
 */
export function getRandomAppointmentHour(date: Date): Date {
  const hour = getRandomInt(8, 16); // 8 AM to 4 PM (allow time for appointment)
  const minute = getRandomInt(0, 3) * 15; // 0, 15, 30, or 45 minutes
  return dayjs(date)
    .tz(VIETNAM_TIMEZONE)
    .hour(hour)
    .minute(minute)
    .second(0)
    .millisecond(0)
    .toDate();
}

/**
 * Generate a random amount for appointment package
 */
export function getRandomPackageAmount(): number {
  // Generate amount between 100,000 and 2,000,000 (in smallest currency unit)
  return getRandomInt(100000, 2000000);
}

// ============================================================================
// ERM DETAIL SEEDER DATA
// ============================================================================

/**
 * Orthopedic body regions for X-ray examinations
 */
export const XRAY_REGIONS = [
  'Cervical spine',
  'Thoracic spine',
  'Lumbar spine',
  'Left shoulder',
  'Right shoulder',
  'Left elbow',
  'Right elbow',
  'Left wrist',
  'Right wrist',
  'Left hand',
  'Right hand',
  'Left hip',
  'Right hip',
  'Left knee',
  'Right knee',
  'Left ankle',
  'Right ankle',
  'Left foot',
  'Right foot',
  'Pelvis',
  'Sacroiliac joints',
];

/**
 * X-ray projections
 */
export const XRAY_PROJECTIONS = [
  'AP (Anteroposterior)',
  'Lateral',
  'Oblique',
  'PA (Posteroanterior)',
  'Weight-bearing',
  'Flexion/Extension',
  'Stress views',
];

/**
 * X-ray findings for orthopedic conditions
 */
export const XRAY_FINDINGS = [
  'Normal bone density and alignment. No acute fracture or dislocation identified.',
  'Mild degenerative changes with marginal osteophyte formation.',
  'Moderate joint space narrowing consistent with osteoarthritis.',
  'Well-healed fracture with good alignment. Callus formation noted.',
  'Soft tissue swelling without underlying bony abnormality.',
  'Subtle cortical disruption suggestive of non-displaced fracture.',
  'Severe osteoarthritis with near-complete joint space loss and subchondral sclerosis.',
  'Mild scoliosis with maintained intervertebral disc spaces.',
  'Evidence of prior surgical intervention with hardware in situ.',
  'Diffuse osteopenia consistent with patient age.',
];

/**
 * Osteoarthritis grades (Kellgren-Lawrence)
 */
export const OSTEOARTHRITIS_GRADES = [
  'Grade 0 (Normal)',
  'Grade I (Doubtful)',
  'Grade II (Minimal)',
  'Grade III (Moderate)',
  'Grade IV (Severe)',
];

/**
 * X-ray conclusions
 */
export const XRAY_CONCLUSIONS = [
  'No acute osseous abnormality detected.',
  'Degenerative changes appropriate for patient age.',
  'Findings consistent with early osteoarthritis.',
  'Evidence of chronic joint disease.',
  'Fracture healing progressing as expected.',
  'Recommend correlation with clinical findings.',
  'Advanced degenerative joint disease noted.',
  'Consider MRI for further evaluation of soft tissue structures.',
];

/**
 * Ultrasound body sites for orthopedic examination
 */
export const ULTRASOUND_BODY_SITES = [
  'Rotator cuff',
  'Biceps tendon',
  'Achilles tendon',
  'Patellar tendon',
  'Plantar fascia',
  'Elbow lateral epicondyle',
  'Elbow medial epicondyle',
  'Hip joint',
  'Knee joint',
  'Ankle joint',
  'Shoulder joint',
  'Wrist tendons',
];

/**
 * Ultrasound findings for musculoskeletal conditions
 */
export const ULTRASOUND_FINDINGS = [
  'Normal tendon echogenicity and fiber pattern. No tear identified.',
  'Tendinosis with heterogeneous echotexture and tendon thickening.',
  'Partial-thickness tear involving approximately 50% of tendon width.',
  'Full-thickness tear with retraction of tendon fibers.',
  'Joint effusion with synovial thickening.',
  'Bursitis with fluid distension and inflammatory changes.',
  'Normal muscle architecture without evidence of hematoma or tear.',
  'Calcific tendinopathy with shadowing hyperechoic focus.',
  'Mild tenosynovitis with fluid in tendon sheath.',
  'No significant joint effusion or synovitis observed.',
];

/**
 * Ultrasound conclusions
 */
export const ULTRASOUND_CONCLUSIONS = [
  'Normal musculoskeletal ultrasound examination.',
  'Findings consistent with tendinopathy.',
  'Partial tendon tear identified - consider orthopedic consultation.',
  'Evidence of acute inflammatory process.',
  'Chronic degenerative changes noted.',
  'Recommend correlation with MRI if symptoms persist.',
  'Findings support clinical diagnosis.',
];

/**
 * Lab panel names for orthopedic-relevant tests
 */
export const LAB_PANEL_NAMES = ['INFLAMMATION', 'GOUT', 'METABOLIC', 'AUTOIMMUNE'];

/**
 * Specimen types for lab tests
 */
export const SPECIMEN_TYPES = ['Serum', 'Plasma', 'Whole blood', 'Synovial fluid'];

/**
 * Lab conclusions
 */
export const LAB_CONCLUSIONS = [
  'All values within normal reference ranges.',
  'Elevated inflammatory markers consistent with acute inflammation.',
  'Findings suggestive of gouty arthritis.',
  'Metabolic profile within acceptable limits.',
  'Autoimmune markers positive - recommend rheumatology consultation.',
  'Mild abnormalities noted - suggest repeat testing in 2 weeks.',
  'Results support clinical diagnosis of inflammatory arthritis.',
  'No significant laboratory abnormalities detected.',
];

/**
 * Lab recommendations
 */
export const LAB_RECOMMENDATIONS = [
  'Repeat testing in 3 months for monitoring.',
  'Correlate with clinical findings and imaging.',
  'Consider rheumatology referral for further evaluation.',
  'Monitor renal function given medication regimen.',
  'Follow-up testing after treatment initiation.',
  'No immediate follow-up testing required.',
  'Consider additional autoimmune panel if symptoms progress.',
];

/**
 * Bone density sites
 */
export const BONE_DENSITY_SITES = ['LUMBAR_SPINE', 'TOTAL_HIP', 'FEMORAL_NECK', 'FOREARM'];

/**
 * WHO categories for bone density
 */
export const WHO_CATEGORIES = ['NORMAL', 'OSTEOPENIA', 'OSTEOPOROSIS'];

/**
 * Bone density fracture risk comments
 */
export const FRACTURE_RISK_COMMENTS = [
  'Low 10-year fracture risk based on current BMD values.',
  'Moderate fracture risk - recommend lifestyle modifications and calcium/vitamin D supplementation.',
  'Elevated fracture risk - consider pharmacologic intervention.',
  'High fracture risk - recommend immediate treatment and fall prevention strategies.',
  'Fracture risk assessment indicates need for aggressive management.',
  'Stable bone density compared to previous scan.',
];

/**
 * Bone density recommendations
 */
export const BONE_DENSITY_RECOMMENDATIONS = [
  'Continue current calcium and vitamin D supplementation.',
  'Initiate bisphosphonate therapy per osteoporosis guidelines.',
  'Recommend weight-bearing exercise and fall prevention program.',
  'Follow-up DEXA scan in 2 years.',
  'Consider endocrinology consultation for secondary osteoporosis evaluation.',
  'Maintain adequate nutrition and avoid tobacco/excessive alcohol.',
];

/**
 * Procedure body sites
 */
export const PROCEDURE_BODY_SITES = [
  'Knee joint',
  'Shoulder joint',
  'Hip joint',
  'Elbow joint',
  'Ankle joint',
  'Lumbar spine',
  'Cervical spine',
  'Sacroiliac joint',
  'Plantar fascia',
  'Greater trochanteric bursa',
];

/**
 * Anesthesia types
 */
export const ANESTHESIA_TYPES = [
  'Local anesthetic (Lidocaine 1%)',
  'Topical anesthetic',
  'No anesthesia required',
  'Lidocaine/Bupivacaine mix',
  'Ethyl chloride spray',
];

/**
 * Procedure descriptions
 */
export const PROCEDURE_DESCRIPTIONS = [
  'Joint aspiration performed under sterile technique. Synovial fluid obtained for analysis.',
  'Corticosteroid injection administered with appropriate technique and patient positioning.',
  'Trigger point injection performed with immediate pain relief noted.',
  'Joint injection with hyaluronic acid for symptomatic osteoarthritis.',
  'Bursa aspiration completed with fluid sent for culture and analysis.',
  'Diagnostic joint injection performed to evaluate pain source.',
  'Therapeutic injection with corticosteroid and local anesthetic mixture.',
];

/**
 * Post-procedure care instructions
 */
export const POST_CARE_INSTRUCTIONS = [
  'Ice application for 15-20 minutes every 2-3 hours for first 48 hours. Avoid strenuous activity for 3-5 days.',
  'Rest treated area for 24 hours. May resume normal activities gradually as tolerated.',
  'Monitor injection site for signs of infection. Contact if increased pain, redness, or fever develops.',
  'Expect possible temporary pain increase for 24-48 hours. Take prescribed pain medication as needed.',
  'Avoid weight-bearing activities for 24 hours. Begin gentle range of motion exercises after 2 days.',
  'Apply ice and elevate extremity. Begin physical therapy exercises as prescribed.',
];

/**
 * Follow-up plans
 */
export const FOLLOW_UP_PLANS = [
  'Follow-up in 2 weeks to assess treatment response.',
  'Return visit in 4-6 weeks or sooner if symptoms worsen.',
  'Schedule follow-up appointment in 3 months for repeat injection if needed.',
  'Contact office if no improvement within 7-10 days.',
  'Continue conservative management and reassess in 6 weeks.',
  'Discharge to home care. Return as needed for symptoms.',
];

/**
 * Consultation chief complaints for orthopedic visits
 */
export const CHIEF_COMPLAINTS = [
  'Chronic lower back pain radiating to right leg',
  'Left knee pain and swelling after sports injury',
  'Progressive right shoulder pain with limited range of motion',
  'Bilateral hand pain and morning stiffness',
  'Neck pain following motor vehicle accident',
  'Chronic right hip pain affecting ambulation',
  'Left ankle instability and recurrent sprains',
  'Wrist pain following fall on outstretched hand',
  'Persistent elbow pain with gripping activities',
  'Foot pain worse with prolonged standing',
];

/**
 * Pain locations
 */
export const PAIN_LOCATIONS = [
  'Lower lumbar region with radiation to posterior thigh',
  'Anterior knee joint line',
  'Lateral shoulder with superior migration',
  'Bilateral metacarpophalangeal joints',
  'Posterior cervical paraspinal muscles',
  'Greater trochanteric region of hip',
  'Anterior talofibular ligament complex',
  'Dorsal wrist over scaphoid',
  'Lateral epicondyle of elbow',
  'Plantar fascia insertion at calcaneus',
];

/**
 * Pain characteristics
 */
export const PAIN_CHARACTERS = [
  'Sharp and stabbing',
  'Dull and aching',
  'Burning and radiating',
  'Throbbing and constant',
  'Intermittent and shooting',
  'Deep and grinding',
];

/**
 * Functional limitations
 */
export const FUNCTIONAL_LIMITATIONS = [
  'Difficulty with prolonged sitting or standing',
  'Unable to climb stairs without pain',
  'Restricted overhead reaching activities',
  'Impaired grip strength affecting daily tasks',
  'Limited walking distance due to pain',
  'Difficulty with sleeping due to positional discomfort',
  'Reduced athletic performance',
];

/**
 * Physical examination findings
 */
export const INSPECTION_FINDINGS = [
  'No visible deformity, erythema, or swelling',
  'Mild swelling and ecchymosis noted',
  'Obvious joint effusion present',
  'Muscle atrophy of surrounding musculature',
  'Antalgic gait pattern observed',
  'Normal extremity alignment',
  'Surgical scar well-healed',
];

/**
 * Working diagnoses for orthopedic conditions
 */
export const WORKING_DIAGNOSES = [
  'Degenerative disc disease',
  'Meniscal tear',
  'Rotator cuff tendinopathy',
  'Osteoarthritis',
  'Lumbar spinal stenosis',
  'Greater trochanteric pain syndrome',
  'Chronic ankle instability',
  'Carpal tunnel syndrome',
  'Lateral epicondylitis',
  'Plantar fasciitis',
  'Cervical radiculopathy',
  'Patellofemoral pain syndrome',
];

/**
 * Treatment recommendations
 */
export const TREATMENT_RECOMMENDATIONS = [
  'Initiate physical therapy focusing on strengthening and flexibility',
  'Trial of non-steroidal anti-inflammatory medications',
  'Consider corticosteroid injection if conservative measures fail',
  'Recommend activity modification and weight management',
  'Orthotics and bracing for joint support',
  'Home exercise program with gradual progression',
  'Refer to orthopedic surgery for evaluation',
  'Continue current conservative management approach',
];

/**
 * Education and advice
 */
export const EDUCATION_ADVICE = [
  'Discussed proper body mechanics and ergonomics',
  'Educated on activity modification and pain management strategies',
  'Reviewed importance of compliance with physical therapy',
  'Advised on warning signs requiring immediate medical attention',
  'Discussed realistic expectations for recovery timeline',
  'Provided information on surgical options if indicated',
];

/**
 * Visit types
 */
export const VISIT_TYPES = ['FIRST_VISIT', 'FOLLOW_UP', 'POST_PROCEDURE', 'ROUTINE', 'ONLINE', 'EMERGENCY'];

/**
 * Severity levels
 */
export const SEVERITIES = ['MILD', 'MODERATE', 'SEVERE'];

/**
 * Body sides
 */
export const BODY_SIDES = ['LEFT', 'RIGHT', 'BILATERAL'];

/**
 * Immediate outcomes
 */
export const IMMEDIATE_OUTCOMES = ['GOOD', 'FAIR', 'POOR'];
