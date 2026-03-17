import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ERM } from '../../modules/prescriptions/entities/erm.entity';
import { ERMConsultation } from '../../modules/prescriptions/entities/erm-consultation.entity';
import { ERMXray } from '../../modules/prescriptions/entities/erm-xray.entity';
import { ERMUltrasound } from '../../modules/prescriptions/entities/erm-ultrasound.entity';
import { ERMLab } from '../../modules/prescriptions/entities/erm-lab.entity';
import { ERMBoneDensity } from '../../modules/prescriptions/entities/erm-bone-density.entity';
import { ERMProcedure } from '../../modules/prescriptions/entities/erm-procedure.entity';
import { ServiceAppointment } from '../../modules/appointments/entities/service-appointment.entity';
import { Appointment } from '../../modules/appointments/entities/appointment.entity';
import { getCurrentVietnamTime, subtractFromVietnamTime, addToDate } from '../utils/date.util';
import {
  ERMStatus,
  ERMRecordType,
  VisitType,
  Severity,
  PanelName,
  BoneSite,
  WHOCategory,
  BodySide,
  ImmediateOutcome,
} from '../../modules/prescriptions/enums';
import {
  ERMS_PER_APPOINTMENT_MIN,
  ERMS_PER_APPOINTMENT_MAX,
  ERM_DETAILS_PER_ERM_MIN,
  ERM_DETAILS_PER_ERM_MAX,
  VALID_ERM_STATUSES,
  ERM_RECORD_TYPES,
  getRandomInt,
  getRandomItem,
  getSequentialItem,
  getRandomERMDescription,
  SERVICE_CODES,
  XRAY_REGIONS,
  XRAY_PROJECTIONS,
  XRAY_FINDINGS,
  OSTEOARTHRITIS_GRADES,
  XRAY_CONCLUSIONS,
  ULTRASOUND_BODY_SITES,
  ULTRASOUND_FINDINGS,
  ULTRASOUND_CONCLUSIONS,
  LAB_PANEL_NAMES,
  SPECIMEN_TYPES,
  LAB_CONCLUSIONS,
  LAB_RECOMMENDATIONS,
  BONE_DENSITY_SITES,
  WHO_CATEGORIES,
  FRACTURE_RISK_COMMENTS,
  BONE_DENSITY_RECOMMENDATIONS,
  PROCEDURE_BODY_SITES,
  ANESTHESIA_TYPES,
  PROCEDURE_DESCRIPTIONS,
  POST_CARE_INSTRUCTIONS,
  FOLLOW_UP_PLANS,
  CHIEF_COMPLAINTS,
  PAIN_LOCATIONS,
  PAIN_CHARACTERS,
  FUNCTIONAL_LIMITATIONS,
  INSPECTION_FINDINGS,
  WORKING_DIAGNOSES,
  TREATMENT_RECOMMENDATIONS,
  EDUCATION_ADVICE,
  VISIT_TYPES,
  SEVERITIES,
  BODY_SIDES,
  IMMEDIATE_OUTCOMES,
} from '../constants/appointment-seeder-data';

/**
 * ERM Seeder Service
 *
 * Seeds Electronic Medical Records for completed appointments with detailed record types.
 * Creates 1-3 ERMs per appointment (one per service appointment) and 1-5 detail records per ERM.
 *
 * Seeding Rules:
 * - ERM status is varied (DRAFT, IN_PROGRESS, COMPLETED, CANCELLED)
 * - Links to valid service_appointments and appointments
 * - Generates detail records based on record_type:
 *   - CONSULTATION -> erm_consultations
 *   - XRAY -> erm_xrays
 *   - ULTRASOUND -> erm_ultrasounds
 *   - LAB -> erm_labs
 *   - BONE_DENSITY -> erm_bone_density
 *   - PROCEDURE -> erm_procedures
 *
 * Idempotent: Uses check-then-insert pattern
 */
@Injectable()
export class ERMSeederService {
  private readonly logger = new Logger(ERMSeederService.name);

  constructor(
    @InjectRepository(ERM)
    private readonly ermRepository: Repository<ERM>,
    @InjectRepository(ERMConsultation)
    private readonly ermConsultationRepository: Repository<ERMConsultation>,
    @InjectRepository(ERMXray)
    private readonly ermXrayRepository: Repository<ERMXray>,
    @InjectRepository(ERMUltrasound)
    private readonly ermUltrasoundRepository: Repository<ERMUltrasound>,
    @InjectRepository(ERMLab)
    private readonly ermLabRepository: Repository<ERMLab>,
    @InjectRepository(ERMBoneDensity)
    private readonly ermBoneDensityRepository: Repository<ERMBoneDensity>,
    @InjectRepository(ERMProcedure)
    private readonly ermProcedureRepository: Repository<ERMProcedure>,
    @InjectRepository(ServiceAppointment)
    private readonly serviceAppointmentRepository: Repository<ServiceAppointment>,
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
  ) {}

  /**
   * Seed ERM records for all service appointments with detail records
   *
   * This method is called by SeederOrchestratorService during application bootstrap.
   */
  async seed(): Promise<void> {
    try {
      this.logger.log('Starting to seed ERMs with detail records...');

      // Step 1: Fetch all service appointments with relations
      const serviceAppointments = await this.serviceAppointmentRepository.find({
        relations: ['appointmentPackage', 'erm'],
      });

      if (serviceAppointments.length === 0) {
        this.logger.warn('No service appointments found. Skipping ERM seeding.');
        return;
      }

      this.logger.log(`Found ${serviceAppointments.length} service appointments`);

      // Step 2: Create ERMs for service appointments that don't have one
      let createdCount = 0;
      let skippedCount = 0;
      let detailsCreatedCount = 0;

      for (const serviceAppointment of serviceAppointments) {
        // Check if ERM already exists for this service appointment
        if (serviceAppointment.erm) {
          skippedCount++;
          continue;
        }

        // Get the appointment from the package
        const appointmentPackage = serviceAppointment.appointmentPackage;
        if (!appointmentPackage) {
          this.logger.warn(
            `Service appointment ${serviceAppointment._id} has no package. Skipping ERM creation.`,
          );
          continue;
        }

        // Get the appointment for this package
        const appointment = await this.appointmentRepository.findOne({
          where: { _id: appointmentPackage.appointmentId },
        });

        if (!appointment) {
          this.logger.warn(
            `No appointment found for package ${appointmentPackage._id}. Skipping ERM creation.`,
          );
          continue;
        }

        // Verify appointment is COMPLETED
        if (appointment.status !== 'COMPLETED') {
          this.logger.warn(
            `Appointment ${appointment._id} is not COMPLETED. Skipping ERM creation.`,
          );
          continue;
        }

        // Create ERM
        const erm = this.createERM(serviceAppointment, appointment);
        const savedErm = await this.ermRepository.save(erm);
        createdCount++;

        // Create detail records based on record type
        const detailCount = await this.createERMDetails(savedErm, appointment);
        detailsCreatedCount += detailCount;
      }

      this.logger.log(`✅ Created ${createdCount} ERMs`);
      this.logger.log(`✅ Created ${detailsCreatedCount} ERM detail records`);
      this.logger.log(`ℹ️  Skipped ${skippedCount} existing ERMs`);
      this.logger.log('✅ ERM seeding completed successfully');
    } catch (error) {
      this.logger.error('Failed to seed ERMs', error.stack);
      throw error;
    }
  }

  /**
   * Create an ERM entity for a service appointment
   *
   * @param serviceAppointment - The service appointment to create ERM for
   * @param appointment - The parent appointment
   * @returns ERM entity
   */
  private createERM(
    serviceAppointment: ServiceAppointment,
    appointment: Appointment,
  ): ERM {
    // Pick random record type
    const recordType = getRandomItem(ERM_RECORD_TYPES);

    // Pick random valid status
    const status = getRandomItem(VALID_ERM_STATUSES);

    // Pick random service code
    const serviceCode = getRandomItem(SERVICE_CODES);

    // Get a doctor ID from the appointment or use clinic ID as fallback
    const createdBy = appointment.doctorId || appointment.clinicId;

    // Generate signed_at timestamp only if COMPLETED
    const signedAt = status === ERMStatus.COMPLETED ? getCurrentVietnamTime() : null;

    return this.ermRepository.create({
      serviceAppointmentsId: serviceAppointment._id,
      appointmentId: appointment._id,
      recordType,
      serviceCode,
      status,
      createdBy,
      signedAt,
    });
  }

  /**
   * Create detail records for an ERM based on its record type
   *
   * @param erm - The ERM to create details for
   * @param appointment - The parent appointment
   * @returns Number of detail records created
   */
  private async createERMDetails(erm: ERM, appointment: Appointment): Promise<number> {
    const detailCount = getRandomInt(1, 3); // Create 1-3 different types of details
    
    // Always include the main recordType
    const selectedTypes = new Set<ERMRecordType>([erm.recordType]);
    
    // Try to add more distinct types
    let attempts = 0;
    while (selectedTypes.size < detailCount && attempts < 10) {
      selectedTypes.add(getRandomItem(ERM_RECORD_TYPES));
      attempts++;
    }
    
    let totalCreated = 0;
    for (const recordType of selectedTypes) {
      switch (recordType) {
        case ERMRecordType.CONSULTATION:
          totalCreated += await this.createConsultationDetails(erm, 1);
          break;
        case ERMRecordType.XRAY:
          totalCreated += await this.createXrayDetails(erm, 1);
          break;
        case ERMRecordType.ULTRASOUND:
          totalCreated += await this.createUltrasoundDetails(erm, 1);
          break;
        case ERMRecordType.LAB:
          totalCreated += await this.createLabDetails(erm, 1);
          break;
        case ERMRecordType.BONE_DENSITY:
          totalCreated += await this.createBoneDensityDetails(erm, 1);
          break;
        case ERMRecordType.PROCEDURE:
          totalCreated += await this.createProcedureDetails(erm, 1);
          break;
      }
    }
    return totalCreated;
  }

  /**
   * Create consultation detail records
   */
  private async createConsultationDetails(erm: ERM, count: number): Promise<number> {
    for (let i = 0; i < count; i++) {
      const consultation = this.ermConsultationRepository.create({
        ermId: erm._id,
        visitType: getSequentialItem(VISIT_TYPES, 'visitType') as VisitType,
        mainServiceCode: getRandomItem(SERVICE_CODES),
        chiefComplaint: getRandomItem(CHIEF_COMPLAINTS),
        onsetDuration: `${getRandomInt(1, 24)} ${getRandomItem(['weeks', 'months', 'years'])} ago`,
        painLocation: getRandomItem(PAIN_LOCATIONS),
        painCharacter: getRandomItem(PAIN_CHARACTERS),
        painIntensity: getRandomInt(4, 9), // 4-9 on pain scale
        aggravatingFactors: 'Activity, prolonged sitting/standing, cold weather',
        relievingFactors: 'Rest, ice application, anti-inflammatory medications',
        functionalLimitations: getRandomItem(FUNCTIONAL_LIMITATIONS),
        pastMskHistory: 'No prior significant musculoskeletal injuries',
        pastMedicalHistory: 'Hypertension controlled with medication',
        medicationHistory: 'Ibuprofen 400mg PRN for pain',
        familyHistory: 'Mother with osteoarthritis',
        redFlags: JSON.stringify({
          fever: false,
          unexplained_weight_loss: false,
          bowel_bladder_dysfunction: false,
          progressive_neurological_deficit: false,
        }),
        vitalSigns: JSON.stringify({
          blood_pressure: `${getRandomInt(110, 140)}/${getRandomInt(70, 90)}`,
          heart_rate: getRandomInt(60, 85),
          temperature: (36 + Math.random()).toFixed(1),
          respiratory_rate: getRandomInt(14, 18),
        }),
        inspectionFindings: getRandomItem(INSPECTION_FINDINGS),
        palpationFindings: 'Tenderness to palpation over affected area. No warmth or crepitus.',
        rangeOfMotion: JSON.stringify({
          flexion: `${getRandomInt(80, 120)} degrees`,
          extension: `${getRandomInt(20, 45)} degrees`,
          limitation: 'Moderate limitation with painful arc',
        }),
        specialTests: JSON.stringify([
          {
            test_name: 'Straight Leg Raise',
            result: getRandomItem(['Positive', 'Negative']),
          },
          {
            test_name: 'McMurray Test',
            result: getRandomItem(['Positive', 'Negative']),
          },
        ]),
        neuroExam: 'Sensation intact. Motor strength 5/5 in all extremities. Reflexes normal and symmetric.',
        gaitAssessment: getRandomItem([
          'Normal gait pattern',
          'Antalgic gait favoring affected side',
          'Decreased stride length noted',
        ]),
        workingDiagnosis: JSON.stringify([
          {
            diagnosis: getRandomItem(WORKING_DIAGNOSES),
            icd10_code: 'M25.5',
          },
        ]),
        severity: getSequentialItem(SEVERITIES, 'severity') as Severity,
        comorbidImpact: 'Mild functional impairment affecting daily activities',
        riskFactors: 'Age, obesity, previous injury',
        physiotherapyPlan: JSON.stringify({
          frequency: '2-3 times per week',
          duration: '6-8 weeks',
          focus_areas: ['Strengthening', 'Flexibility', 'Pain management'],
        }),
        educationAdvice: getRandomItem(EDUCATION_ADVICE),
        followUpDate: `${getRandomInt(2, 6)} weeks`,
        followUpCondition: 'Return sooner if symptoms worsen or new neurological symptoms develop',
        createdAt: erm.createdAt,
      });

      await this.ermConsultationRepository.save(consultation);
    }
    return count;
  }

  /**
   * Create X-ray detail records
   */
  private async createXrayDetails(erm: ERM, count: number): Promise<number> {
    for (let i = 0; i < count; i++) {
      const xray = this.ermXrayRepository.create({
        ermId: erm._id,
        region: getRandomItem(XRAY_REGIONS),
        projection: getRandomItem(XRAY_PROJECTIONS),
        indication: getRandomItem(['Trauma evaluation', 'Chronic pain', 'Follow-up examination', 'Arthritis assessment']),
        technique: 'Standard radiographic technique utilized. Adequate penetration and positioning achieved.',
        findings: getRandomItem(XRAY_FINDINGS),
        osteoarthritisGrade: getRandomItem(OSTEOARTHRITIS_GRADES),
        conclusion: getRandomItem(XRAY_CONCLUSIONS),
        recommendations: getRandomItem([
          'Clinical correlation recommended.',
          'Consider MRI for soft tissue evaluation.',
          'Follow-up imaging in 6-8 weeks if symptoms persist.',
          'Physical therapy consultation advised.',
        ]),
        imageUrls: JSON.stringify([
          `https://example.com/xray/${erm._id}_view1.jpg`,
          `https://example.com/xray/${erm._id}_view2.jpg`,
        ]),
        createdAt: erm.createdAt,
      });

      await this.ermXrayRepository.save(xray);
    }
    return count;
  }

  /**
   * Create ultrasound detail records
   */
  private async createUltrasoundDetails(erm: ERM, count: number): Promise<number> {
    for (let i = 0; i < count; i++) {
      const ultrasound = this.ermUltrasoundRepository.create({
        ermId: erm._id,
        serviceCode: getRandomItem(SERVICE_CODES),
        indication: getRandomItem(['Tendon pathology evaluation', 'Soft tissue mass assessment', 'Joint effusion evaluation', 'Guidance for injection']),
        bodySite: getRandomItem(ULTRASOUND_BODY_SITES),
        side: getSequentialItem(BODY_SIDES, 'bodySideUltrasound') as BodySide,
        technique: 'High-frequency linear array transducer utilized. Multiple planes of imaging obtained.',
        findings: getRandomItem(ULTRASOUND_FINDINGS),
        measurements: JSON.stringify({
          tendon_thickness: `${(Math.random() * 3 + 4).toFixed(1)} mm`,
          effusion_depth: `${(Math.random() * 8 + 2).toFixed(1)} mm`,
        }),
        conclusion: getRandomItem(ULTRASOUND_CONCLUSIONS),
        recommendations: getRandomItem([
          'Recommend orthopedic consultation.',
          'Continue conservative management.',
          'Consider MRI if symptoms progress.',
          'Repeat ultrasound in 6 weeks if no improvement.',
        ]),
        imageUrls: JSON.stringify([
          `https://example.com/ultrasound/${erm._id}_longitudinal.jpg`,
          `https://example.com/ultrasound/${erm._id}_transverse.jpg`,
        ]),
        createdAt: erm.createdAt,
      });

      await this.ermUltrasoundRepository.save(ultrasound);
    }
    return count;
  }

  /**
   * Create lab detail records
   */
  private async createLabDetails(erm: ERM, count: number): Promise<number> {
    for (let i = 0; i < count; i++) {
      // Base calculation logically from the parent erm.createdAt
      const baseTime = erm.createdAt.getTime();
      const collectedAt = new Date(baseTime - getRandomInt(1, 3) * 24 * 60 * 60 * 1000);
      const receivedAt = new Date(collectedAt.getTime() + getRandomInt(30, 120) * 60 * 1000);
      const reportedAt = new Date(receivedAt.getTime() + getRandomInt(2, 8) * 60 * 60 * 1000);

      const panelName = getSequentialItem(LAB_PANEL_NAMES, 'panelName') as PanelName;
      const abnormalSummary = Math.random() > 0.6; // 40% chance of normal results

      let results: any;
      switch (panelName) {
        case PanelName.INFLAMMATION:
          results = {
            'ESR (Erythrocyte Sedimentation Rate)': {
              value: abnormalSummary ? getRandomInt(25, 60) : getRandomInt(0, 20),
              unit: 'mm/hr',
              reference_range: '0-20',
              flag: abnormalSummary ? 'HIGH' : 'NORMAL',
            },
            'CRP (C-Reactive Protein)': {
              value: abnormalSummary ? (Math.random() * 30 + 10).toFixed(1) : (Math.random() * 3).toFixed(1),
              unit: 'mg/L',
              reference_range: '0-3',
              flag: abnormalSummary ? 'HIGH' : 'NORMAL',
            },
          };
          break;
        case PanelName.GOUT:
          results = {
            'Uric Acid': {
              value: abnormalSummary ? (Math.random() * 3 + 7).toFixed(1) : (Math.random() * 2 + 3).toFixed(1),
              unit: 'mg/dL',
              reference_range: '3.5-7.0',
              flag: abnormalSummary ? 'HIGH' : 'NORMAL',
            },
          };
          break;
        case PanelName.METABOLIC:
          results = {
            Calcium: {
              value: (Math.random() * 1 + 8.5).toFixed(1),
              unit: 'mg/dL',
              reference_range: '8.5-10.5',
              flag: 'NORMAL',
            },
            'Vitamin D (25-OH)': {
              value: abnormalSummary ? getRandomInt(10, 25) : getRandomInt(30, 50),
              unit: 'ng/mL',
              reference_range: '30-100',
              flag: abnormalSummary ? 'LOW' : 'NORMAL',
            },
          };
          break;
        case PanelName.AUTOIMMUNE:
          results = {
            'Rheumatoid Factor': {
              value: abnormalSummary ? getRandomInt(20, 100) : getRandomInt(0, 14),
              unit: 'IU/mL',
              reference_range: '0-14',
              flag: abnormalSummary ? 'HIGH' : 'NORMAL',
            },
            'Anti-CCP': {
              value: abnormalSummary ? getRandomInt(25, 150) : getRandomInt(0, 17),
              unit: 'U/mL',
              reference_range: '0-17',
              flag: abnormalSummary ? 'HIGH' : 'NORMAL',
            },
          };
          break;
      }

      const lab = this.ermLabRepository.create({
        ermId: erm._id,
        panelName,
        specimenType: getRandomItem(SPECIMEN_TYPES),
        collectedAt,
        receivedAt,
        reportedAt,
        results,
        abnormalSummary,
        conclusion: getRandomItem(LAB_CONCLUSIONS),
        recommendations: getRandomItem(LAB_RECOMMENDATIONS),
        createdAt: erm.createdAt,
      });

      await this.ermLabRepository.save(lab);
    }
    return count;
  }

  /**
   * Create bone density detail records
   */
  private async createBoneDensityDetails(erm: ERM, count: number): Promise<number> {
    for (let i = 0; i < count; i++) {
      const tScore = (Math.random() * 5 - 3).toFixed(1); // Range from -3 to +2
      const tScoreNum = parseFloat(tScore);
      
      let whoCategory: WHOCategory;
      if (tScoreNum >= -1.0) {
        whoCategory = WHOCategory.NORMAL;
      } else if (tScoreNum >= -2.5) {
        whoCategory = WHOCategory.OSTEOPENIA;
      } else {
        whoCategory = WHOCategory.OSTEOPOROSIS;
      }

      const boneDensity = this.ermBoneDensityRepository.create({
        ermId: erm._id,
        site: getSequentialItem(BONE_DENSITY_SITES, 'boneSite') as BoneSite,
        bmdValue: (Math.random() * 0.3 + 0.7).toFixed(3),
        bmdUnit: 'g/cm²',
        tScore: parseFloat(tScore),
        zScore: parseFloat((Math.random() * 4 - 2).toFixed(2)),
        whoCategory,
        fractureRiskComment: getRandomItem(FRACTURE_RISK_COMMENTS),
        recommendations: getRandomItem(BONE_DENSITY_RECOMMENDATIONS),
        createdAt: erm.createdAt,
      });

      await this.ermBoneDensityRepository.save(boneDensity);
    }
    return count;
  }

  /**
   * Create procedure detail records
   */
  private async createProcedureDetails(erm: ERM, count: number): Promise<number> {
    for (let i = 0; i < count; i++) {
      const baseTime = erm.createdAt.getTime();
      const performedStart = new Date(baseTime - getRandomInt(1, 48) * 60 * 60 * 1000);
      const performedEnd = new Date(performedStart.getTime() + getRandomInt(15, 45) * 60 * 1000);

      const procedure = this.ermProcedureRepository.create({
        ermId: erm._id,
        procedureCode: `PROC-${getRandomInt(100, 999)}`,
        indication: getRandomItem(['Therapeutic injection', 'Diagnostic aspiration', 'Pain management', 'Joint evaluation']),
        bodySite: getRandomItem(PROCEDURE_BODY_SITES),
        side: getSequentialItem(BODY_SIDES, 'bodySideProcedure') as BodySide,
        anesthesiaType: getRandomItem(ANESTHESIA_TYPES),
        performedStart,
        performedEnd,
        medications: JSON.stringify([
          {
            name: 'Triamcinolone acetonide',
            dose: '40 mg',
            route: 'Intra-articular',
          },
          {
            name: 'Lidocaine',
            dose: '1%',
            volume: '2 mL',
          },
        ]),
        devices: '22-gauge needle, sterile technique',
        description: getRandomItem(PROCEDURE_DESCRIPTIONS),
        painScoreBefore: getRandomInt(6, 9),
        painScoreAfter: getRandomInt(2, 5),
        immediateOutcome: getSequentialItem(IMMEDIATE_OUTCOMES, 'immediateOutcome') as ImmediateOutcome,
        complications: JSON.stringify({
          bleeding: false,
          infection: false,
          nerve_injury: false,
          vasovagal_reaction: false,
        }),
        postCareInstructions: getRandomItem(POST_CARE_INSTRUCTIONS),
        followUpPlan: getRandomItem(FOLLOW_UP_PLANS),
        createdAt: erm.createdAt,
      });

      await this.ermProcedureRepository.save(procedure);
    }
    return count;
  }
  /**
   * Get all ERMs (for validation purposes)
   *
   * @returns Array of all ERM records
   */
  async getAllERMs(): Promise<ERM[]> {
    return this.ermRepository.find({
      relations: ['serviceAppointment', 'appointment'],
    });
  }

  /**
   * Validate ERM data integrity
   *
   * Checks:
   * - All ERMs have valid status (COMPLETED)
   * - All ERMs reference valid appointments
   * - All ERMs reference valid service appointments
   * - Each ERM has corresponding detail records
   *
   * @returns Validation result with any errors found
   */
  async validateERMs(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    const erms = await this.getAllERMs();

    for (const erm of erms) {
      // Check status
      if (!VALID_ERM_STATUSES.includes(erm.status as ERMStatus)) {
        errors.push(
          `ERM ${erm._id} has invalid status: ${erm.status}. Must be COMPLETED.`,
        );
      }

      // Check appointment exists
      if (!erm.appointment) {
        errors.push(`ERM ${erm._id} references non-existent appointment: ${erm.appointmentId}`);
      } else if (erm.appointment.status !== 'COMPLETED') {
        errors.push(
          `ERM ${erm._id} references appointment ${erm.appointmentId} with status ${erm.appointment.status}. Must be COMPLETED.`,
        );
      }

      // Check service appointment exists
      if (!erm.serviceAppointment) {
        errors.push(
          `ERM ${erm._id} references non-existent service appointment: ${erm.serviceAppointmentsId}`,
        );
      }

      // Check detail records exist
      const hasDetails = await this.checkERMHasDetails(erm);
      if (!hasDetails) {
        errors.push(
          `ERM ${erm._id} with record type ${erm.recordType} has no detail records.`,
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check if an ERM has detail records based on its record type
   *
   * @param erm - The ERM to check
   * @returns True if detail records exist, false otherwise
   */
  private async checkERMHasDetails(erm: ERM): Promise<boolean> {
    switch (erm.recordType) {
      case ERMRecordType.CONSULTATION:
        const consultationCount = await this.ermConsultationRepository.count({
          where: { ermId: erm._id },
        });
        return consultationCount > 0;
      case ERMRecordType.XRAY:
        const xrayCount = await this.ermXrayRepository.count({
          where: { ermId: erm._id },
        });
        return xrayCount > 0;
      case ERMRecordType.ULTRASOUND:
        const ultrasoundCount = await this.ermUltrasoundRepository.count({
          where: { ermId: erm._id },
        });
        return ultrasoundCount > 0;
      case ERMRecordType.LAB:
        const labCount = await this.ermLabRepository.count({
          where: { ermId: erm._id },
        });
        return labCount > 0;
      case ERMRecordType.BONE_DENSITY:
        const boneDensityCount = await this.ermBoneDensityRepository.count({
          where: { ermId: erm._id },
        });
        return boneDensityCount > 0;
      case ERMRecordType.PROCEDURE:
        const procedureCount = await this.ermProcedureRepository.count({
          where: { ermId: erm._id },
        });
        return procedureCount > 0;
      default:
        return false;
    }
  }
}
