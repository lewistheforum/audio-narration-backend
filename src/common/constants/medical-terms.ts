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
  [
    'Highly qualified trauma orthopedic specialists',
    'Modern X-ray, MRI equipment',
  ],
  [
    'Advanced physical therapy methods',
    'International standard bone density measurement',
  ],
  [
    'Spine and joint replacement specialists',
    'Minimally invasive arthroscopic surgery',
  ],
  [
    'Comprehensive rehabilitation programs',
    'Specialized sports trauma treatment',
  ],
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

export const NATIONALITIES = [
  'Vietnam',
  'Vietnamese Overseas',
  'Vietnamese Chinese',
  'Vietnamese American',
  'Vietnamese British',
];

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
    functions: [
      'General health check',
      'Blood pressure measurement',
      'Heart and lung auscultation',
      'Abdominal examination',
    ],
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
    functions: [
      'Liver examination',
      'Gallbladder examination',
      'Spleen examination',
      'Kidney examination',
    ],
  },
  ULTRASOUND_OBSTETRIC: {
    name: 'Obstetric Ultrasound',
    code: 'ULTRASOUND_OBSTETRIC_001',
    description: 'Periodic obstetric ultrasound',
    functions: [
      'Fetal heart check',
      'Fetal size measurement',
      'Fetal position assessment',
    ],
  },
  XRAY_CHEST: {
    name: 'Chest X-Ray',
    code: 'XRAY_CHEST_001',
    description: 'Chest X-ray examination',
    functions: [
      'Lung assessment',
      'Heart examination',
      'Abnormality detection',
    ],
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
    functions: [
      'Red blood cell count',
      'White blood cell count',
      'Platelet count',
      'Hemoglobin',
    ],
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
    functions: [
      'Bone density assessment',
      'Osteoporosis detection',
      'Fracture risk assessment',
    ],
  },
  PROCEDURE_VACCINE: {
    name: 'Vaccination',
    code: 'PROCEDURE_VACCINE_001',
    description: 'Preventive vaccination',
    functions: [
      'Vaccine administration',
      'Post-vaccination monitoring',
      'Vaccination schedule consultation',
    ],
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
  'https://scontent.fsgn5-9.fna.fbcdn.net/v/t39.30808-6/495964294_122190813968284082_2031134282026641728_n.jpg?_nc_cat=105&ccb=1-7&_nc_sid=833d8c&_nc_ohc=Z5CIrg7vewAQ7kNvwG7jbmT&_nc_oc=AdnM_HtymMYPYyh1_889HO6__2Y3p4h_GvVtZpOqx6FJL9mrUUW3Zquz3N-13ifogL0&_nc_zt=23&_nc_ht=scontent.fsgn5-9.fna&_nc_gid=sgHehkKl9u-QS3dQZKOg1g&oh=00_AftIWf1lyQ73ua-Hvfx8fdXKT7F2r04GtS7SJCvLz3QCAA&oe=6995EEDD',
  'https://scontent.fsgn5-9.fna.fbcdn.net/v/t39.30808-6/495964294_122190813968284082_2031134282026641728_n.jpg?_nc_cat=105&ccb=1-7&_nc_sid=833d8c&_nc_ohc=Z5CIrg7vewAQ7kNvwG7jbmT&_nc_oc=AdnM_HtymMYPYyh1_889HO6__2Y3p4h_GvVtZpOqx6FJL9mrUUW3Zquz3N-13ifogL0&_nc_zt=23&_nc_ht=scontent.fsgn5-9.fna&_nc_gid=sgHehkKl9u-QS3dQZKOg1g&oh=00_AftIWf1lyQ73ua-Hvfx8fdXKT7F2r04GtS7SJCvLz3QCAA&oe=6995EEDD',
  'https://scontent.fsgn5-12.fna.fbcdn.net/v/t39.30808-6/495964598_122190813992284082_211623923408794290_n.jpg?_nc_cat=103&ccb=1-7&_nc_sid=833d8c&_nc_ohc=KqPBVwTA6cwQ7kNvwFm6GLl&_nc_oc=AdmT4fQ-pVaNACJbzNFCld2y5oEE97wfmTQ7Y3f7yFX4I-ClIxK8pDszGkgipwqPaFQ&_nc_zt=23&_nc_ht=scontent.fsgn5-12.fna&_nc_gid=oOVSbjCOHUMIZ7wLZi3ZHQ&oh=00_AfubdtcaOb0SRaJsOAY0PTl4TXFbc2aIGbQ27FELfQCRcQ&oe=6995FB1D',
  'https://scontent.fsgn5-12.fna.fbcdn.net/v/t39.30808-6/495964598_122190813992284082_211623923408794290_n.jpg?_nc_cat=103&ccb=1-7&_nc_sid=833d8c&_nc_ohc=KqPBVwTA6cwQ7kNvwFm6GLl&_nc_oc=AdmT4fQ-pVaNACJbzNFCld2y5oEE97wfmTQ7Y3f7yFX4I-ClIxK8pDszGkgipwqPaFQ&_nc_zt=23&_nc_ht=scontent.fsgn5-12.fna&_nc_gid=oOVSbjCOHUMIZ7wLZi3ZHQ&oh=00_AfubdtcaOb0SRaJsOAY0PTl4TXFbc2aIGbQ27FELfQCRcQ&oe=6995FB1D',
  'https://scontent.fsgn5-9.fna.fbcdn.net/v/t39.30808-6/496009018_122190814016284082_7038272728913943125_n.jpg?_nc_cat=105&ccb=1-7&_nc_sid=833d8c&_nc_ohc=dI-H043wo5oQ7kNvwEj90vP&_nc_oc=AdnGtnolMgn1OneBYrW3m8Pw_aEM62Oi122U8KUH5Zr1iV5J1_RV0k_ofPMgF5_kQkM&_nc_zt=23&_nc_ht=scontent.fsgn5-9.fna&_nc_gid=FkZUxbpA6L1zB685U0SQTQ&oh=00_AfvxmdiP7XGMXTjtmW8yQiFN5kIwlofAm8ArZ-vNJebBww&oe=69960DDD',
];

export const BUSINESS_LICENSES = [
  'https://healthguardhungary.com/wp-content/uploads/2023/05/SanthaAkosPAlicense-2024Sig-1024x660.jpg',
  'https://healthguardhungary.com/wp-content/uploads/2023/05/SanthaAkosPAlicense-2024Sig-1024x660.jpg',
  'https://media.licdn.com/dms/image/v2/D5622AQGckO8URI_WzQ/feedshare-shrink_800/feedshare-shrink_800/0/1725096061875?e=2147483647&v=beta&t=e5uYY-pGcJDQd1iyXrDL3aGTl9kAardU7GcUbrQwxF0',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRT0vTGKa9rbCyITr7XQzBGdw85KGJoXn5KZg&s',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSLn8KBngm3L3rt6Ef1zqzDZTbNZ3N81EVqVA&s',
];

export const COMPLIANCE_DOCS = [
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSrNOfLU9g4gU_MCeU967AYSEuvgkUYE9xZXw&s',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXNCHrRodc0fvh2-OGXB4Z8ST5JECx7lNICQ&s',
  'https://realdoctorsnotes.com/wordpress/wp-content/uploads/2024/08/Doctors-Note-for-back-Pain-Word.jpg',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSrNOfLU9g4gU_MCeU967AYSEuvgkUYE9xZXw&s',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXNCHrRodc0fvh2-OGXB4Z8ST5JECx7lNICQ&s',
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

export const EXPERIENCE_YEARS = (years: number): string =>
  `${years} years of experience`;
