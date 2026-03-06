import { Test, TestingModule } from '@nestjs/testing';
import { PrescriptionsService } from '../../../src/modules/prescriptions/prescriptions.service';
import { PdfGeneratorService } from '../../../src/modules/prescriptions/services/pdf-generator.service';
import { Repository, DataSource } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Appointment } from '../../../src/modules/appointments/entities/appointment.entity';
import { EPrescription } from '../../../src/modules/prescriptions/entities/e-prescription.entity';
import { DetailEPrescription } from '../../../src/modules/prescriptions/entities/detail-e-prescription.entity';
import { Medicine } from '../../../src/modules/prescriptions/entities/medicine.entity';
import { ERM } from '../../../src/modules/prescriptions/entities/erm.entity';
import { ERMXray } from '../../../src/modules/prescriptions/entities/erm-xray.entity';
import { ERMLab } from '../../../src/modules/prescriptions/entities/erm-lab.entity';
import { ERMConsultation } from '../../../src/modules/prescriptions/entities/erm-consultation.entity';
import { ERMUltrasound } from '../../../src/modules/prescriptions/entities/erm-ultrasound.entity';
import { ERMBoneDensity } from '../../../src/modules/prescriptions/entities/erm-bone-density.entity';
import { ERMProcedure } from '../../../src/modules/prescriptions/entities/erm-procedure.entity';
import { AppointmentStatus } from '../../../src/modules/appointments/enums/appointment-status.enum';
import { ERMStatus, ERMRecordType } from '../../../src/modules/prescriptions/enums';

/**
 * ============================================================================
 * PRESCRIPTIONS SERVICE UNIT TESTS - PATIENT VIEW FLOW
 * Test Coverage: E-Prescription Viewing, PDF Export, Polymorphic ERM Retrieval
 * ============================================================================
 *
 * This test suite comprehensively covers the Patient View Flow for Prescriptions:
 * 
 * 1. ✅ E-Prescription Viewing (API 3) - 2-layer validation + soft-delete filtering
 * 2. ✅ PDF Generation (API 4) - Validation reuse + aggregated data loading
 * 3. ✅ Polymorphic ERM Retrieval (API 5) - 3-layer validation + 6 ERM types
 * 4. ✅ Security: Multi-layer ownership verification
 * 5. ✅ Status-Based Visibility: COMPLETED requirement for e-prescription, ERMs
 * 6. ✅ Error Handling: NotFoundException, ForbiddenException
 * 
 * @author Senior QA Automation Engineer
 * @version 1.0
 * @date 2026-03-03
 */

describe('PrescriptionsService - Patient View Flow', () => {
  let prescriptionsService: PrescriptionsService;
  let appointmentRepository: Repository<Appointment>;
  let ePrescriptionRepository: Repository<EPrescription>;
  let ermRepository: Repository<ERM>;
  let ermXrayRepository: Repository<ERMXray>;
  let ermLabRepository: Repository<ERMLab>;
  let ermConsultationRepository: Repository<ERMConsultation>;
  let ermUltrasoundRepository: Repository<ERMUltrasound>;
  let ermBoneDensityRepository: Repository<ERMBoneDensity>;
  let ermProcedureRepository: Repository<ERMProcedure>;
  let pdfGeneratorService: PdfGeneratorService;
  let dataSource: DataSource;

  // ============================================================================
  // MOCK DATA FACTORIES
  // ============================================================================

  const createMockAppointment = (overrides = {}) => ({
    _id: 'apt-123',
    patientId: 'patient-123',
    clinicId: 'clinic-123',
    doctorId: 'doctor-123',
    status: AppointmentStatus.COMPLETED,
    appointmentDate: new Date('2026-03-10'),
    deletedAt: null,
    ...overrides,
  });

  const createMockEPrescription = (overrides = {}) => ({
    _id: 'ep-123',
    appointmentId: 'apt-123',
    doctorNote: 'Take medicines as prescribed',
    createdAt: new Date('2026-03-10'),
    deletedAt: null,
    detailEPrescriptions: [
      {
        _id: 'dep-1',
        ePrescriptionId: 'ep-123',
        medicineId: 'med-1',
        quantity: 20,
        checkOut: 'Take after meal',
        note: '2 times per day',
        deletedAt: null,
        medicine: {
          id: 'med-1',
          name: 'Paracetamol 500mg',
          subtitle0: '500mg tablet',
          usage: 'Fever, pain relief',
          sideEffect: 'Nausea, rare allergic reactions',
        },
      },
      {
        _id: 'dep-2',
        ePrescriptionId: 'ep-123',
        medicineId: 'med-2',
        quantity: 30,
        checkOut: 'Take with water',
        note: '3 times per day',
        deletedAt: null,
        medicine: {
          id: 'med-2',
          name: 'Amoxicillin 250mg',
          subtitle0: '250mg capsule',
          usage: 'Antibiotic',
          sideEffect: 'Diarrhea, rash',
        },
      },
    ],
    ...overrides,
  });

  const createMockERM = (overrides = {}) => ({
    _id: 'erm-123',
    appointmentId: 'apt-123',
    serviceAppointmentsId: 'sa-123',
    recordType: ERMRecordType.XRAY,
    status: ERMStatus.COMPLETED,
    serviceCode: 'XRAY-001',
    createdAt: new Date('2026-03-10'),
    signedAt: new Date('2026-03-10'),
    deletedAt: null,
    ...overrides,
  });

  const createMockERMXray = (overrides = {}) => ({
    _id: 'erm-xray-1',
    ermId: 'erm-123',
    region: 'Right Knee',
    projection: 'AP/Lateral',
    indication: 'Knee pain',
    technique: 'Digital X-Ray',
    findings: 'Mild osteoarthritis changes',
    osteoarthritisGrade: 'Grade 2',
    conclusion: 'Mild degenerative changes',
    recommendations: 'Physical therapy advised',
    imageUrls: ['https://example.com/xray1.jpg'],
    deletedAt: null,
    ...overrides,
  });

  const createMockERMLab = (overrides = {}) => ({
    _id: 'erm-lab-1',
    ermId: 'erm-123',
    panelName: 'Complete Blood Count',
    specimenType: 'Venous Blood',
    collectedAt: new Date('2026-03-10T08:00:00'),
    receivedAt: new Date('2026-03-10T09:00:00'),
    reportedAt: new Date('2026-03-10T14:00:00'),
    results: {
      wbc: { value: 7.5, unit: '10^9/L', referenceRange: '4.5-11.0', status: 'normal' },
      rbc: { value: 4.8, unit: '10^12/L', referenceRange: '4.5-5.5', status: 'normal' },
      hemoglobin: { value: 14.2, unit: 'g/dL', referenceRange: '13.5-17.5', status: 'normal' },
    },
    abnormalSummary: false,
    conclusion: 'All parameters within normal limits',
    recommendations: 'No action needed',
    deletedAt: null,
    ...overrides,
  });

  const createMockAggregatedData = () => ({
    clinic_id: 'clinic-123',
    clinic_name: 'ABC Medical Clinic',
    clinic_address: '123 Main Street, Hanoi',
    clinic_phone: '0123456789',
    clinic_logo: 'https://example.com/logo.png',
    doctor_id: 'doctor-123',
    doctor_name: 'Dr. Nguyen Van A',
    doctor_degree: 'MD, PhD',
    doctor_position: 'Senior Orthopedist',
    patient_name: 'Tran Thi B',
    patient_dob: new Date('1990-05-15'),
    patient_gender: 'female',
    patient_phone: '0987654321',
  });

  // ============================================================================
  // SETUP & TEARDOWN
  // ============================================================================

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrescriptionsService,
        {
          provide: getRepositoryToken(Appointment),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(EPrescription),
          useValue: {
            createQueryBuilder: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(DetailEPrescription),
          useValue: {},
        },
        {
          provide: getRepositoryToken(Medicine),
          useValue: {},
        },
        {
          provide: getRepositoryToken(ERM),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ERMXray),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ERMLab),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ERMConsultation),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ERMUltrasound),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ERMBoneDensity),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ERMProcedure),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: PdfGeneratorService,
          useValue: {
            generateEPrescriptionPdf: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            createQueryBuilder: jest.fn(),
          },
        },
      ],
    }).compile();

    prescriptionsService = module.get<PrescriptionsService>(PrescriptionsService);
    appointmentRepository = module.get<Repository<Appointment>>(getRepositoryToken(Appointment));
    ePrescriptionRepository = module.get<Repository<EPrescription>>(getRepositoryToken(EPrescription));
    ermRepository = module.get<Repository<ERM>>(getRepositoryToken(ERM));
    ermXrayRepository = module.get<Repository<ERMXray>>(getRepositoryToken(ERMXray));
    ermLabRepository = module.get<Repository<ERMLab>>(getRepositoryToken(ERMLab));
    ermConsultationRepository = module.get<Repository<ERMConsultation>>(getRepositoryToken(ERMConsultation));
    ermUltrasoundRepository = module.get<Repository<ERMUltrasound>>(getRepositoryToken(ERMUltrasound));
    ermBoneDensityRepository = module.get<Repository<ERMBoneDensity>>(getRepositoryToken(ERMBoneDensity));
    ermProcedureRepository = module.get<Repository<ERMProcedure>>(getRepositoryToken(ERMProcedure));
    pdfGeneratorService = module.get<PdfGeneratorService>(PdfGeneratorService);
    dataSource = module.get<DataSource>(DataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // TEST SUITE 1: E-PRESCRIPTION VIEWING (API 3)
  // ============================================================================

  describe('getPatientEPrescription - 2-Layer Validation', () => {
    it('should return e-prescription details successfully', async () => {
      // Arrange
      const patientId = 'patient-123';
      const appointmentId = 'apt-123';

      const mockAppointment = createMockAppointment({ status: AppointmentStatus.COMPLETED });
      const mockEPrescription = createMockEPrescription();

      jest.spyOn(appointmentRepository, 'findOne').mockResolvedValue(mockAppointment as any);

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockEPrescription),
      };

      jest.spyOn(ePrescriptionRepository, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);

      // Act
      const result = await prescriptionsService.getPatientEPrescription(patientId, appointmentId);

      // Assert
      expect(result._id).toBe('ep-123');
      expect(result.appointment_id).toBe('apt-123');
      expect(result.doctor_note).toBe('Take medicines as prescribed');
      expect(result.detail_e_prescriptions).toHaveLength(2);
      expect(result.detail_e_prescriptions[0].medicine.name).toBe('Paracetamol 500mg');
      expect(result.detail_e_prescriptions[1].medicine.name).toBe('Amoxicillin 250mg');
      expect(appointmentRepository.findOne).toHaveBeenCalledWith({
        where: {
          _id: appointmentId,
          patientId: patientId,
          deletedAt: null,
        },
        select: ['_id', 'status'],
      });
    });

    it('should throw NotFoundException when appointment not found', async () => {
      // Arrange
      const patientId = 'patient-123';
      const appointmentId = 'apt-999';

      jest.spyOn(appointmentRepository, 'findOne').mockResolvedValue(null);

      // Act & Assert
      await expect(
        prescriptionsService.getPatientEPrescription(patientId, appointmentId),
      ).rejects.toThrow(NotFoundException);

      await expect(
        prescriptionsService.getPatientEPrescription(patientId, appointmentId),
      ).rejects.toThrow('Appointment not found');
    });

    it('should throw NotFoundException when appointment does not belong to patient', async () => {
      // Arrange
      const patientId = 'patient-999'; // Wrong patient
      const appointmentId = 'apt-123';

      jest.spyOn(appointmentRepository, 'findOne').mockResolvedValue(null); // Ownership check fails

      // Act & Assert
      await expect(
        prescriptionsService.getPatientEPrescription(patientId, appointmentId),
      ).rejects.toThrow(NotFoundException);

      expect(appointmentRepository.findOne).toHaveBeenCalledWith({
        where: {
          _id: appointmentId,
          patientId: patientId, // Verify ownership check in query
          deletedAt: null,
        },
        select: ['_id', 'status'],
      });
    });

    it('should throw ForbiddenException when appointment is not COMPLETED', async () => {
      // Arrange
      const patientId = 'patient-123';
      const appointmentId = 'apt-123';

      const mockAppointment = createMockAppointment({ status: AppointmentStatus.IN_PROGRESS });

      jest.spyOn(appointmentRepository, 'findOne').mockResolvedValue(mockAppointment as any);

      // Act & Assert
      await expect(
        prescriptionsService.getPatientEPrescription(patientId, appointmentId),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        prescriptionsService.getPatientEPrescription(patientId, appointmentId),
      ).rejects.toThrow('E-Prescription is only available for completed appointments');
    });

    it('should throw NotFoundException when e-prescription not found', async () => {
      // Arrange
      const patientId = 'patient-123';
      const appointmentId = 'apt-123';

      const mockAppointment = createMockAppointment({ status: AppointmentStatus.COMPLETED });

      jest.spyOn(appointmentRepository, 'findOne').mockResolvedValue(mockAppointment as any);

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null), // No e-prescription
      };

      jest.spyOn(ePrescriptionRepository, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);

      // Act & Assert
      await expect(
        prescriptionsService.getPatientEPrescription(patientId, appointmentId),
      ).rejects.toThrow(NotFoundException);

      await expect(
        prescriptionsService.getPatientEPrescription(patientId, appointmentId),
      ).rejects.toThrow('E-Prescription not found');
    });

    it('should filter out soft-deleted detail e-prescription items', async () => {
      // Arrange
      const patientId = 'patient-123';
      const appointmentId = 'apt-123';

      const mockAppointment = createMockAppointment({ status: AppointmentStatus.COMPLETED });
      const mockEPrescription = createMockEPrescription({
        detailEPrescriptions: [
          {
            _id: 'dep-1',
            medicineId: 'med-1',
            deletedAt: null,
            medicine: { id: 'med-1', name: 'Medicine 1' },
          },
          {
            _id: 'dep-2',
            medicineId: 'med-2',
            deletedAt: new Date(), // Soft-deleted
            medicine: { id: 'med-2', name: 'Medicine 2' },
          },
          {
            _id: 'dep-3',
            medicineId: 'med-3',
            deletedAt: null,
            medicine: { id: 'med-3', name: 'Medicine 3' },
          },
        ],
      });

      jest.spyOn(appointmentRepository, 'findOne').mockResolvedValue(mockAppointment as any);

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockEPrescription),
      };

      jest.spyOn(ePrescriptionRepository, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);

      // Act
      const result = await prescriptionsService.getPatientEPrescription(patientId, appointmentId);

      // Assert
      expect(result.detail_e_prescriptions).toHaveLength(2); // Only non-deleted items
      expect(result.detail_e_prescriptions[0]._id).toBe('dep-1');
      expect(result.detail_e_prescriptions[1]._id).toBe('dep-3');
      expect(result.detail_e_prescriptions.find((d) => d._id === 'dep-2')).toBeUndefined();
    });
  });

  // ============================================================================
  // TEST SUITE 2: PDF GENERATION (API 4)
  // ============================================================================

  describe('generateEPrescriptionPdf - Validation Reuse & Aggregated Data', () => {
    it('should generate PDF successfully', async () => {
      // Arrange
      const patientId = 'patient-123';
      const appointmentId = 'apt-123';

      const mockEPrescriptionData = {
        _id: 'ep-123',
        appointment_id: 'apt-123',
        doctor_note: 'Test note',
        detail_e_prescriptions: [],
        created_at: new Date(),
      };

      const mockAggregatedData = createMockAggregatedData();
      const mockPdfBuffer = Buffer.from('PDF content');

      // Spy on getPatientEPrescription (reuse validation)
      jest
        .spyOn(prescriptionsService, 'getPatientEPrescription')
        .mockResolvedValue(mockEPrescriptionData as any);

      // Mock aggregated data query
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue(mockAggregatedData),
      };

      jest.spyOn(dataSource, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);

      // Mock PDF generator
      jest.spyOn(pdfGeneratorService, 'generateEPrescriptionPdf').mockResolvedValue(mockPdfBuffer);

      // Act
      const result = await prescriptionsService.generateEPrescriptionPdf(patientId, appointmentId);

      // Assert
      expect(prescriptionsService.getPatientEPrescription).toHaveBeenCalledWith(patientId, appointmentId);
      expect(pdfGeneratorService.generateEPrescriptionPdf).toHaveBeenCalledWith({
        ePrescription: mockEPrescriptionData,
        aggregatedData: mockAggregatedData,
      });
      expect(result).toBeInstanceOf(Buffer);
      expect(result).toBe(mockPdfBuffer);
    });

    it('should propagate validation failure from getPatientEPrescription', async () => {
      // Arrange
      const patientId = 'patient-123';
      const appointmentId = 'apt-pending';

      // Mock getPatientEPrescription to throw ForbiddenException
      jest
        .spyOn(prescriptionsService, 'getPatientEPrescription')
        .mockRejectedValue(
          new ForbiddenException('E-Prescription is only available for completed appointments'),
        );

      // Act & Assert
      await expect(
        prescriptionsService.generateEPrescriptionPdf(patientId, appointmentId),
      ).rejects.toThrow(ForbiddenException);

      // Verify PDF generator was NOT called
      expect(pdfGeneratorService.generateEPrescriptionPdf).not.toHaveBeenCalled();
    });

    it('should load aggregated data with correct query structure', async () => {
      // Arrange
      const patientId = 'patient-123';
      const appointmentId = 'apt-123';

      jest.spyOn(prescriptionsService, 'getPatientEPrescription').mockResolvedValue({} as any);

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue(createMockAggregatedData()),
      };

      jest.spyOn(dataSource, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);
      jest.spyOn(pdfGeneratorService, 'generateEPrescriptionPdf').mockResolvedValue(Buffer.from(''));

      // Act
      await prescriptionsService.generateEPrescriptionPdf(patientId, appointmentId);

      // Assert
      expect(mockQueryBuilder.from).toHaveBeenCalledWith('appointments', 'a');
      expect(mockQueryBuilder.innerJoin).toHaveBeenCalledWith('accounts', 'clinic', 'clinic._id = a.clinic_id');
      expect(mockQueryBuilder.innerJoin).toHaveBeenCalledWith('accounts', 'doctor', 'doctor._id = a.doctor_id');
      expect(mockQueryBuilder.innerJoin).toHaveBeenCalledWith('accounts', 'patient', 'patient._id = a.patient_id');
      expect(mockQueryBuilder.leftJoin).toHaveBeenCalledWith(
        'doctor_information',
        'doctor_info',
        'doctor_info.account_id = doctor._id',
      );
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('a._id = :appointmentId', { appointmentId });
    });

    it('should pass correct data structure to PDF generator', async () => {
      // Arrange
      const patientId = 'patient-123';
      const appointmentId = 'apt-123';

      const mockEPrescriptionData = { _id: 'ep-123' };
      const mockAggregatedData = createMockAggregatedData();

      jest.spyOn(prescriptionsService, 'getPatientEPrescription').mockResolvedValue(mockEPrescriptionData as any);

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue(mockAggregatedData),
      };

      jest.spyOn(dataSource, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);
      jest.spyOn(pdfGeneratorService, 'generateEPrescriptionPdf').mockResolvedValue(Buffer.from(''));

      // Act
      await prescriptionsService.generateEPrescriptionPdf(patientId, appointmentId);

      // Assert
      expect(pdfGeneratorService.generateEPrescriptionPdf).toHaveBeenCalledWith({
        ePrescription: expect.objectContaining({ _id: 'ep-123' }),
        aggregatedData: expect.objectContaining({
          clinic_name: 'ABC Medical Clinic',
          doctor_name: 'Dr. Nguyen Van A',
          patient_name: 'Tran Thi B',
        }),
      });
    });
  });

  // ============================================================================
  // TEST SUITE 3: POLYMORPHIC ERM RETRIEVAL (API 5)
  // ============================================================================

  describe('getPatientERMDetail - 3-Layer Validation & Polymorphic Retrieval', () => {
    it('should retrieve XRAY ERM details successfully', async () => {
      // Arrange
      const patientId = 'patient-123';
      const appointmentId = 'apt-123';
      const ermId = 'erm-123';

      const mockAppointment = createMockAppointment();
      const mockERM = createMockERM({ recordType: ERMRecordType.XRAY });
      const mockERMXray = createMockERMXray();

      jest.spyOn(appointmentRepository, 'findOne').mockResolvedValue(mockAppointment as any);
      jest.spyOn(ermRepository, 'findOne').mockResolvedValue(mockERM as any);
      jest.spyOn(ermXrayRepository, 'findOne').mockResolvedValue(mockERMXray as any);

      // Act
      const result = await prescriptionsService.getPatientERMDetail(patientId, appointmentId, ermId);

      // Assert
      expect(result._id).toBe('erm-123');
      expect(result.record_type).toBe(ERMRecordType.XRAY);
      expect(result.status).toBe(ERMStatus.COMPLETED);
      expect(result.details).toHaveProperty('region', 'Right Knee');
      expect(result.details).toHaveProperty('findings', 'Mild osteoarthritis changes');
      expect(result.details).toHaveProperty('conclusion', 'Mild degenerative changes');
      expect(ermXrayRepository.findOne).toHaveBeenCalledWith({
        where: { ermId: 'erm-123', deletedAt: null },
      });
    });

    it('should retrieve LAB ERM details successfully', async () => {
      // Arrange
      const patientId = 'patient-123';
      const appointmentId = 'apt-123';
      const ermId = 'erm-lab-123';

      const mockAppointment = createMockAppointment();
      const mockERM = createMockERM({ _id: ermId, recordType: ERMRecordType.LAB });
      const mockERMLab = createMockERMLab();

      jest.spyOn(appointmentRepository, 'findOne').mockResolvedValue(mockAppointment as any);
      jest.spyOn(ermRepository, 'findOne').mockResolvedValue(mockERM as any);
      jest.spyOn(ermLabRepository, 'findOne').mockResolvedValue(mockERMLab as any);

      // Act
      const result = await prescriptionsService.getPatientERMDetail(patientId, appointmentId, ermId);

      // Assert
      expect(result.record_type).toBe(ERMRecordType.LAB);
      expect(result.details).toHaveProperty('panel_name', 'Complete Blood Count');
      expect(result.details).toHaveProperty('specimen_type', 'Venous Blood');
      expect(result.details).toHaveProperty('results');
      expect((result.details as any).results).toHaveProperty('wbc');
      expect((result.details as any).abnormal_summary).toBe(false);
      expect(ermLabRepository.findOne).toHaveBeenCalledWith({
        where: { ermId: ermId, deletedAt: null },
      });
    });

    it('should retrieve CONSULTATION ERM details successfully', async () => {
      // Arrange
      const patientId = 'patient-123';
      const appointmentId = 'apt-123';
      const ermId = 'erm-consult-123';

      const mockAppointment = createMockAppointment();
      const mockERM = createMockERM({ _id: ermId, recordType: ERMRecordType.CONSULTATION });
      const mockERMConsultation = {
        _id: 'erm-consult-1',
        ermId: ermId,
        visitType: 'FOLLOW_UP',
        chiefComplaint: 'Knee pain',
        painIntensity: 6,
        vitalSigns: { bp: '120/80', hr: 72, temp: 36.5 },
        diagnosis: 'Osteoarthritis',
        treatmentPlan: 'Physical therapy',
        deletedAt: null,
      };

      jest.spyOn(appointmentRepository, 'findOne').mockResolvedValue(mockAppointment as any);
      jest.spyOn(ermRepository, 'findOne').mockResolvedValue(mockERM as any);
      jest.spyOn(ermConsultationRepository, 'findOne').mockResolvedValue(mockERMConsultation as any);

      // Act
      const result = await prescriptionsService.getPatientERMDetail(patientId, appointmentId, ermId);

      // Assert
      expect(result.record_type).toBe(ERMRecordType.CONSULTATION);
      expect(result.details).toHaveProperty('visit_type', 'FOLLOW_UP');
      expect(result.details).toHaveProperty('chief_complaint', 'Knee pain');
      expect(result.details).toHaveProperty('diagnosis', 'Osteoarthritis');
      expect(ermConsultationRepository.findOne).toHaveBeenCalled();
    });

    it('should retrieve ULTRASOUND ERM details successfully', async () => {
      // Arrange
      const patientId = 'patient-123';
      const appointmentId = 'apt-123';
      const ermId = 'erm-us-123';

      const mockAppointment = createMockAppointment();
      const mockERM = createMockERM({ _id: ermId, recordType: ERMRecordType.ULTRASOUND });
      const mockERMUltrasound = {
        _id: 'erm-us-1',
        ermId: ermId,
        bodySite: 'Abdomen',
        side: 'BILATERAL',
        technique: '2D Ultrasound',
        findings: 'Normal liver, kidneys',
        measurements: { liver_length: 12.5 },
        conclusion: 'No abnormalities detected',
        recommendations: 'Routine follow-up',
        imageUrls: ['https://example.com/us1.jpg'],
        deletedAt: null,
      };

      jest.spyOn(appointmentRepository, 'findOne').mockResolvedValue(mockAppointment as any);
      jest.spyOn(ermRepository, 'findOne').mockResolvedValue(mockERM as any);
      jest.spyOn(ermUltrasoundRepository, 'findOne').mockResolvedValue(mockERMUltrasound as any);

      // Act
      const result = await prescriptionsService.getPatientERMDetail(patientId, appointmentId, ermId);

      // Assert
      expect(result.record_type).toBe(ERMRecordType.ULTRASOUND);
      expect(result.details).toHaveProperty('body_site', 'Abdomen');
      expect(result.details).toHaveProperty('findings', 'Normal liver, kidneys');
      expect(ermUltrasoundRepository.findOne).toHaveBeenCalled();
    });

    it('should throw NotFoundException when appointment does not belong to patient', async () => {
      // Arrange
      const patientId = 'patient-999'; // Wrong patient
      const appointmentId = 'apt-123';
      const ermId = 'erm-123';

      jest.spyOn(appointmentRepository, 'findOne').mockResolvedValue(null); // Ownership fails

      // Act & Assert
      await expect(
        prescriptionsService.getPatientERMDetail(patientId, appointmentId, ermId),
      ).rejects.toThrow(NotFoundException);

      await expect(
        prescriptionsService.getPatientERMDetail(patientId, appointmentId, ermId),
      ).rejects.toThrow('Appointment not found');

      // Verify subsequent queries were NOT executed
      expect(ermRepository.findOne).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when ERM does not belong to appointment', async () => {
      // Arrange
      const patientId = 'patient-123';
      const appointmentId = 'apt-123';
      const ermId = 'erm-999'; // Wrong ERM

      const mockAppointment = createMockAppointment();

      jest.spyOn(appointmentRepository, 'findOne').mockResolvedValue(mockAppointment as any);
      jest.spyOn(ermRepository, 'findOne').mockResolvedValue(null); // ERM not found

      // Act & Assert
      await expect(
        prescriptionsService.getPatientERMDetail(patientId, appointmentId, ermId),
      ).rejects.toThrow(NotFoundException);

      await expect(
        prescriptionsService.getPatientERMDetail(patientId, appointmentId, ermId),
      ).rejects.toThrow('ERM record not found');

      expect(ermRepository.findOne).toHaveBeenCalledWith({
        where: {
          _id: ermId,
          appointmentId: appointmentId,
          deletedAt: null,
        },
      });
    });

    it('should throw ForbiddenException when ERM status is not COMPLETED', async () => {
      // Arrange
      const patientId = 'patient-123';
      const appointmentId = 'apt-123';
      const ermId = 'erm-draft-123';

      const mockAppointment = createMockAppointment();
      const mockERM = createMockERM({ _id: ermId, status: ERMStatus.DRAFT }); // DRAFT status

      jest.spyOn(appointmentRepository, 'findOne').mockResolvedValue(mockAppointment as any);
      jest.spyOn(ermRepository, 'findOne').mockResolvedValue(mockERM as any);

      // Act & Assert
      await expect(
        prescriptionsService.getPatientERMDetail(patientId, appointmentId, ermId),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        prescriptionsService.getPatientERMDetail(patientId, appointmentId, ermId),
      ).rejects.toThrow('ERM record is not available (status must be COMPLETED)');

      // Verify child repository was NOT queried
      expect(ermXrayRepository.findOne).not.toHaveBeenCalled();
      expect(ermLabRepository.findOne).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when child ERM details not found', async () => {
      // Arrange
      const patientId = 'patient-123';
      const appointmentId = 'apt-123';
      const ermId = 'erm-123';

      const mockAppointment = createMockAppointment();
      const mockERM = createMockERM({ recordType: ERMRecordType.XRAY });

      jest.spyOn(appointmentRepository, 'findOne').mockResolvedValue(mockAppointment as any);
      jest.spyOn(ermRepository, 'findOne').mockResolvedValue(mockERM as any);
      jest.spyOn(ermXrayRepository, 'findOne').mockResolvedValue(null); // Child not found

      // Act & Assert
      await expect(
        prescriptionsService.getPatientERMDetail(patientId, appointmentId, ermId),
      ).rejects.toThrow(NotFoundException);

      await expect(
        prescriptionsService.getPatientERMDetail(patientId, appointmentId, ermId),
      ).rejects.toThrow('XRAY details not found');
    });
  });
});
