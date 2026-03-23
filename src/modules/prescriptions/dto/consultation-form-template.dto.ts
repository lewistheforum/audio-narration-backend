import { ApiProperty } from '@nestjs/swagger';

/**
 * Consultation Form Template DTO
 * Template for CONSULTATION type ERM form
 */
export class ConsultationFormTemplateDto {
  @ApiProperty({ example: 'UUID' })
  ermId: string;

  @ApiProperty({ example: 'CONSULTATION' })
  recordType: string;

  @ApiProperty({ example: 'DRAFT' })
  status: string;

  @ApiProperty({
    description: 'Form fields structure',
    example: {
      visitType: {
        type: 'enum',
        required: true,
        options: ['FIRST_VISIT', 'FOLLOW_UP', 'POST_PROCEDURE', 'ROUTINE', 'ONLINE', 'EMERGENCY'],
        label: 'Visit Type',
      },
      mainServiceCode: {
        type: 'text',
        required: false,
        label: 'Main Service Code',
      },
      // Section 1: Examination Information
      chiefComplaint: {
        type: 'textarea',
        required: false,
        label: 'Chief Complaint',
        section: 'Examination Information',
      },
      onsetDuration: {
        type: 'text',
        required: false,
        label: 'Onset Duration',
        section: 'Examination Information',
      },
      painLocation: {
        type: 'text',
        required: false,
        label: 'Pain Location',
        section: 'Examination Information',
      },
      painCharacter: {
        type: 'text',
        required: false,
        label: 'Pain Character',
        section: 'Examination Information',
      },
      painIntensity: {
        type: 'number',
        required: false,
        min: 0,
        max: 10,
        label: 'Pain Intensity (0-10)',
        section: 'Examination Information',
      },
      aggravatingFactors: {
        type: 'textarea',
        required: false,
        label: 'Aggravating Factors',
        section: 'Examination Information',
      },
      relievingFactors: {
        type: 'textarea',
        required: false,
        label: 'Relieving Factors',
        section: 'Examination Information',
      },
      functionalLimitations: {
        type: 'textarea',
        required: false,
        label: 'Functional Limitations',
        section: 'Examination Information',
      },
      // Section 2: Medical History
      pastMskHistory: {
        type: 'textarea',
        required: false,
        label: 'Past Musculoskeletal History',
        section: 'Medical History',
      },
      pastMedicalHistory: {
        type: 'textarea',
        required: false,
        label: 'Past Medical History',
        section: 'Medical History',
      },
      medicationHistory: {
        type: 'textarea',
        required: false,
        label: 'Medication History',
        section: 'Medical History',
      },
      familyHistory: {
        type: 'textarea',
        required: false,
        label: 'Family History',
        section: 'Medical History',
      },
      redFlags: {
        type: 'json',
        required: false,
        label: 'Red Flags',
        section: 'Medical History',
      },
      // Section 3: Clinical Examination
      vitalSigns: {
        type: 'json',
        required: false,
        label: 'Vital Signs',
        section: 'Clinical Examination',
        fields: {
          bloodPressure: 'Blood Pressure',
          heartRate: 'Heart Rate',
          temperature: 'Temperature',
          respiratoryRate: 'Respiratory Rate',
        },
      },
      inspectionFindings: {
        type: 'textarea',
        required: false,
        label: 'Inspection Findings',
        section: 'Clinical Examination',
      },
      palpationFindings: {
        type: 'textarea',
        required: false,
        label: 'Palpation Findings',
        section: 'Clinical Examination',
      },
      rangeOfMotion: {
        type: 'json',
        required: false,
        label: 'Range of Motion',
        section: 'Clinical Examination',
      },
      specialTests: {
        type: 'json',
        required: false,
        label: 'Special Tests',
        section: 'Clinical Examination',
      },
      neuroExam: {
        type: 'textarea',
        required: false,
        label: 'Neurological Examination',
        section: 'Clinical Examination',
      },
      gaitAssessment: {
        type: 'textarea',
        required: false,
        label: 'Gait Assessment',
        section: 'Clinical Examination',
      },
      // Section 4: Diagnosis and Plan
      workingDiagnosis: {
        type: 'json',
        required: false,
        label: 'Working Diagnosis',
        section: 'Diagnosis and Plan',
      },
      severity: {
        type: 'enum',
        required: false,
        options: ['MILD', 'MODERATE', 'SEVERE'],
        label: 'Severity Level',
        section: 'Diagnosis and Plan',
      },
      comorbidImpact: {
        type: 'textarea',
        required: false,
        label: 'Comorbid Impact',
        section: 'Diagnosis and Plan',
      },
      riskFactors: {
        type: 'textarea',
        required: false,
        label: 'Risk Factors',
        section: 'Diagnosis and Plan',
      },
      physiotherapyPlan: {
        type: 'json',
        required: false,
        label: 'Physiotherapy Plan',
        section: 'Diagnosis and Plan',
      },
      educationAdvice: {
        type: 'textarea',
        required: false,
        label: 'Education and Advice',
        section: 'Diagnosis and Plan',
      },
      followUpDate: {
        type: 'text',
        required: false,
        label: 'Follow-up Date',
        section: 'Diagnosis and Plan',
      },
      followUpCondition: {
        type: 'textarea',
        required: false,
        label: 'Follow-up Condition',
        section: 'Diagnosis and Plan',
      },
    },
  })
  fields: any;

  @ApiProperty({ required: false, description: 'Current saved data if exists' })
  currentData?: any;
}
