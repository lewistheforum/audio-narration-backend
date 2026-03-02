import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { DataSource, DeepPartial } from 'typeorm';
import { Medicine } from './entities/medicine.entity';
import { ERM } from './entities/erm.entity';
import { EPrescription } from './entities/e-prescription.entity';
import { DetailEPrescription } from './entities/detail-e-prescription.entity';
import { MedicineRepository } from './repositories';
import { CreateMedicineDto } from './dto/create-medicine.dto';
import { UpdateMedicineDto } from './dto/update-medicine.dto';
import { InitializeErmDto, ErmResponseDto, SaveErmDataDto, SaveErmResponseDto, CreatePrescriptionDto, PrescriptionResponseDto, PrescriptionMedicineDetailDto } from './dto';
import { ConsultationFormTemplateDto } from './dto/consultation-form-template.dto';
import { XrayFormTemplateDto } from './dto/xray-form-template.dto';
import { UltrasoundFormTemplateDto } from './dto/ultrasound-form-template.dto';
import { LabFormTemplateDto } from './dto/lab-form-template.dto';
import { ProcedureFormTemplateDto } from './dto/procedure-form-template.dto';
import { BoneDensityFormTemplateDto } from './dto/bone-density-form-template.dto';
import { ERMRecordType, ERMStatus } from './enums';
import { ServiceAppointment } from '../appointments/entities/service-appointment.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { ERMConsultation } from './entities/erm-consultation.entity';
import { ERMXray } from './entities/erm-xray.entity';
import { ERMUltrasound } from './entities/erm-ultrasound.entity';
import { ERMLab } from './entities/erm-lab.entity';
import { ERMProcedure } from './entities/erm-procedure.entity';
import { ERMBoneDensity } from './entities/erm-bone-density.entity';
import { MESSAGES } from '../../common/message';

/**
 * Medicine Service
 * 
 * Handles business logic for medicine management and ERM
 * Supports ERM (Electronic Medical Records) and E-Prescriptions
 */
@Injectable()
export class PrescriptionsService {
  constructor(
    private readonly medicineRepository: MedicineRepository,
    private readonly dataSource: DataSource,
  ) { }

  /**
   * Create a new medicine record
   */
  async create(createMedicineDto: CreateMedicineDto): Promise<Medicine> {
    return await this.medicineRepository.createMedicine(createMedicineDto);
  }

  /**
   * Find all medicines (with soft-deleted excluded by default)
   */
  async findAll(): Promise<Medicine[]> {
    return await this.medicineRepository.findAllMedicines();
  }

  /**
   * Find medicine by ID
   */
  async findOne(id: string): Promise<Medicine> {
    return await this.medicineRepository.findMedicineById(id);
  }

  /**
   * Search medicines by name (partial match)
   */
  async searchByName(name: string): Promise<Medicine[]> {
    return await this.medicineRepository.searchMedicinesByName(name);
  }

  /**
   * Find medicines by therapeutic class
   */
  async findByTherapeuticClass(therapeuticClass: string): Promise<Medicine[]> {
    return await this.medicineRepository.findMedicinesByTherapeuticClass(
      therapeuticClass,
    );
  }

  /**
   * Find habit-forming medicines (controlled substances)
   */
  async findHabitForming(): Promise<Medicine[]> {
    return await this.medicineRepository.findHabitFormingMedicines();
  }

  /**
   * Update medicine record
   */
  async update(id: string, updateMedicineDto: UpdateMedicineDto): Promise<Medicine> {
    return await this.medicineRepository.updateMedicine(id, updateMedicineDto);
  }

  /**
   * Soft delete medicine record
   */
  async remove(id: string): Promise<void> {
    await this.medicineRepository.softDeleteMedicine(id);
  }

  /**
   * Restore soft-deleted medicine
   */
  async restore(id: string): Promise<void> {
    await this.medicineRepository.restoreMedicine(id);
  }

  /**
   * Permanently delete medicine record
   */
  async permanentDelete(id: string): Promise<void> {
    await this.medicineRepository.hardDeleteMedicine(id);
  }

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

    // Determine record type from service_functions
    const serviceFunctions =
      serviceAppointment.clinicService?.service?.serviceFunctions || [];
    let recordType: ERMRecordType = ERMRecordType.CONSULTATION; // Default

    // Try to match ERMRecordType from service_functions
    if (serviceFunctions.length > 0) {
      const matchedType = serviceFunctions.find((func) =>
        Object.values(ERMRecordType).includes(func as ERMRecordType),
      );
      if (matchedType) {
        recordType = matchedType as ERMRecordType;
      }
    }

    // Get service code
    const serviceCode =
      serviceAppointment.clinicService?.service?.serviceCode || null;

    // Create ERM record
    const erm = this.dataSource.getRepository(ERM).create({
      serviceAppointmentsId: serviceAppointmentId,
      appointmentId: appointmentId,
      recordType: recordType,
      serviceCode: serviceCode,
      status: ERMStatus.DRAFT,
      createdBy: doctorId,
    });

    const savedErm = await this.dataSource.getRepository(ERM).save(erm);

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
    const erm = await this.dataSource
      .getRepository(ERM)
      .createQueryBuilder('erm')
      .leftJoinAndSelect('erm.appointment', 'appointment')
      .where('erm._id = :ermId', { ermId })
      .andWhere('erm.deleted_at IS NULL')
      .getOne();

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
        const consultation = await this.dataSource
          .getRepository(ERMConsultation)
          .findOne({ where: { ermId } });

        template = {
          ermId: erm._id,
          recordType: erm.recordType,
          status: erm.status,
          fields: this.getConsultationFieldsTemplate(),
          currentData: consultation || null,
        };
        break;

      case ERMRecordType.XRAY:
        const xray = await this.dataSource
          .getRepository(ERMXray)
          .findOne({ where: { ermId } });

        template = {
          ermId: erm._id,
          recordType: erm.recordType,
          status: erm.status,
          fields: this.getXrayFieldsTemplate(),
          currentData: xray || null,
        };
        break;

      case ERMRecordType.ULTRASOUND:
        const ultrasound = await this.dataSource
          .getRepository(ERMUltrasound)
          .findOne({ where: { ermId } });

        template = {
          ermId: erm._id,
          recordType: erm.recordType,
          status: erm.status,
          fields: this.getUltrasoundFieldsTemplate(),
          currentData: ultrasound || null,
        };
        break;

      case ERMRecordType.LAB:
        const lab = await this.dataSource
          .getRepository(ERMLab)
          .findOne({ where: { ermId } });

        template = {
          ermId: erm._id,
          recordType: erm.recordType,
          status: erm.status,
          fields: this.getLabFieldsTemplate(),
          currentData: lab || null,
        };
        break;

      case ERMRecordType.PROCEDURE:
        const procedure = await this.dataSource
          .getRepository(ERMProcedure)
          .findOne({ where: { ermId } });

        template = {
          ermId: erm._id,
          recordType: erm.recordType,
          status: erm.status,
          fields: this.getProcedureFieldsTemplate(),
          currentData: procedure || null,
        };
        break;

      case ERMRecordType.BONE_DENSITY:
        const boneDensity = await this.dataSource
          .getRepository(ERMBoneDensity)
          .findOne({ where: { ermId } });

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
   * Helper: Get Consultation form fields template
   */
  private getConsultationFieldsTemplate() {
    return {
      visitType: {
        type: 'enum',
        required: true,
        options: ['FIRST_VISIT', 'FOLLOW_UP', 'POST_PROCEDURE', 'ROUTINE', 'ONLINE', 'EMERGENCY'],
        label: 'Loại khám',
      },
      mainServiceCode: {
        type: 'text',
        required: false,
        label: 'Mã dịch vụ chính',
      },
      chiefComplaint: {
        type: 'textarea',
        required: false,
        label: 'Lý do khám chính',
        section: 'Thông tin khám',
      },
      onsetDuration: {
        type: 'text',
        required: false,
        label: 'Thời gian khởi phát',
        section: 'Thông tin khám',
      },
      painLocation: {
        type: 'text',
        required: false,
        label: 'Vị trí đau',
        section: 'Thông tin khám',
      },
      painCharacter: {
        type: 'text',
        required: false,
        label: 'Đặc điểm đau',
        section: 'Thông tin khám',
      },
      painIntensity: {
        type: 'number',
        required: false,
        min: 0,
        max: 10,
        label: 'Mức độ đau (0-10)',
        section: 'Thông tin khám',
      },
      aggravatingFactors: {
        type: 'textarea',
        required: false,
        label: 'Yếu tố làm nặng',
        section: 'Thông tin khám',
      },
      relievingFactors: {
        type: 'textarea',
        required: false,
        label: 'Yếu tố làm giảm',
        section: 'Thông tin khám',
      },
      functionalLimitations: {
        type: 'textarea',
        required: false,
        label: 'Hạn chế chức năng',
        section: 'Thông tin khám',
      },
      pastMskHistory: {
        type: 'textarea',
        required: false,
        label: 'Tiền sử cơ xương khớp',
        section: 'Tiền sử',
      },
      pastMedicalHistory: {
        type: 'textarea',
        required: false,
        label: 'Tiền sử bệnh',
        section: 'Tiền sử',
      },
      medicationHistory: {
        type: 'textarea',
        required: false,
        label: 'Tiền sử dùng thuốc',
        section: 'Tiền sử',
      },
      familyHistory: {
        type: 'textarea',
        required: false,
        label: 'Tiền sử gia đình',
        section: 'Tiền sử',
      },
      redFlags: {
        type: 'json',
        required: false,
        label: 'Dấu hiệu cảnh báo',
        section: 'Tiền sử',
      },
      vitalSigns: {
        type: 'json',
        required: false,
        label: 'Sinh hiệu',
        section: 'Khám lâm sàng',
        fields: {
          bloodPressure: 'Huyết áp',
          heartRate: 'Nhịp tim',
          temperature: 'Nhiệt độ',
          respiratoryRate: 'Nhịp thở',
        },
      },
      inspectionFindings: {
        type: 'textarea',
        required: false,
        label: 'Kết quả quan sát',
        section: 'Khám lâm sàng',
      },
      palpationFindings: {
        type: 'textarea',
        required: false,
        label: 'Kết quả sờ nắn',
        section: 'Khám lâm sàng',
      },
      rangeOfMotion: {
        type: 'json',
        required: false,
        label: 'Biên độ vận động',
        section: 'Khám lâm sàng',
      },
      specialTests: {
        type: 'json',
        required: false,
        label: 'Các test đặc biệt',
        section: 'Khám lâm sàng',
      },
      neuroExam: {
        type: 'textarea',
        required: false,
        label: 'Khám thần kinh',
        section: 'Khám lâm sàng',
      },
      gaitAssessment: {
        type: 'textarea',
        required: false,
        label: 'Đánh giá dáng đi',
        section: 'Khám lâm sàng',
      },
      workingDiagnosis: {
        type: 'json',
        required: false,
        label: 'Chẩn đoán làm việc',
        section: 'Chẩn đoán và kế hoạch',
      },
      severity: {
        type: 'enum',
        required: false,
        options: ['MILD', 'MODERATE', 'SEVERE'],
        label: 'Mức độ nghiêm trọng',
        section: 'Chẩn đoán và kế hoạch',
      },
      comorbidImpact: {
        type: 'textarea',
        required: false,
        label: 'Ảnh hưởng bệnh kèm theo',
        section: 'Chẩn đoán và kế hoạch',
      },
      riskFactors: {
        type: 'textarea',
        required: false,
        label: 'Các yếu tố nguy cơ',
        section: 'Chẩn đoán và kế hoạch',
      },
      physiotherapyPlan: {
        type: 'json',
        required: false,
        label: 'Kế hoạch vật lý trị liệu',
        section: 'Chẩn đoán và kế hoạch',
      },
      educationAdvice: {
        type: 'textarea',
        required: false,
        label: 'Tư vấn giáo dục',
        section: 'Chẩn đoán và kế hoạch',
      },
      followUpDate: {
        type: 'text',
        required: false,
        label: 'Ngày tái khám',
        section: 'Chẩn đoán và kế hoạch',
      },
      followUpCondition: {
        type: 'textarea',
        required: false,
        label: 'Điều kiện tái khám',
        section: 'Chẩn đoán và kế hoạch',
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
        label: 'Vùng chụp (chest, knee, spine...)',
      },
      projection: {
        type: 'text',
        required: false,
        label: 'Tư thế chụp (AP, Lateral, Oblique...)',
      },
      indication: {
        type: 'textarea',
        required: false,
        label: 'Chỉ định',
      },
      technique: {
        type: 'textarea',
        required: false,
        label: 'Kỹ thuật chụp',
      },
      findings: {
        type: 'textarea',
        required: false,
        label: 'Các phát hiện',
      },
      osteoarthritisGrade: {
        type: 'text',
        required: false,
        label: 'Độ thoái hóa khớp',
      },
      conclusion: {
        type: 'textarea',
        required: false,
        label: 'Kết luận',
      },
      recommendations: {
        type: 'textarea',
        required: false,
        label: 'Các khuyến nghị',
      },
      imageUrls: {
        type: 'array',
        required: false,
        label: 'URL hình ảnh',
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
        label: 'Mã dịch vụ',
      },
      indication: {
        type: 'textarea',
        required: false,
        label: 'Chỉ định',
      },
      bodySite: {
        type: 'text',
        required: false,
        label: 'Vị trí siêu âm',
      },
      side: {
        type: 'enum',
        required: false,
        options: ['LEFT', 'RIGHT', 'BILATERAL'],
        label: 'Bên trái/phải/hai bên',
      },
      technique: {
        type: 'textarea',
        required: false,
        label: 'Kỹ thuật thực hiện',
      },
      findings: {
        type: 'textarea',
        required: false,
        label: 'Các phát hiện',
      },
      measurements: {
        type: 'json',
        required: false,
        label: 'Các số đo',
      },
      conclusion: {
        type: 'textarea',
        required: false,
        label: 'Kết luận',
      },
      recommendations: {
        type: 'textarea',
        required: false,
        label: 'Các khuyến nghị',
      },
      imageUrls: {
        type: 'array',
        required: false,
        label: 'URL hình ảnh',
      },
      performedAt: {
        type: 'datetime',
        required: false,
        label: 'Thời gian thực hiện',
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
        label: 'Tên panel xét nghiệm',
      },
      specimenType: {
        type: 'text',
        required: true,
        label: 'Loại mẫu (máu, nước tiểu...)',
      },
      collectedAt: {
        type: 'datetime',
        required: true,
        label: 'Thời gian lấy mẫu',
      },
      receivedAt: {
        type: 'datetime',
        required: true,
        label: 'Thời gian nhận mẫu',
      },
      reportedAt: {
        type: 'datetime',
        required: true,
        label: 'Thời gian có kết quả',
      },
      results: {
        type: 'json',
        required: true,
        label: 'Kết quả',
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
        label: 'Có bất thường hay không',
      },
      conclusion: {
        type: 'textarea',
        required: true,
        label: 'Kết luận',
      },
      recommendations: {
        type: 'textarea',
        required: true,
        label: 'Các khuyến nghị',
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
        label: 'Mã thủ thuật',
      },
      indication: {
        type: 'textarea',
        required: false,
        label: 'Chỉ định',
      },
      bodySite: {
        type: 'text',
        required: false,
        label: 'Vị trí thực hiện',
      },
      side: {
        type: 'enum',
        required: false,
        options: ['LEFT', 'RIGHT', 'BILATERAL'],
        label: 'Bên trái/phải/hai bên',
      },
      anesthesiaType: {
        type: 'text',
        required: false,
        label: 'Loại vô cảm/gây mê',
      },
      performedStart: {
        type: 'datetime',
        required: false,
        label: 'Thời gian bắt đầu',
      },
      performedEnd: {
        type: 'datetime',
        required: false,
        label: 'Thời gian kết thúc',
      },
      medications: {
        type: 'json',
        required: false,
        label: 'Thuốc sử dụng',
      },
      devices: {
        type: 'textarea',
        required: false,
        label: 'Thiết bị sử dụng',
      },
      description: {
        type: 'textarea',
        required: false,
        label: 'Mô tả quá trình',
      },
      painScoreBefore: {
        type: 'number',
        required: false,
        min: 0,
        max: 10,
        label: 'Điểm đau trước thủ thuật',
      },
      painScoreAfter: {
        type: 'number',
        required: false,
        min: 0,
        max: 10,
        label: 'Điểm đau sau thủ thuật',
      },
      immediateOutcome: {
        type: 'enum',
        required: false,
        options: ['GOOD', 'FAIR', 'POOR'],
        label: 'Kết quả ngay sau thủ thuật',
      },
      complications: {
        type: 'json',
        required: false,
        label: 'Biến chứng',
      },
      postCareInstructions: {
        type: 'textarea',
        required: false,
        label: 'Hướng dẫn chăm sóc sau',
      },
      followUpPlan: {
        type: 'textarea',
        required: false,
        label: 'Kế hoạch theo dõi',
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
        label: 'Vị trí đo',
      },
      bmdValue: {
        type: 'text',
        required: false,
        label: 'Giá trị BMD',
      },
      bmdUnit: {
        type: 'text',
        required: false,
        label: 'Đơn vị (g/cm²)',
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
        label: 'Phân loại WHO',
      },
      fractureRiskComment: {
        type: 'textarea',
        required: false,
        label: 'Nhận xét nguy cơ gãy xương',
      },
      recommendations: {
        type: 'textarea',
        required: false,
        label: 'Các khuyến nghị',
      },
    };
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
    const erm = await this.dataSource
      .getRepository(ERM)
      .createQueryBuilder('erm')
      .leftJoinAndSelect('erm.appointment', 'appointment')
      .where('erm._id = :ermId', { ermId })
      .andWhere('erm.deleted_at IS NULL')
      .getOne();

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
    let detailRecord: any;

    switch (erm.recordType) {
      case ERMRecordType.CONSULTATION:
        detailRecord = await this.saveConsultationData(ermId, data);
        break;

      case ERMRecordType.XRAY:
        detailRecord = await this.saveXrayData(ermId, data);
        break;

      case ERMRecordType.ULTRASOUND:
        detailRecord = await this.saveUltrasoundData(ermId, data);
        break;

      case ERMRecordType.LAB:
        detailRecord = await this.saveLabData(ermId, data);
        break;

      case ERMRecordType.PROCEDURE:
        detailRecord = await this.saveProcedureData(ermId, data);
        break;

      case ERMRecordType.BONE_DENSITY:
        detailRecord = await this.saveBoneDensityData(ermId, data);
        break;

      default:
        throw new BadRequestException(`Unknown record type: ${erm.recordType}`);
    }

    // Update ERM status to IN_PROGRESS if currently DRAFT
    if (erm.status === ERMStatus.DRAFT) {
      erm.status = ERMStatus.IN_PROGRESS;
    }

    // Save ERM (updatedAt will be set automatically by @UpdateDateColumn)
    const updatedErm = await this.dataSource.getRepository(ERM).save(erm);

    return {
      ermId: updatedErm._id,
      status: updatedErm.status,
      updatedAt: updatedErm.updatedAt,
      message: 'Đã lưu thông tin ERM thành công',
    };
  }

  /**
   * Helper: Save Consultation ERM data
   */
  private async saveConsultationData(ermId: string, data: any): Promise<ERMConsultation> {
    const repo = this.dataSource.getRepository(ERMConsultation);

    // Check if record exists
    const existing = await repo.findOne({ where: { ermId } });

    if (existing) {
      // Update existing record
      Object.assign(existing, data);
      return await repo.save(existing);
    } else {
      // Create new record
      return await repo.save({
        ermId,
        ...data,
      } as DeepPartial<ERMConsultation>);
    }
  }

  /**
   * Helper: Save X-ray ERM data
   */
  private async saveXrayData(ermId: string, data: any): Promise<ERMXray> {
    const repo = this.dataSource.getRepository(ERMXray);

    const existing = await repo.findOne({ where: { ermId } });

    if (existing) {
      Object.assign(existing, data);
      return await repo.save(existing);
    } else {
      return await repo.save({
        ermId,
        ...data,
      } as DeepPartial<ERMXray>);
    }
  }

  /**
   * Helper: Save Ultrasound ERM data
   */
  private async saveUltrasoundData(ermId: string, data: any): Promise<ERMUltrasound> {
    const repo = this.dataSource.getRepository(ERMUltrasound);

    const existing = await repo.findOne({ where: { ermId } });

    if (existing) {
      Object.assign(existing, data);
      return await repo.save(existing);
    } else {
      return await repo.save({
        ermId,
        ...data,
      } as DeepPartial<ERMUltrasound>);
    }
  }

  /**
   * Helper: Save Lab ERM data
   */
  private async saveLabData(ermId: string, data: any): Promise<ERMLab> {
    const repo = this.dataSource.getRepository(ERMLab);

    const existing = await repo.findOne({ where: { ermId } });

    if (existing) {
      Object.assign(existing, data);
      return await repo.save(existing);
    } else {
      return await repo.save({
        ermId,
        ...data,
      } as DeepPartial<ERMLab>);
    }
  }

  /**
   * Helper: Save Procedure ERM data
   */
  private async saveProcedureData(ermId: string, data: any): Promise<ERMProcedure> {
    const repo = this.dataSource.getRepository(ERMProcedure);

    const existing = await repo.findOne({ where: { ermId } });

    if (existing) {
      Object.assign(existing, data);
      return await repo.save(existing);
    } else {
      return await repo.save({
        ermId,
        ...data,
      } as DeepPartial<ERMProcedure>);
    }
  }

  /**
   * Helper: Save Bone Density ERM data
   */
  private async saveBoneDensityData(ermId: string, data: any): Promise<ERMBoneDensity> {
    const repo = this.dataSource.getRepository(ERMBoneDensity);

    const existing = await repo.findOne({ where: { ermId } });

    if (existing) {
      Object.assign(existing, data);
      return await repo.save(existing);
    } else {
      return await repo.save({
        ermId,
        ...data,
      } as DeepPartial<ERMBoneDensity>);
    }
  }

  /**
   * Generate unique reference ID for prescription
   * Format: EP{YYYYMMDD}{SequenceNumber}
   * Example: EP20260224001
   *
   * @returns Generated reference ID
   * @private
   */
  private async generateReferenceId(): Promise<string> {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const datePrefix = `EP${year}${month}${day}`;

    // Count prescriptions created today
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const count = await this.dataSource
      .getRepository(EPrescription)
      .createQueryBuilder('ep')
      .where('ep.created_at >= :startOfDay', { startOfDay })
      .andWhere('ep.created_at <= :endOfDay', { endOfDay })
      .getCount();

    const sequence = String(count + 1).padStart(3, '0');
    return `${datePrefix}${sequence}`;
  }

  /**
   * Create or update electronic prescription (Step 7)
   *
   * Implements upsert logic:
   * - If prescription exists: soft delete old details and create new ones
   * - If not exists: create new prescription with details
   *
   * @param appointmentId - Appointment UUID
   * @param createPrescriptionDto - Prescription data with medicines
   * @param doctorId - Doctor UUID (for permission check)
   * @returns Created/updated prescription details
   * @throws NotFoundException if appointment or medicines not found
   * @throws BadRequestException if validation fails
   */
  async createOrUpdatePrescription(
    appointmentId: string,
    createPrescriptionDto: CreatePrescriptionDto,
    doctorId: string,
  ): Promise<PrescriptionResponseDto> {
    const { doctorNote, medicines } = createPrescriptionDto;

    // Find appointment with doctor check
    const appointment = await this.dataSource
      .getRepository(Appointment)
      .findOne({
        where: { _id: appointmentId },
      });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    // Verify doctor has permission
    if (appointment.doctorId !== doctorId) {
      throw new BadRequestException('You do not have permission to create prescription for this appointment');
    }

    // Check appointment status
    if (appointment.status !== 'IN_PROGRESS' && appointment.status !== 'CHECKED_IN') {
      throw new BadRequestException('Can only create/update prescription when appointment is IN_PROGRESS or CHECKED_IN');
    }

    // Validate all medicines exist and not deleted
    const medicineIds = medicines.map(m => m.medicineId);
    const validMedicines = await this.dataSource
      .getRepository(Medicine)
      .createQueryBuilder('medicine')
      .where('medicine.id IN (:...medicineIds)', { medicineIds })
      .andWhere('medicine.deleted_at IS NULL')
      .getMany();

    if (validMedicines.length !== medicineIds.length) {
      const foundIds = validMedicines.map(m => m.id);
      const missingIds = medicineIds.filter(id => !foundIds.includes(id));
      throw new NotFoundException(`Medicines not found or deleted: ${missingIds.join(', ')}`);
    }

    // Check for habit-forming medicines
    const habitFormingMedicines = validMedicines.filter(m => m.habitForming);
    const hasHabitForming = habitFormingMedicines.length > 0;

    if (hasHabitForming) {
      console.warn(
        `[PRESCRIPTION] Habit-forming medicines detected in prescription for appointment ${appointmentId}:`,
        habitFormingMedicines.map(m => m.name).join(', ')
      );
    }

    // Check if prescription already exists
    const existingPrescription = await this.dataSource
      .getRepository(EPrescription)
      .findOne({
        where: { appointmentId },
      });

    let prescription: EPrescription;

    if (existingPrescription) {
      // UPDATE logic: Soft delete old details
      await this.dataSource
        .getRepository(DetailEPrescription)
        .createQueryBuilder()
        .softDelete()
        .where('e_prescription_id = :prescriptionId', { prescriptionId: existingPrescription._id })
        .execute();

      // Update prescription (updatedAt will be set automatically by @UpdateDateColumn)
      existingPrescription.doctorNote = doctorNote;
      prescription = await this.dataSource.getRepository(EPrescription).save(existingPrescription);
    } else {
      // CREATE logic: Generate reference ID and create new prescription
      const referenceId = await this.generateReferenceId();
      
      const newPrescription = this.dataSource.getRepository(EPrescription).create({
        appointmentId,
        referenceId,
        doctorNote,
      });

      prescription = await this.dataSource.getRepository(EPrescription).save(newPrescription);
    }

    // Create new detail records
    const detailRecords = medicines.map(med => ({
      ePrescriptionId: prescription._id,
      medicineId: med.medicineId,
      checkOut: med.checkOut,
    }));

    await this.dataSource
      .getRepository(DetailEPrescription)
      .save(detailRecords);

    // Fetch complete prescription with details
    return this.getPrescription(appointmentId, doctorId);
  }

  /**
   * Get electronic prescription for appointment (Step 7.1)
   *
   * Retrieves prescription with all medicine details
   *
   * @param appointmentId - Appointment UUID
   * @param doctorId - Doctor UUID (for permission check)
   * @returns Prescription details
   * @throws NotFoundException if appointment or prescription not found
   */
  async getPrescription(
    appointmentId: string,
    doctorId: string,
  ): Promise<PrescriptionResponseDto> {
    // Find appointment with doctor check
    const appointment = await this.dataSource
      .getRepository(Appointment)
      .findOne({
        where: { _id: appointmentId },
      });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    // Verify doctor has permission
    if (appointment.doctorId !== doctorId) {
      throw new BadRequestException('You do not have permission to view this prescription');
    }

    // Find prescription
    const prescription = await this.dataSource
      .getRepository(EPrescription)
      .findOne({
        where: { appointmentId },
      });

    if (!prescription) {
      throw new NotFoundException('Prescription not found for this appointment');
    }

    // Get all details with medicine info
    const details = await this.dataSource
      .getRepository(DetailEPrescription)
      .createQueryBuilder('detail')
      .leftJoinAndSelect('detail.medicine', 'medicine')
      .where('detail.e_prescription_id = :prescriptionId', { prescriptionId: prescription._id })
      .andWhere('detail.deleted_at IS NULL')
      .getMany();

    // Map to response DTOs
    const medicineDetails: PrescriptionMedicineDetailDto[] = details.map(detail => ({
      detailId: detail._id,
      medicineId: detail.medicineId,
      medicineName: detail.medicine?.name || 'Unknown Medicine',
      habitForming: detail.medicine?.habitForming || false,
      checkOut: detail.checkOut || '',
    }));

    const hasHabitFormingMedicines = medicineDetails.some(m => m.habitForming);

    return {
      ePrescriptionId: prescription._id,
      appointmentId: prescription.appointmentId,
      referenceId: prescription.referenceId || '',
      doctorNote: prescription.doctorNote,
      medicines: medicineDetails,
      hasHabitFormingMedicines,
      createdAt: prescription.createdAt,
      updatedAt: prescription.updatedAt,
    };
  }
}


