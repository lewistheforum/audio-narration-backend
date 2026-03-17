import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ErmRepository } from './repositories/erm.repository';
import { 
  InitializeErmDto, 
  ErmResponseDto, 
  SaveErmDataDto, 
  SaveErmResponseDto,
  DoctorERMDetailResponseDto,
  ConsultationDataDto,
  XrayDataDto,
  UltrasoundDataDto,
  LabDataDto,
  ProcedureDataDto,
  BoneDensityDataDto,
} from './dto';
import { ConsultationFormTemplateDto } from './dto/consultation-form-template.dto';
import { XrayFormTemplateDto } from './dto/xray-form-template.dto';
import { UltrasoundFormTemplateDto } from './dto/ultrasound-form-template.dto';
import { LabFormTemplateDto } from './dto/lab-form-template.dto';
import { ProcedureFormTemplateDto } from './dto/procedure-form-template.dto';
import { BoneDensityFormTemplateDto } from './dto/bone-density-form-template.dto';
import { ERMRecordType, ERMStatus } from './enums';
import { ServiceAppointment } from '../appointments/entities/service-appointment.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { MESSAGES } from '../../common/message';

/**
 * ERM Service
 * 
 * Handles business logic for ERM (Electronic Medical Records) management
 * Supports all 6 ERM record types: CONSULTATION, XRAY, ULTRASOUND, LAB, PROCEDURE, BONE_DENSITY
 * 
 * ERM Workflow:
 * - Step 3: Initialize ERM (initializeErm)
 * - Step 4: Get Form Template (getFormTemplate)
 * - Step 5: Save ERM Data (saveErmData)
 */
@Injectable()
export class ErmsService {
  constructor(
    private readonly ermRepository: ErmRepository,
    private readonly dataSource: DataSource,
  ) { }

  /**
   * Initialize ERM (Step 3 - ERM Flow)
   *
   * Creates a new ERM record with status = DRAFT for a service appointment
   *
   * @param initializeErmDto - Request data (serviceAppointmentId, appointmentId)
   * @param doctorId - ID of the authenticated doctor
   * @returns Created ERM record
   * @throws NotFoundException if service appointment or appointment not found
   * @throws ConflictException if ERM already exists for this service appointment
   * @throws BadRequestException if service appointment doesn't belong to appointment
   *
   * Business Rules:
   * - Verify appointment and service appointment exist
   * - Verify service appointment belongs to the appointment
   * - Verify doctor is assigned to the appointment
   * - Check that service appointment doesn't already have an ERM (OneToOne)
   * - Get record_type from service_functions
   * - Get service_code from clinic_service
   * - Create ERM with status = DRAFT
   * - Set created_by = doctor_id
   */
  async initializeErm(
    initializeErmDto: InitializeErmDto,
    doctorId: string,
  ): Promise<ErmResponseDto> {
    const { serviceAppointmentId, appointmentId } = initializeErmDto;

    // Find appointment
    const appointment = await this.dataSource
      .getRepository(Appointment)
      .createQueryBuilder('appointment')
      .where('appointment._id = :appointmentId', { appointmentId })
      .andWhere('appointment.deleted_at IS NULL')
      .getOne();

    if (!appointment) {
      throw new NotFoundException(MESSAGES.failMessage.appointmentNotFound);
    }

    // Verify doctor is assigned to this appointment
    if (appointment.doctorId !== doctorId) {
      throw new BadRequestException(
        'This appointment is not assigned to you',
      );
    }

    // Find service appointment with relations
    const serviceAppointment = await this.dataSource
      .getRepository(ServiceAppointment)
      .createQueryBuilder('sa')
      .leftJoinAndSelect('sa.clinicService', 'clinicServiceConfig')
      .leftJoinAndSelect('clinicServiceConfig.service', 'clinicService')
      .leftJoinAndSelect('clinicService.category', 'clinicServiceCategory')
      .leftJoinAndSelect('sa.appointmentPackage', 'appointmentPackage')
      .leftJoinAndSelect('sa.erm', 'erm')
      .where('sa._id = :serviceAppointmentId', { serviceAppointmentId })
      .andWhere('sa.deleted_at IS NULL')
      .getOne();

    if (!serviceAppointment) {
      throw new NotFoundException('Service appointment not found');
    }

    // Verify service appointment belongs to the appointment
    if (serviceAppointment.appointmentPackage?.appointmentId !== appointmentId) {
      throw new BadRequestException(
        'Service appointment does not belong to this appointment',
      );
    }

    // Check if ERM already exists for this service appointment
    if (serviceAppointment.erm) {
      throw new ConflictException(
        'ERM already exists for this service appointment',
      );
    }

    // Determine record type
    let recordType: ERMRecordType = ERMRecordType.CONSULTATION; // Default

    const serviceCategoryType =
      serviceAppointment.clinicService?.service?.category?.type;

    if (
      serviceCategoryType &&
      Object.values(ERMRecordType).includes(
        serviceCategoryType as unknown as ERMRecordType,
      )
    ) {
      recordType = serviceCategoryType as unknown as ERMRecordType;
    } else {
      // Fallback to old behavior if category type isn't available
      const serviceFunctions =
        serviceAppointment.clinicService?.service?.serviceFunctions || [];
      if (serviceFunctions.length > 0) {
        const matchedType = serviceFunctions.find((func) =>
          Object.values(ERMRecordType).includes(func as ERMRecordType),
        );
        if (matchedType) {
          recordType = matchedType as ERMRecordType;
        }
      }
    }

    // Get service code
    const serviceCode =
      serviceAppointment.clinicService?.service?.serviceCode || null;

    // Create ERM record
    const savedErm = await this.ermRepository.createErm({
      serviceAppointmentsId: serviceAppointmentId,
      appointmentId: appointmentId,
      recordType: recordType,
      serviceCode: serviceCode,
      status: ERMStatus.DRAFT,
      createdBy: doctorId,
    });

    // Return response
    return {
      ermId: savedErm._id,
      serviceAppointmentId: savedErm.serviceAppointmentsId,
      appointmentId: savedErm.appointmentId,
      recordType: savedErm.recordType,
      serviceCode: savedErm.serviceCode,
      status: savedErm.status,
      createdBy: savedErm.createdBy,
      createdAt: savedErm.createdAt,
    };
  }

  /**
   * Get Form Template for ERM (Step 4 - ERM Flow)
   *
   * Returns form template/schema based on ERM record type
   * Includes current saved data if exists
   *
   * @param ermId - ERM ID
   * @param doctorId - ID of the authenticated doctor
   * @returns Form template DTO based on record type
   * @throws NotFoundException if ERM not found
   * @throws BadRequestException if doctor doesn't have permission
   *
   * Business Rules:
   * - Verify ERM exists
   * - Verify doctor created the ERM or is assigned to the appointment
   * - Return template based on record_type
   * - Include current saved data if exists (status = IN_PROGRESS)
   */
  async getFormTemplate(
    ermId: string,
    doctorId: string,
  ): Promise<
    | ConsultationFormTemplateDto
    | XrayFormTemplateDto
    | UltrasoundFormTemplateDto
    | LabFormTemplateDto
    | ProcedureFormTemplateDto
    | BoneDensityFormTemplateDto
  > {
    // Find ERM with relations
    const erm = await this.ermRepository.findErmWithAppointment(ermId);

    if (!erm) {
      throw new NotFoundException('ERM not found');
    }

    // Verify doctor has permission
    if (erm.createdBy !== doctorId && erm.appointment?.doctorId !== doctorId) {
      throw new BadRequestException('You do not have permission to access this ERM');
    }

    // Build template based on record type
    let template:
      | ConsultationFormTemplateDto
      | XrayFormTemplateDto
      | UltrasoundFormTemplateDto
      | LabFormTemplateDto
      | ProcedureFormTemplateDto
      | BoneDensityFormTemplateDto;

    switch (erm.recordType) {
      case ERMRecordType.CONSULTATION:
        const consultation = await this.ermRepository.findConsultationByErmId(ermId);

        template = {
          ermId: erm._id,
          recordType: erm.recordType,
          status: erm.status,
          fields: this.getConsultationFieldsTemplate(),
          currentData: consultation || null,
        };
        break;

      case ERMRecordType.XRAY:
        const xray = await this.ermRepository.findXrayByErmId(ermId);

        template = {
          ermId: erm._id,
          recordType: erm.recordType,
          status: erm.status,
          fields: this.getXrayFieldsTemplate(),
          currentData: xray || null,
        };
        break;

      case ERMRecordType.ULTRASOUND:
        const ultrasound = await this.ermRepository.findUltrasoundByErmId(ermId);

        template = {
          ermId: erm._id,
          recordType: erm.recordType,
          status: erm.status,
          fields: this.getUltrasoundFieldsTemplate(),
          currentData: ultrasound || null,
        };
        break;

      case ERMRecordType.LAB:
        const lab = await this.ermRepository.findLabByErmId(ermId);

        template = {
          ermId: erm._id,
          recordType: erm.recordType,
          status: erm.status,
          fields: this.getLabFieldsTemplate(),
          currentData: lab || null,
        };
        break;

      case ERMRecordType.PROCEDURE:
        const procedure = await this.ermRepository.findProcedureByErmId(ermId);

        template = {
          ermId: erm._id,
          recordType: erm.recordType,
          status: erm.status,
          fields: this.getProcedureFieldsTemplate(),
          currentData: procedure || null,
        };
        break;

      case ERMRecordType.BONE_DENSITY:
        const boneDensity = await this.ermRepository.findBoneDensityByErmId(ermId);

        template = {
          ermId: erm._id,
          recordType: erm.recordType,
          status: erm.status,
          fields: this.getBoneDensityFieldsTemplate(),
          currentData: boneDensity || null,
        };
        break;

      default:
        throw new BadRequestException(`Unknown record type: ${erm.recordType}`);
    }

    return template;
  }

  /**
   * Save ERM Data (Step 5 - ERM Flow)
   *
   * Saves or updates ERM detail data based on record type
   * Updates ERM status from DRAFT to IN_PROGRESS
   *
   * @param ermId - ERM ID
   * @param saveErmDataDto - Request data containing ERM details
   * @param doctorId - ID of the authenticated doctor
   * @returns Save response with updated ERM status
   * @throws NotFoundException if ERM not found
   * @throws BadRequestException if doctor doesn't have permission or ERM is completed
   *
   * Business Rules:
   * - Verify ERM exists
   * - Verify doctor created the ERM or is assigned to the appointment
   * - Cannot save if status = COMPLETED
   * - Update status from DRAFT → IN_PROGRESS on first save
   * - Allow multiple saves when status = IN_PROGRESS
   * - Insert or update data in detail table based on record_type
   * - Update updated_by = doctorId
   */
  async saveErmData(
    ermId: string,
    saveErmDataDto: SaveErmDataDto,
    doctorId: string,
  ): Promise<SaveErmResponseDto> {
    const { data } = saveErmDataDto;

    // Find ERM with relations
    const erm = await this.ermRepository.findErmWithAppointment(ermId);

    if (!erm) {
      throw new NotFoundException('ERM not found');
    }

    // Verify doctor has permission
    if (erm.createdBy !== doctorId && erm.appointment?.doctorId !== doctorId) {
      throw new BadRequestException('You do not have permission to modify this ERM');
    }

    // Check if ERM is completed
    if (erm.status === ERMStatus.COMPLETED) {
      throw new BadRequestException('Cannot modify completed ERM');
    }

    // Save data to detail table based on record type
    switch (erm.recordType) {
      case ERMRecordType.CONSULTATION:
        await this.ermRepository.saveConsultationData(ermId, data);
        break;

      case ERMRecordType.XRAY:
        await this.ermRepository.saveXrayData(ermId, data);
        break;

      case ERMRecordType.ULTRASOUND:
        await this.ermRepository.saveUltrasoundData(ermId, data);
        break;

      case ERMRecordType.LAB:
        await this.ermRepository.saveLabData(ermId, data);
        break;

      case ERMRecordType.PROCEDURE:
        await this.ermRepository.saveProcedureData(ermId, data);
        break;

      case ERMRecordType.BONE_DENSITY:
        await this.ermRepository.saveBoneDensityData(ermId, data);
        break;

      default:
        throw new BadRequestException(`Unknown record type: ${erm.recordType}`);
    }

    // Update ERM status to IN_PROGRESS if currently DRAFT
    if (erm.status === ERMStatus.DRAFT) {
      erm.status = ERMStatus.IN_PROGRESS;
    }

    // Save ERM (updatedAt will be set automatically by @UpdateDateColumn)
    const updatedErm = await this.ermRepository.saveErm(erm);

    return {
      ermId: updatedErm._id,
      status: updatedErm.status,
      updatedAt: updatedErm.updatedAt,
      message: 'ERM data saved successfully',
    };
  }

  // ============= Private Helper Methods =============

  /**
   * Helper: Get Consultation form fields template
   */
  private getConsultationFieldsTemplate() {
    return {
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
        label: 'Severity',
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
    };
  }

  /**
   * Helper: Get X-ray form fields template
   */
  private getXrayFieldsTemplate() {
    return {
      region: {
        type: 'text',
        required: false,
        label: 'Region (chest, knee, spine...)',
      },
      projection: {
        type: 'text',
        required: false,
        label: 'Projection (AP, Lateral, Oblique...)',
      },
      indication: {
        type: 'textarea',
        required: false,
        label: 'Indication',
      },
      technique: {
        type: 'textarea',
        required: false,
        label: 'Technique',
      },
      findings: {
        type: 'textarea',
        required: false,
        label: 'Findings',
      },
      osteoarthritisGrade: {
        type: 'text',
        required: false,
        label: 'Osteoarthritis Grade',
      },
      conclusion: {
        type: 'textarea',
        required: false,
        label: 'Conclusion',
      },
      recommendations: {
        type: 'textarea',
        required: false,
        label: 'Recommendations',
      },
      imageUrls: {
        type: 'array',
        required: false,
        label: 'Image URLs',
      },
    };
  }

  /**
   * Helper: Get Ultrasound form fields template
   */
  private getUltrasoundFieldsTemplate() {
    return {
      serviceCode: {
        type: 'text',
        required: false,
        label: 'Service Code',
      },
      indication: {
        type: 'textarea',
        required: false,
        label: 'Indication',
      },
      bodySite: {
        type: 'text',
        required: false,
        label: 'Ultrasound Site',
      },
      side: {
        type: 'enum',
        required: false,
        options: ['LEFT', 'RIGHT', 'BILATERAL'],
        label: 'Side (Left/Right/Bilateral)',
      },
      technique: {
        type: 'textarea',
        required: false,
        label: 'Technique',
      },
      findings: {
        type: 'textarea',
        required: false,
        label: 'Findings',
      },
      measurements: {
        type: 'json',
        required: false,
        label: 'Measurements',
      },
      conclusion: {
        type: 'textarea',
        required: false,
        label: 'Conclusion',
      },
      recommendations: {
        type: 'textarea',
        required: false,
        label: 'Recommendations',
      },
      imageUrls: {
        type: 'array',
        required: false,
        label: 'Image URLs',
      },
      performedAt: {
        type: 'datetime',
        required: false,
        label: 'Performed At',
      },
    };
  }

  /**
   * Helper: Get Lab form fields template
   */
  private getLabFieldsTemplate() {
    return {
      panelName: {
        type: 'enum',
        required: true,
        options: ['INFLAMMATION', 'GOUT', 'METABOLIC', 'AUTOIMMUNE'],
        label: 'Test Panel Name',
      },
      specimenType: {
        type: 'text',
        required: true,
        label: 'Specimen Type (blood, urine...)',
      },
      collectedAt: {
        type: 'datetime',
        required: true,
        label: 'Collection Time',
      },
      receivedAt: {
        type: 'datetime',
        required: true,
        label: 'Received Time',
      },
      reportedAt: {
        type: 'datetime',
        required: true,
        label: 'Report Time',
      },
      results: {
        type: 'json',
        required: true,
        label: 'Results',
        structure: {
          testName: {
            value: 'number',
            unit: 'text',
            referenceRange: 'text',
            isAbnormal: 'boolean',
          },
        },
      },
      abnormalSummary: {
        type: 'boolean',
        required: true,
        label: 'Any Abnormalities',
      },
      conclusion: {
        type: 'textarea',
        required: true,
        label: 'Conclusion',
      },
      recommendations: {
        type: 'textarea',
        required: true,
        label: 'Recommendations',
      },
    };
  }

  /**
   * Helper: Get Procedure form fields template
   */
  private getProcedureFieldsTemplate() {
    return {
      procedureCode: {
        type: 'text',
        required: false,
        label: 'Procedure Code',
      },
      indication: {
        type: 'textarea',
        required: false,
        label: 'Indication',
      },
      bodySite: {
        type: 'text',
        required: false,
        label: 'Procedure Site',
      },
      side: {
        type: 'enum',
        required: false,
        options: ['LEFT', 'RIGHT', 'BILATERAL'],
        label: 'Side (Left/Right/Bilateral)',
      },
      anesthesiaType: {
        type: 'text',
        required: false,
        label: 'Anesthesia Type',
      },
      performedStart: {
        type: 'datetime',
        required: false,
        label: 'Start Time',
      },
      performedEnd: {
        type: 'datetime',
        required: false,
        label: 'End Time',
      },
      medications: {
        type: 'json',
        required: false,
        label: 'Medications Used',
      },
      devices: {
        type: 'textarea',
        required: false,
        label: 'Devices Used',
      },
      description: {
        type: 'textarea',
        required: false,
        label: 'Procedure Description',
      },
      painScoreBefore: {
        type: 'number',
        required: false,
        min: 0,
        max: 10,
        label: 'Pain Score Before',
      },
      painScoreAfter: {
        type: 'number',
        required: false,
        min: 0,
        max: 10,
        label: 'Pain Score After',
      },
      immediateOutcome: {
        type: 'enum',
        required: false,
        options: ['GOOD', 'FAIR', 'POOR'],
        label: 'Immediate Outcome',
      },
      complications: {
        type: 'json',
        required: false,
        label: 'Complications',
      },
      postCareInstructions: {
        type: 'textarea',
        required: false,
        label: 'Post-Care Instructions',
      },
      followUpPlan: {
        type: 'textarea',
        required: false,
        label: 'Follow-up Plan',
      },
    };
  }

  /**
   * Helper: Get Bone Density form fields template
   */
  private getBoneDensityFieldsTemplate() {
    return {
      site: {
        type: 'enum',
        required: true,
        options: ['LUMBAR_SPINE', 'TOTAL_HIP', 'FEMORAL_NECK', 'FOREARM'],
        label: 'Measurement Site',
      },
      bmdValue: {
        type: 'text',
        required: false,
        label: 'BMD Value',
      },
      bmdUnit: {
        type: 'text',
        required: false,
        label: 'Unit (g/cm²)',
      },
      tScore: {
        type: 'number',
        required: false,
        label: 'T-score',
      },
      zScore: {
        type: 'number',
        required: false,
        label: 'Z-score',
      },
      whoCategory: {
        type: 'enum',
        required: false,
        options: ['NORMAL', 'OSTEOPENIA', 'OSTEOPOROSIS'],
        label: 'WHO Category',
      },
      fractureRiskComment: {
        type: 'textarea',
        required: false,
        label: 'Fracture Risk Comment',
      },
      recommendations: {
        type: 'textarea',
        required: false,
        label: 'Recommendations',
      },
    };
  }

  /**
   * Get Doctor ERM Detail (Step 4 - Doctor Patient History)
   *
   * Returns detailed ERM data for doctor to view patient's medical records
   *
   * @param ermId - ERM UUID
   * @param doctorId - Authenticated doctor ID
   * @returns Detailed ERM response based on record_type
   * @throws NotFoundException if ERM not found
   * @throws ForbiddenException if doctor doesn't have access
   *
   * Business Rules:
   * - Verify ERM exists
   * - Verify ERM belongs to appointment with this doctor
   * - Return data based on record_type (CONSULTATION, XRAY, ULTRASOUND, LAB, PROCEDURE, BONE_DENSITY)
   * - Include creator information
   */
  async getDoctorERMDetail(
    ermId: string,
    doctorId: string,
  ): Promise<DoctorERMDetailResponseDto> {
    // Find ERM with appointment relation
    const erm = await this.ermRepository.findErmWithAppointment(ermId);

    if (!erm) {
      throw new NotFoundException('ERM not found');
    }

    // Verify doctor has access (appointment must belong to this doctor)
    if (!erm.appointment || erm.appointment.doctorId !== doctorId) {
      throw new ForbiddenException('You do not have access to this ERM');
    }

    // Get service name from service appointment
    const serviceAppointment = await this.dataSource
      .getRepository(ServiceAppointment)
      .createQueryBuilder('sa')
      .leftJoinAndSelect('sa.clinicService', 'clinicServiceConfig')
      .leftJoinAndSelect('clinicServiceConfig.service', 'clinicService')
      .where('sa._id = :serviceAppointmentId', {
        serviceAppointmentId: erm.serviceAppointmentsId,
      })
      .getOne();

    const serviceName = serviceAppointment?.clinicService?.service?.serviceName || null;

    // Get creator name
    const creator = await this.dataSource.query(
      `
      SELECT ga.full_name as creator_name
      FROM general_accounts ga
      WHERE ga._id = $1
      `,
      [erm.createdBy],
    );
    const creatorName = creator[0]?.creator_name || 'Unknown';

    // Base response
    const baseResponse = {
      erm_id: erm._id,
      service_appointment_id: erm.serviceAppointmentsId,
      appointment_id: erm.appointmentId,
      record_type: erm.recordType,
      service_code: erm.serviceCode || null,
      service_name: serviceName,
      status: erm.status,
      created_at: erm.createdAt,
      updated_at: erm.updatedAt || null,
      created_by: erm.createdBy,
      created_by_name: creatorName,
      consultation_data: null,
      xray_data: null,
      ultrasound_data: null,
      lab_data: null,
      procedure_data: null,
      bone_density_data: null,
    };

    // Get detailed data based on record_type
    switch (erm.recordType) {
      case ERMRecordType.CONSULTATION: {
        const consultation = await this.ermRepository.findConsultationByErmId(ermId);
        if (consultation) {
          baseResponse.consultation_data = {
            visit_type: consultation.visitType,
            main_service_code: consultation.mainServiceCode || null,
            chief_complaint: consultation.chiefComplaint || null,
            onset_duration: consultation.onsetDuration || null,
            pain_location: consultation.painLocation || null,
            pain_character: consultation.painCharacter || null,
            pain_intensity: consultation.painIntensity || null,
            aggravating_factors: consultation.aggravatingFactors || null,
            relieving_factors: consultation.relievingFactors || null,
            functional_limitations: consultation.functionalLimitations || null,
            pastMsk_history: consultation.pastMskHistory || null,
            pastMedical_history: consultation.pastMedicalHistory || null,
            medication_history: consultation.medicationHistory || null,
            family_history: consultation.familyHistory || null,
            red_flags: consultation.redFlags || null,
            vital_signs: consultation.vitalSigns || null,
            inspection_findings: consultation.inspectionFindings || null,
            palpation_findings: consultation.palpationFindings || null,
            range_of_motion: consultation.rangeOfMotion || null,
            special_tests: consultation.specialTests || null,
            neuro_exam: consultation.neuroExam || null,
            gait_assessment: consultation.gaitAssessment || null,
            working_diagnosis: consultation.workingDiagnosis || null,
            severity: consultation.severity || null,
            comorbid_impact: consultation.comorbidImpact || null,
            risk_factors: consultation.riskFactors || null,
            physiotherapy_plan: consultation.physiotherapyPlan || null,
            education_advice: consultation.educationAdvice || null,
            follow_up_date: consultation.followUpDate || null,
            follow_up_condition: consultation.followUpCondition || null,
          } as ConsultationDataDto;
        }
        break;
      }

      case ERMRecordType.XRAY: {
        const xray = await this.ermRepository.findXrayByErmId(ermId);
        if (xray) {
          baseResponse.xray_data = {
            region: xray.region || null,
            projection: xray.projection || null,
            indication: xray.indication || null,
            technique: xray.technique || null,
            findings: xray.findings || null,
            osteoarthritis_grade: xray.osteoarthritisGrade || null,
            conclusion: xray.conclusion || null,
            recommendations: xray.recommendations || null,
            image_urls: xray.imageUrls || null,
          } as XrayDataDto;
        }
        break;
      }

      case ERMRecordType.ULTRASOUND: {
        const ultrasound = await this.ermRepository.findUltrasoundByErmId(ermId);
        if (ultrasound) {
          baseResponse.ultrasound_data = {
            service_code: ultrasound.serviceCode || null,
            indication: ultrasound.indication || null,
            body_site: ultrasound.bodySite || null,
            side: ultrasound.side || null,
            technique: ultrasound.technique || null,
            findings: ultrasound.findings || null,
            measurements: ultrasound.measurements || null,
            conclusion: ultrasound.conclusion || null,
            recommendations: ultrasound.recommendations || null,
            image_urls: ultrasound.imageUrls || null,
            performed_at: ultrasound.performedAt,
          } as UltrasoundDataDto;
        }
        break;
      }

      case ERMRecordType.LAB: {
        const lab = await this.ermRepository.findLabByErmId(ermId);
        if (lab) {
          baseResponse.lab_data = {
            panel_name: lab.panelName,
            specimen_type: lab.specimenType,
            collected_at: lab.collectedAt,
            received_at: lab.receivedAt,
            reported_at: lab.reportedAt,
            results: lab.results,
            abnormal_summary: lab.abnormalSummary,
            conclusion: lab.conclusion,
            recommendations: lab.recommendations,
          } as LabDataDto;
        }
        break;
      }

      case ERMRecordType.PROCEDURE: {
        const procedure = await this.ermRepository.findProcedureByErmId(ermId);
        if (procedure) {
          baseResponse.procedure_data = {
            procedure_code: procedure.procedureCode || null,
            indication: procedure.indication || null,
            body_site: procedure.bodySite || null,
            side: procedure.side || null,
            anesthesia_type: procedure.anesthesiaType || null,
            performed_start: procedure.performedStart || null,
            performed_end: procedure.performedEnd || null,
            medications: procedure.medications || null,
            devices: procedure.devices || null,
            description: procedure.description || null,
            pain_score_before: procedure.painScoreBefore || null,
            pain_score_after: procedure.painScoreAfter || null,
            immediate_outcome: procedure.immediateOutcome || null,
            complications: procedure.complications || null,
            post_care_instructions: procedure.postCareInstructions || null,
            follow_up_plan: procedure.followUpPlan || null,
          } as ProcedureDataDto;
        }
        break;
      }

      case ERMRecordType.BONE_DENSITY: {
        const boneDensity = await this.ermRepository.findBoneDensityByErmId(ermId);
        if (boneDensity) {
          baseResponse.bone_density_data = {
            site: boneDensity.site,
            bmd_value: boneDensity.bmdValue || null,
            bmd_unit: boneDensity.bmdUnit || null,
            t_score: boneDensity.tScore || null,
            z_score: boneDensity.zScore || null,
            who_category: boneDensity.whoCategory || null,
            fracture_risk_comment: boneDensity.fractureRiskComment || null,
            recommendations: boneDensity.recommendations || null,
          } as BoneDensityDataDto;
        }
        break;
      }
    }

    return baseResponse as DoctorERMDetailResponseDto;
  }
}
