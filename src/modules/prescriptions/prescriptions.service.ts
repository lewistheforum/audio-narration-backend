import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, DataSource, DeepPartial } from 'typeorm';
import { Medicine } from './entities/medicine.entity';
import { EPrescription } from './entities/e-prescription.entity';
import { DetailEPrescription } from './entities/detail-e-prescription.entity';
import { ERM } from './entities/erm.entity';
import { ERMXray } from './entities/erm-xray.entity';
import { ERMLab } from './entities/erm-lab.entity';
import { ERMConsultation } from './entities/erm-consultation.entity';
import { ERMUltrasound } from './entities/erm-ultrasound.entity';
import { ERMBoneDensity } from './entities/erm-bone-density.entity';
import { ERMProcedure } from './entities/erm-procedure.entity';
import { Appointment } from '../appointments/entities/appointment.entity';
import { AppointmentStatus } from '../appointments/enums/appointment-status.enum';
import { ERMRecordType, ERMStatus } from './enums';
import { MedicineRepository } from './repositories';
import { CreateMedicineDto } from './dto/create-medicine.dto';
import { UpdateMedicineDto } from './dto/update-medicine.dto';
import {
  CreatePrescriptionDto,
  PrescriptionResponseDto,
  PrescriptionMedicineDetailDto,
} from './dto';
import { PaginatedMedicinesResponseDto } from './dto/paginated-medicines-response.dto';
import { PatientEPrescriptionDetailResponseDto } from './dto/patient-e-prescription-response.dto';
import {
  getCurrentVietnamTime,
  getStartOfDay,
  getEndOfDay,
} from 'src/common/utils/date.util';
import {
  PatientERMDetailResponseDto,
  ERMXrayDto,
  ERMLabDto,
  ERMConsultationDto,
  ERMUltrasoundDto,
  ERMBoneDensityDto,
  ERMProcedureDto,
} from './dto';
import { PdfGeneratorService } from './services';
import { MESSAGES } from '../../common/message';

/**
 * Prescriptions Service
 *
 * Handles business logic for medicine management and E-Prescriptions
 *
 * Features:
 * - Medicine CRUD operations
 * - Electronic Prescriptions (E-Prescriptions)
 * - Search by name, therapeutic class
 * - Habit-forming medicines tracking
 * - Soft delete support
 */
@Injectable()
export class PrescriptionsService {
  constructor(
    private readonly medicineRepository: MedicineRepository,
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
    @InjectRepository(EPrescription)
    private readonly ePrescriptionRepository: Repository<EPrescription>,
    @InjectRepository(DetailEPrescription)
    private readonly detailEPrescriptionRepository: Repository<DetailEPrescription>,
    @InjectRepository(ERM)
    private readonly ermRepository: Repository<ERM>,
    @InjectRepository(ERMXray)
    private readonly ermXrayRepository: Repository<ERMXray>,
    @InjectRepository(ERMLab)
    private readonly ermLabRepository: Repository<ERMLab>,
    @InjectRepository(ERMConsultation)
    private readonly ermConsultationRepository: Repository<ERMConsultation>,
    @InjectRepository(ERMUltrasound)
    private readonly ermUltrasoundRepository: Repository<ERMUltrasound>,
    @InjectRepository(ERMBoneDensity)
    private readonly ermBoneDensityRepository: Repository<ERMBoneDensity>,
    @InjectRepository(ERMProcedure)
    private readonly ermProcedureRepository: Repository<ERMProcedure>,
    private readonly dataSource: DataSource,
    private readonly pdfGeneratorService: PdfGeneratorService,
  ) {}

  /**
   * Create a new medicine record
   */
  async create(createMedicineDto: CreateMedicineDto): Promise<Medicine> {
    return await this.medicineRepository.createMedicine(createMedicineDto);
  }

  /**
   * Find medicines with pagination (with soft-deleted excluded by default)
   */
  async findAll(
    page: number = 1,
    limit: number = 20,
  ): Promise<PaginatedMedicinesResponseDto> {
    const skip = (page - 1) * limit;
    const [data, total] =
      await this.medicineRepository.findMedicinesWithPagination(skip, limit);

    return {
      data,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
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
  async searchByName(
    name: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<PaginatedMedicinesResponseDto> {
    const skip = (page - 1) * limit;
    const [data, total] =
      await this.medicineRepository.searchMedicinesByNameWithPagination(
        name,
        skip,
        limit,
      );

    return {
      data,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
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
  async update(
    id: string,
    updateMedicineDto: UpdateMedicineDto,
  ): Promise<Medicine> {
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
   * Generate unique reference ID for prescription
   * Format: EP{YYYYMMDD}{SequenceNumber}
   * Example: EP20260224001
   *
   * @returns Generated reference ID
   * @private
   */
  private async generateReferenceId(): Promise<string> {
    const today = getCurrentVietnamTime();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const datePrefix = `EP${year}${month}${day}`;

    // Count prescriptions created today
    const startOfDay = getStartOfDay();
    const endOfDay = getEndOfDay();

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
      throw new BadRequestException(
        'You do not have permission to create prescription for this appointment',
      );
    }

    // Check appointment status
    if (
      appointment.status !== 'IN_PROGRESS' &&
      appointment.status !== 'CHECKED_IN'
    ) {
      throw new BadRequestException(
        'Can only create/update prescription when appointment is IN_PROGRESS or CHECKED_IN',
      );
    }

    // Validate all medicines exist and not deleted
    const medicineIds = medicines.map((m) => m.medicineId);
    const validMedicines = await this.dataSource
      .getRepository(Medicine)
      .createQueryBuilder('medicine')
      .where('medicine.id = ANY(:medicineIds)', { medicineIds })
      .andWhere('medicine.deleted_at IS NULL')
      .getMany();

    if (validMedicines.length !== medicineIds.length) {
      const foundIds = validMedicines.map((m) => m.id);
      const missingIds = medicineIds.filter((id) => !foundIds.includes(id));
      throw new NotFoundException(
        `Medicines not found or deleted: ${missingIds.join(', ')}`,
      );
    }

    // Check for habit-forming medicines
    const habitFormingMedicines = validMedicines.filter((m) => m.habitForming);
    const hasHabitForming = habitFormingMedicines.length > 0;

    if (hasHabitForming) {
      console.warn(
        `[PRESCRIPTION] Habit-forming medicines detected in prescription for appointment ${appointmentId}:`,
        habitFormingMedicines.map((m) => m.name).join(', '),
      );
    }

    // Check if prescription already exists
    const existingPrescription = await this.dataSource
      .getRepository(EPrescription)
      .findOne({
        where: { appointmentId },
      });

    let prescription: EPrescription;

    // Use transaction for atomicity: delete old details + create/update prescription + insert new details
    prescription = await this.dataSource.transaction(async (manager) => {
      if (existingPrescription) {
        // UPDATE logic: Soft delete old details
        await manager
          .createQueryBuilder()
          .softDelete()
          .from(DetailEPrescription)
          .where('e_prescription_id = :prescriptionId', {
            prescriptionId: existingPrescription._id,
          })
          .execute();

        // Update prescription (updatedAt will be set automatically by @UpdateDateColumn)
        existingPrescription.doctorNote = doctorNote;
        return manager.save(EPrescription, existingPrescription);
      } else {
        // CREATE logic: Generate reference ID and create new prescription
        const referenceId = await this.generateReferenceId();

        const newPrescription = manager.create(EPrescription, {
          appointmentId,
          referenceId,
          doctorNote,
        });

        const savedPrescription = await manager.save(EPrescription, newPrescription);

        // Create new detail records within transaction
        const detailRecords = medicines.map((med) =>
          manager.create(DetailEPrescription, {
            ePrescriptionId: savedPrescription._id,
            medicineId: med.medicineId,
            quantity: med.quantity,
            note: med.note,
            checkOut: med.checkOut,
          }),
        );

        await manager.save(DetailEPrescription, detailRecords);

        return savedPrescription;
      }
    });

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
      throw new BadRequestException(
        'You do not have permission to view this prescription',
      );
    }

    // Find prescription
    const prescription = await this.dataSource
      .getRepository(EPrescription)
      .findOne({
        where: { appointmentId },
      });

    if (!prescription) {
      throw new NotFoundException(
        'Prescription not found for this appointment',
      );
    }

    // Get all details with medicine info
    const details = await this.dataSource
      .getRepository(DetailEPrescription)
      .createQueryBuilder('detail')
      .leftJoinAndSelect('detail.medicine', 'medicine')
      .where('detail.e_prescription_id = :prescriptionId', {
        prescriptionId: prescription._id,
      })
      .andWhere('detail.deleted_at IS NULL')
      .getMany();

    // Map to response DTOs
    const medicineDetails: PrescriptionMedicineDetailDto[] = details.map(
      (detail) => ({
        detailId: detail._id,
        medicineId: detail.medicineId,
        medicineName: detail.medicine?.name || 'Unknown Medicine',
        habitForming: detail.medicine?.habitForming || false,
        quantity: detail.quantity,
        note: detail.note,
        checkOut: detail.checkOut || '',
      }),
    );

    const hasHabitFormingMedicines = medicineDetails.some(
      (m) => m.habitForming,
    );

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

  /**
   * Get Patient E-Prescription Detail
   *
   * Retrieves the electronic prescription for a specific appointment
   *
   * Security & Validation:
   * - Layer 1: Verifies appointment ownership (patient_id matching)
   * - Layer 2: Enforces status rule (must be COMPLETED)
   * - Layer 3: Loads E-Prescription with details and medicines
   *
   * @param {string} patientId - Patient ID from JWT token
   * @param {string} appointmentId - Appointment ID from route params
   * @returns {Promise<PatientEPrescriptionDetailResponseDto>} E-Prescription details
   * @throws {NotFoundException} Appointment or E-Prescription not found
   * @throws {ForbiddenException} Appointment not COMPLETED or access denied
   */
  async getPatientEPrescription(
    patientId: string,
    appointmentId: string,
  ): Promise<PatientEPrescriptionDetailResponseDto> {
    // Layer 1: Verify appointment ownership
    const appointment = await this.appointmentRepository.findOne({
      where: {
        _id: appointmentId,
        patientId: patientId,
        deletedAt: IsNull(),
      },
      select: ['_id', 'status'],
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found or access denied');
    }

    // Layer 2: Check status rule - E-Prescription only available for COMPLETED appointments
    if (appointment.status !== AppointmentStatus.COMPLETED) {
      throw new ForbiddenException(
        'E-Prescription is only available for completed appointments',
      );
    }

    // Layer 3: Load E-Prescription with details
    const ePrescription = await this.ePrescriptionRepository
      .createQueryBuilder('ep')
      .leftJoinAndSelect(
        'ep.detailEPrescriptions',
        'dep',
        'dep.deleted_at IS NULL',
      )
      .leftJoinAndSelect('dep.medicine', 'm', 'm.deleted_at IS NULL')
      .where('ep.appointment_id = :appointmentId', { appointmentId })
      .andWhere('ep.deleted_at IS NULL')
      .getOne();

    if (!ePrescription) {
      throw new NotFoundException('E-Prescription not found');
    }

    // Filter out soft-deleted details (defensive programming)
    const activeDetails =
      ePrescription.detailEPrescriptions?.filter((d) => !d.deletedAt) || [];

    // Map to response DTO
    return {
      _id: ePrescription._id,
      appointment_id: ePrescription.appointmentId,
      doctor_note: ePrescription.doctorNote,
      detail_e_prescriptions: activeDetails.map((detail) => ({
        _id: detail._id,
        medicine: {
          id: detail.medicine.id,
          name: detail.medicine.name,
          subtitle_0: detail.medicine.subtitle0,
          usage: detail.medicine.used, // Entity field is 'used', DTO field is 'usage'
          side_effect: detail.medicine.sideEffect,
        },
        quantity: detail.quantity,
        check_out: detail.checkOut,
        note: detail.note,
      })),
      created_at: ePrescription.createdAt,
    };
  }

  /**
   * Generate E-Prescription PDF
   *
   * Exports electronic prescription as a PDF document with medical/legal compliance
   *
   * Validation & Data Flow:
   * - Layer 1-2: Reuses getPatientEPrescription() for ownership + status validation
   * - Layer 3: Aggregates clinic, doctor, patient metadata for PDF header/footer
   * - Layer 4: Generates PDF using PdfGeneratorService
   *
   * @param {string} patientId - Patient ID from JWT token
   * @param {string} appointmentId - Appointment ID from route params
   * @returns {Promise<Buffer>} PDF binary data
   * @throws {NotFoundException} Appointment or E-Prescription not found
   * @throws {ForbiddenException} Appointment not COMPLETED
   */
  async generateEPrescriptionPdf(
    patientId: string,
    appointmentId: string,
  ): Promise<Buffer> {
    // Reuse validation & E-Prescription data loading from getPatientEPrescription
    const ePrescriptionData = await this.getPatientEPrescription(
      patientId,
      appointmentId,
    );

    // Load aggregated data for PDF (clinic, doctor, patient info)
    const aggregatedData = await this.dataSource
      .createQueryBuilder()
      .select([
        // Clinic info
        'clinic._id AS clinic_id',
        'clinic_info.clinic_name AS clinic_name',
        'clinic_addr.address AS clinic_address',
        'clinic.phone AS clinic_phone',
        'clinic_info.profile_picture AS clinic_logo',
        // Doctor info
        'doctor._id AS doctor_id',
        'doctor_info.full_name AS doctor_name',
        'doctor_info.academic_degree AS doctor_degree',
        'doctor_info.position AS doctor_position',
        // Patient info
        'patient_info.full_name AS patient_name',
        'patient_info.dob AS patient_dob',
        'patient_info.gender AS patient_gender',
        'patient.phone AS patient_phone',
        // Appointment info
        'a.appointment_date AS appointment_date',
        'a._id AS appointment_id',
      ])
      .from('appointments', 'a')
      .innerJoin('accounts', 'clinic', 'clinic._id = a.clinic_id')
      .leftJoin(
        'clinic_information',
        'clinic_info',
        'clinic_info.account_id = clinic._id',
      )
      .leftJoin(
        'addresses',
        'clinic_addr',
        'clinic_addr.account_id = clinic._id',
      )
      .innerJoin('accounts', 'doctor', 'doctor._id = a.doctor_id')
      .leftJoin(
        'doctor_information',
        'doctor_info',
        'doctor_info.account_id = doctor._id',
      )
      .innerJoin('accounts', 'patient', 'patient._id = a.patient_id')
      .leftJoin(
        'general_accounts',
        'patient_info',
        'patient_info.account_id = patient._id',
      )
      .where('a._id = :appointmentId', { appointmentId })
      .getRawOne();

    if (!aggregatedData) {
      throw new NotFoundException(
        'Unable to retrieve appointment metadata for PDF generation',
      );
    }

    // Generate PDF using PdfGeneratorService
    const pdfBuffer = await this.pdfGeneratorService.generateEPrescriptionPdf({
      ePrescription: ePrescriptionData,
      aggregatedData,
    });

    return pdfBuffer;
  }

  /**
   * Get Patient ERM Detail (Polymorphic Retrieval)
   *
   * Retrieves specific ERM record details with strict validation
   *
   * Security & Validation (4 Layers):
   * - Layer 1: Verify appointment ownership (patient_id matching)
   * - Layer 2: Verify ERM belongs to appointment
   * - Layer 3: Enforce visibility rule (status must be COMPLETED)
   * - Layer 4: Fetch polymorphic child record based on record_type
   *
   * @param {string} patientId - Patient ID from JWT token
   * @param {string} appointmentId - Appointment ID from route params
   * @param {string} ermId - ERM ID from route params
   * @returns {Promise<PatientERMDetailResponseDto>} Polymorphic ERM details
   * @throws {NotFoundException} Appointment, ERM, or child record not found
   * @throws {ForbiddenException} ERM status not COMPLETED
   */
  async getPatientERMDetail(
    patientId: string,
    appointmentId: string,
    ermId: string,
  ): Promise<PatientERMDetailResponseDto> {
    // Layer 1: Verify appointment ownership
    const appointment = await this.appointmentRepository.findOne({
      where: {
        _id: appointmentId,
        patientId: patientId,
        deletedAt: IsNull(),
      },
      select: ['_id'],
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found or access denied');
    }

    // Layer 2: Verify ERM belongs to appointment
    const erm = await this.ermRepository.findOne({
      where: {
        _id: ermId,
        appointmentId: appointmentId,
        deletedAt: IsNull(),
      },
      select: [
        '_id',
        'appointmentId',
        'recordType',
        'status',
        'serviceCode',
        'createdAt',
        'signedAt',
      ],
    });

    if (!erm) {
      throw new NotFoundException('ERM record not found');
    }

    // Layer 3: Visibility Rule - Only COMPLETED records accessible
    if (erm.status !== ERMStatus.COMPLETED) {
      throw new ForbiddenException(
        'ERM record is not available (status must be COMPLETED)',
      );
    }

    // Layer 4: Polymorphic Retrieval - Fetch child record based on record_type
    let childDetails:
      | ERMXray
      | ERMLab
      | ERMConsultation
      | ERMUltrasound
      | ERMBoneDensity
      | ERMProcedure;

    switch (erm.recordType) {
      case ERMRecordType.XRAY:
        childDetails = await this.ermXrayRepository.findOne({
          where: { ermId: erm._id, deletedAt: IsNull() },
        });
        break;

      case ERMRecordType.LAB:
        childDetails = await this.ermLabRepository.findOne({
          where: { ermId: erm._id, deletedAt: IsNull() },
        });
        break;

      case ERMRecordType.CONSULTATION:
        childDetails = await this.ermConsultationRepository.findOne({
          where: { ermId: erm._id, deletedAt: IsNull() },
        });
        break;

      case ERMRecordType.ULTRASOUND:
        childDetails = await this.ermUltrasoundRepository.findOne({
          where: { ermId: erm._id, deletedAt: IsNull() },
        });
        break;

      case ERMRecordType.BONE_DENSITY:
        childDetails = await this.ermBoneDensityRepository.findOne({
          where: { ermId: erm._id, deletedAt: IsNull() },
        });
        break;

      case ERMRecordType.PROCEDURE:
        childDetails = await this.ermProcedureRepository.findOne({
          where: { ermId: erm._id, deletedAt: IsNull() },
        });
        break;

      default:
        throw new NotFoundException(
          `Unsupported ERM record type: ${erm.recordType}`,
        );
    }

    if (!childDetails) {
      throw new NotFoundException(
        `${erm.recordType} details not found for this ERM record`,
      );
    }

    // Map to DTO
    const mappedDetails = this.mapERMDetailsToDto(erm.recordType, childDetails);

    return {
      _id: erm._id,
      appointment_id: erm.appointmentId,
      record_type: erm.recordType,
      status: erm.status,
      service_code: erm.serviceCode,
      created_at: erm.createdAt,
      signed_at: erm.signedAt,
      details: mappedDetails,
    };
  }

  /**
   * Map ERM Details to DTO (Private Helper)
   *
   * Safely maps raw database entities to corresponding typed DTOs
   *
   * @param {ERMRecordType} recordType - Type of ERM record
   * @param {any} details - Raw entity data
   * @returns {ERMXrayDto | ERMLabDto | ERMConsultationDto | ERMUltrasoundDto | ERMBoneDensityDto | ERMProcedureDto}
   */
  private mapERMDetailsToDto(
    recordType: ERMRecordType,
    details: any,
  ):
    | ERMXrayDto
    | ERMLabDto
    | ERMConsultationDto
    | ERMUltrasoundDto
    | ERMBoneDensityDto
    | ERMProcedureDto {
    switch (recordType) {
      case ERMRecordType.XRAY:
        return {
          _id: details._id,
          erm_id: details.ermId,
          region: details.region,
          projection: details.projection,
          indication: details.indication,
          technique: details.technique,
          findings: details.findings,
          osteoarthritis_grade: details.osteoarthritisGrade,
          conclusion: details.conclusion,
          recommendations: details.recommendations,
          image_urls: details.imageUrls,
          created_at: details.createdAt,
        } as ERMXrayDto;

      case ERMRecordType.LAB:
        return {
          _id: details._id,
          erm_id: details.ermId,
          panel_name: details.panelName,
          specimen_type: details.specimenType,
          collected_at: details.collectedAt,
          received_at: details.receivedAt,
          reported_at: details.reportedAt,
          results: details.results,
          abnormal_summary: details.abnormalSummary,
          conclusion: details.conclusion,
          recommendations: details.recommendations,
          created_at: details.createdAt,
        } as ERMLabDto;

      case ERMRecordType.CONSULTATION:
        return {
          _id: details._id,
          erm_id: details.ermId,
          visit_type: details.visitType,
          main_service_code: details.mainServiceCode,
          chief_complaint: details.chiefComplaint,
          onset_duration: details.onsetDuration,
          pain_location: details.painLocation,
          pain_character: details.painCharacter,
          pain_intensity: details.painIntensity,
          aggravating_factors: details.aggravatingFactors,
          relieving_factors: details.relievingFactors,
          functional_limitations: details.functionalLimitations,
          past_msk_history: details.pastMskHistory,
          past_medical_history: details.pastMedicalHistory,
          medication_history: details.medicationHistory,
          family_history: details.familyHistory,
          red_flags: details.redFlags,
          vital_signs: details.vitalSigns,
          inspection_findings: details.inspectionFindings,
          palpation_findings: details.palpationFindings,
          range_of_motion: details.rangeOfMotion,
          special_tests: details.specialTests,
          neuro_exam: details.neuroExam,
          gait_assessment: details.gaitAssessment,
          working_diagnosis: details.workingDiagnosis,
          severity: details.severity,
          comorbid_impact: details.comorbidImpact,
          risk_factors: details.riskFactors,
          physiotherapy_plan: details.physiotherapyPlan,
          education_advice: details.educationAdvice,
          follow_up_date: details.followUpDate,
          follow_up_condition: details.followUpCondition,
          created_at: details.createdAt,
        } as ERMConsultationDto;

      case ERMRecordType.ULTRASOUND:
        return {
          _id: details._id,
          erm_id: details.ermId,
          service_code: details.serviceCode,
          indication: details.indication,
          body_site: details.bodySite,
          side: details.side,
          technique: details.technique,
          findings: details.findings,
          measurements: details.measurements,
          conclusion: details.conclusion,
          recommendations: details.recommendations,
          image_urls: details.imageUrls,
          performed_at: details.performedAt,
        } as ERMUltrasoundDto;

      case ERMRecordType.BONE_DENSITY:
        return {
          _id: details._id,
          erm_id: details.ermId,
          site: details.site,
          bmd_value: details.bmdValue,
          bmd_unit: details.bmdUnit,
          t_score: details.tScore,
          z_score: details.zScore,
          who_category: details.whoCategory,
          fracture_risk_comment: details.fractureRiskComment,
          recommendations: details.recommendations,
          created_at: details.createdAt,
        } as ERMBoneDensityDto;

      case ERMRecordType.PROCEDURE:
        return {
          _id: details._id,
          erm_id: details.ermId,
          procedure_code: details.procedureCode,
          indication: details.indication,
          body_site: details.bodySite,
          side: details.side,
          anesthesia_type: details.anesthesiaType,
          performed_start: details.performedStart,
          performed_end: details.performedEnd,
          medications: details.medications,
          devices: details.devices,
          description: details.description,
          pain_score_before: details.painScoreBefore,
          pain_score_after: details.painScoreAfter,
          immediate_outcome: details.immediateOutcome,
          complications: details.complications,
          post_care_instructions: details.postCareInstructions,
          follow_up_plan: details.followUpPlan,
          created_at: details.createdAt,
        } as ERMProcedureDto;

      default:
        throw new NotFoundException(`Unsupported record type: ${recordType}`);
    }
  }
}
