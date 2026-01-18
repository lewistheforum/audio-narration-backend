/**
 * Shared constants for English medical terms
 * Used across multiple seeders for consistent English medical terminology
 */

export const CLINIC_NAMES = [
  'Bonix Orthopedic Clinic Hanoi',
  'Bonix Trauma Orthopedics Clinic Ho Chi Minh City',
  'Bonix Physical Therapy Clinic Da Nang',
  'Bonix Sports Medicine Clinic Can Tho',
  'Bonix Spine Clinic Hai Phong',
];

export const SPECIALIZATIONS = [
  ['Orthopedics', 'Trauma Orthopedics'],
  ['Physical Therapy', 'Rehabilitation'],
  ['Sports Medicine', 'Sports Trauma'],
  ['Spine', 'Chronic Back Pain'],
  ['Knee/Shoulder', 'Fractures'],
];

export const PROS = [
  ['Highly qualified trauma orthopedic specialists', 'Modern X-ray, MRI equipment'],
  ['Advanced physical therapy methods', 'International standard bone density measurement'],
  ['Spine and joint replacement specialists', 'Minimally invasive arthroscopic surgery'],
  ['Comprehensive rehabilitation programs', 'Specialized sports trauma treatment'],
  ['Modern facilities', 'Health insurance and reasonable costs'],
];

export const PARACLINICAL = [
  ['Joint X-ray', 'Musculoskeletal ultrasound'],
  ['Spine MRI', 'CT bone scan'],
  ['Bone density measurement', 'EMG'],
  ['Muscle ultrasound', 'Functional joint X-ray'],
];

export const DOCTOR_SPECIALTIES = [
  'Orthopedics Specialty',
  'Orthopedics Specialty',
  'Orthopedics and Trauma Specialty',
  'Trauma Orthopedics Specialty',
  'Musculoskeletal Therapy Specialty',
];

export const NATIONALITIES = ['Vietnam', 'Vietnamese Overseas', 'Vietnamese Chinese', 'Vietnamese American', 'Vietnamese British'];

export const WORK_SPECIALTIES = [
  'Orthopedic treatment doctor',
  'Orthopedic surgeon',
  'Musculoskeletal therapy doctor',
  'Trauma orthopedics specialist',
];

export const ACADEMIC_DEGREES = [
  'Master of Medicine',
  'Doctor of Medicine',
  'Specialist Level II in Orthopedics',
  'Specialist Level I in Trauma Orthopedics',
  'Specialist Level I in Physical Therapy',
];

export const MEDICAL_SPECIALIZATIONS = [
  'Orthopedics',
  'Trauma Orthopedics',
  'Physical Therapy',
  'Rehabilitation',
  'Sports Medicine',
  'Sports Trauma',
  'Spine',
  'Chronic Back Pain',
  'Knee',
  'Shoulder',
  'Fractures',
  'Arthritis',
  'Osteoporosis',
  'Osteoarthritis',
];

export const POSITIONS = [
  'Head of Orthopedics Department',
  'Deputy Head of Trauma Orthopedics Department',
  'Orthopedics Specialist',
  'Physical Therapy Doctor',
  'Rehabilitation Doctor',
];

export const INTRODUCTIONS = [
  'Orthopedics specialist with many years of experience in diagnosing and treating bone, joint, and spine conditions.',
  'Expert in trauma orthopedics and arthroscopic surgery, committed to delivering the best treatment results for patients.',
  'Physical therapy and rehabilitation specialist with high expertise in treating sports injuries and post-surgery recovery.',
  'Dedicated orthopedic team, always updating with the latest treatment methods such as arthroscopy and physical therapy.',
  'Specialist in spine and chronic back pain with extensive experience in treating osteoarthritis and osteoporosis.',
];

export const SERVICE_CATEGORIES = [
  { name: 'General Consultation', type: 'CONSULTATION' },
  { name: 'Ultrasound', type: 'ULTRASOUND' },
  { name: 'X-Ray', type: 'XRAY' },
  { name: 'Lab Tests', type: 'LAB' },
  { name: 'Bone Density', type: 'BONE_DENSITY' },
  { name: 'Medical Procedures', type: 'PROCEDURE' },
];

export const SERVICE_NAMES = {
  CONSULTATION_GENERAL: {
    name: 'General Consultation',
    code: 'CONSULTATION_GENERAL_001',
    description: 'General consultation for adults',
    functions: ['General health check', 'Blood pressure measurement', 'Heart and lung auscultation', 'Abdominal examination'],
  },
  CONSULTATION_ENT: {
    name: 'ENT Consultation',
    code: 'CONSULTATION_ENT_001',
    description: 'Specialized ENT consultation',
    functions: ['Ear examination', 'Nose examination', 'Throat examination'],
  },
  ULTRASOUND_ABDOMINAL: {
    name: 'Abdominal Ultrasound',
    code: 'ULTRASOUND_ABDOMINAL_001',
    description: 'General abdominal ultrasound',
    functions: ['Liver examination', 'Gallbladder examination', 'Spleen examination', 'Kidney examination'],
  },
  ULTRASOUND_OBSTETRIC: {
    name: 'Obstetric Ultrasound',
    code: 'ULTRASOUND_OBSTETRIC_001',
    description: 'Periodic obstetric ultrasound',
    functions: ['Fetal heart check', 'Fetal size measurement', 'Fetal position assessment'],
  },
  XRAY_CHEST: {
    name: 'Chest X-Ray',
    code: 'XRAY_CHEST_001',
    description: 'Chest X-ray examination',
    functions: ['Lung assessment', 'Heart examination', 'Abnormality detection'],
  },
  XRAY_LIMB: {
    name: 'Limb X-Ray',
    code: 'XRAY_LIMB_001',
    description: 'X-ray of upper or lower limb',
    functions: ['Bone examination', 'Fracture detection', 'Joint assessment'],
  },
  LAB_CBC: {
    name: 'Complete Blood Count',
    code: 'LAB_CBC_001',
    description: 'Complete blood count test',
    functions: ['Red blood cell count', 'White blood cell count', 'Platelet count', 'Hemoglobin'],
  },
  LAB_GLUCOSE: {
    name: 'Glucose Test',
    code: 'LAB_GLUCOSE_001',
    description: 'Blood glucose test',
    functions: ['Fasting glucose measurement', 'Diabetes risk assessment'],
  },
  BONE_DENSITY_DEXA: {
    name: 'Bone Density Measurement',
    code: 'BONE_DENSITY_DEXA_001',
    description: 'Bone density measurement by DEXA method',
    functions: ['Bone density assessment', 'Osteoporosis detection', 'Fracture risk assessment'],
  },
  PROCEDURE_VACCINE: {
    name: 'Vaccination',
    code: 'PROCEDURE_VACCINE_001',
    description: 'Preventive vaccination',
    functions: ['Vaccine administration', 'Post-vaccination monitoring', 'Vaccination schedule consultation'],
  },
  PROCEDURE_DRESSING: {
    name: 'Dressing Change',
    code: 'PROCEDURE_DRESSING_001',
    description: 'Wound dressing change',
    functions: ['Wound cleaning', 'Dressing change', 'Care consultation'],
  },
  PROCEDURE_BLOOD_DRAW: {
    name: 'Blood Sample Collection',
    code: 'PROCEDURE_BLOOD_DRAW_001',
    description: 'Blood sample collection for testing',
    functions: ['Venous blood draw', 'Capillary blood draw', 'Sample storage'],
  },
};

export const SERVICE_NOTES = {
  CONSULTATION: 'Please arrive 15 minutes early for preparation',
  ULTRASOUND: 'Fast for 6 hours before abdominal ultrasound',
  XRAY: 'Bring previous X-ray results if available',
  LAB: 'Fast for 8 hours before blood test',
  BONE_DENSITY: 'Do not wear clothing with metal',
  PROCEDURE: 'Monitor after procedure completion',
};

export const BANK_BRANCHES = [
  'Hanoi Branch',
  'Ho Chi Minh City Branch',
  'Da Nang Branch',
  'Can Tho Branch',
  'Hai Phong Branch',
];

export const JOB_DESCRIPTIONS = [
  'Examine and treat musculoskeletal conditions for patients',
  'Perform orthopedic surgery for congenital deformities and trauma',
  'Provide consultation and post-surgery rehabilitation treatment',
  'Perform musculoskeletal diagnostic imaging and tests',
];

export const REST_POLICIES = [
  '1 day off per week, 2 days off per month, 12 days off per year',
  '2 days off per week, 3 days off per month, 14 days off per year',
  '1 day off per week, 2 days off per month, 12 days off per year, plus public holidays',
];

export const LEAVE_POLICIES = [
  'Sick leave: Social insurance coverage, paid sick leave',
  'Maternity leave: 6 months, 100% salary',
  'Maternity leave: 4 months, 75% salary',
];

export const ALLOWANCES = [
  'Allowance: 500,000 VND/month',
  'Transportation: 300,000 VND/month',
  'Lunch: 1,000,000 VND/month',
  'Phone: 200,000 VND/month',
];

export const PERFORMANCE_BONUSES = [
  'Patient examination target bonus: 10% of base salary',
  '5S evaluation bonus: 5% of base salary',
  'No job resignation bonus: 3% of base salary',
  'Professional bonus: 8% of base salary',
];

export const SALARY_PAYMENT_CYCLES = [
  'Salary payment on the 10th of each month',
  'Salary payment on the 25th of each month',
  'Salary payment on the last day of the month',
];

export const PARTY_A_SIGNERS = [
  'Dr. Nguyen Van A - Clinic Director',
  'Dr. Tran Thi B - Clinic Manager',
  'Dr. Le Van C - Head of Orthopedics',
];

export const PARTY_B_SIGNERS = [
  'Nguyen Van D - Doctor',
  'Tran Thi E - Nurse',
  'Le Van F - Doctor',
];

export const OPERATING_LICENSES = [
  'Operating license for orthopedic clinic No. {number}',
  'Operating license for orthopedic clinic No. {number}',
  'Operating license for orthopedic and trauma clinic No. {number}',
  'Operating license for trauma orthopedics clinic No. {number}',
  'Operating license for musculoskeletal therapy clinic No. {number}',
];

export const BUSINESS_LICENSES = [
  'Business registration certificate for orthopedic clinic',
  'Business registration certificate for orthopedic clinic',
  'Business registration certificate for orthopedic and trauma clinic',
  'Business registration certificate for trauma orthopedics clinic',
  'Business registration certificate for musculoskeletal therapy clinic',
];

export const COMPLIANCE_DOCS = [
  'Certificate of medical facility standards',
  'Certificate of GMP standard clinic',
  'Food safety certificate',
  'Fire safety certificate',
  'Environmental certificate',
];

export const CLINIC_POSITIONS = [
  'Director of Orthopedics Clinic',
  'Director of Orthopedics Clinic',
  'Director of Orthopedics and Trauma Clinic',
  'Director of Trauma Orthopedics Clinic',
  'Manager of Orthopedics Clinic',
];

export const DESCRIPTIONS = [
  'Specialized orthopedic clinic with highly qualified specialists in diagnosing and treating bone, joint, and spine conditions.',
  'Providing diagnostic and treatment services for bone, joint, and spine conditions with modern equipment.',
  'Expert in sports trauma treatment and comprehensive rehabilitation for patients.',
  'International standard physical therapy and rehabilitation clinic for musculoskeletal conditions.',
  'Dedicated orthopedic team with extensive experience in arthroscopic joint and spine surgery, committed to delivering the best treatment results.',
];

export const EXPERIENCE_YEARS = (years: number): string => `${years} years of experience`;
