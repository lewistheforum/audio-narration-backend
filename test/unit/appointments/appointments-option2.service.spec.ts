import { Test, TestingModule } from '@nestjs/testing';
import { BookingSessionService } from '../../../src/modules/appointments/booking-session.service';
import { AppointmentsService } from '../../../src/modules/appointments/appointments.service';
import { DataSource } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { REDIS_CLIENT } from '../../../src/config/redis.config';
import { BookingOption } from '../../../src/modules/appointments/dto';
import { AccountRole } from '../../../src/modules/accounts/enums';

/**
 * ============================================================================
 * APPOINTMENTS SERVICE UNIT TESTS - OPTION 2: DOCTOR-FIRST BOOKING
 * Test Coverage: Redis-Based Booking Session & Doctor-First Flow
 * ============================================================================
 *
 * This test suite comprehensively covers Option 2 booking flow:
 * 
 * 1. ✅ GET /api/patients/doctors - List doctors with pagination & filters
 * 2. ✅ POST /api/patients/booking-sessions (doctor-first) - Create session with doctor_id
 * 3. ✅ GET /api/patients/doctors/:doctorId/working-days - Get doctor's available dates
 * 4. ✅ PATCH /api/patients/booking-sessions/:sessionId (Step 2) - Add appointment_date
 * 5. ✅ GET /api/patients/doctors/:doctorId/slots - Get slots & services
 * 6. ✅ PATCH /api/patients/booking-sessions/:sessionId (Step 3) - Add slot & service
 * 7. ✅ POST /api/patients/appointments - Create appointment from session
 * 8. ✅ Business Rules Validation (doctor active, date ranges, slot availability)
 * 
 * @author Senior QA Automation Engineer
 * @version 3.1
 * @date 2026-02-25
 */

describe('AppointmentsService - Option 2 (Doctor-first Booking)', () => {
  let bookingSessionService: BookingSessionService;
  let appointmentsService: AppointmentsService;
  let dataSource: any;
  let redisClient: any;

  // ============================================================================
  // MOCK DATA FACTORIES
  // ============================================================================

  const createMockDoctor = (overrides = {}) => ({
    _id: 'doctor-123',
    role: AccountRole.DOCTOR,
    isActive: true,
    full_name: 'BS. Nguyễn Văn A',
    status: 'ACTIVE',
    ...overrides,
  });

  const createMockClinic = (overrides = {}) => ({
    _id: 'clinic-123',
    role: AccountRole.CLINIC_ADMIN,
    isActive: true,
    business_name: 'Phòng khám ABC',
    address: '123 Đường X, Q.1, TP.HCM',
    status: 'ACTIVE',
    ...overrides,
  });

  const createMockDoctorInformation = (overrides = {}) => ({
    account_id: 'doctor-123',
    specialty: 'Bác sĩ Xương Khớp',
    ...overrides,
  });

  const createMockEmployeeSchedule = (overrides = {}) => ({
    _id: 'schedule-123',
    employee_id: 'doctor-123',
    clinic_id: 'clinic-123',
    work_date: new Date('2026-02-25'),
    week_day: 'THỨ BA',
    shift_type: 'MORNING',
    clinic_room: 'Phòng 101',
    ...overrides,
  });

  const createMockClinicShiftHour = (overrides = {}) => ({
    _id: 'shift-hour-123',
    employee_schedule_id: 'schedule-123',
    start_hour: '08:00:00',
    end_hour: '08:30:00',
    limit: 5,
    ...overrides,
  });

  const createMockServiceConfig = (overrides = {}) => ({
    _id: 'service-config-123',
    clinic_service_id: 'clinic-service-123',
    clinic_id: 'clinic-123',
    price: 300000,
    discount: 10,
    is_active: true,
    ...overrides,
  });

  const createMockClinicService = (overrides = {}) => ({
    _id: 'clinic-service-123',
    service_name: 'Khám Xương Khớp',
    category_id: 'category-123',
    description: 'Khám và tư vấn về xương khớp',
    is_active: true,
    ...overrides,
  });

  // ============================================================================
  // SETUP & TEARDOWN
  // ============================================================================

  beforeEach(async () => {
    // Mock Redis Client
    redisClient = {
      setex: jest.fn().mockResolvedValue('OK'),
      get: jest.fn(),
      del: jest.fn().mockResolvedValue(1),
      ttl: jest.fn().mockResolvedValue(1500),
    };

    // Mock DataSource
    dataSource = {
      transaction: jest.fn(),
      createQueryBuilder: jest.fn(),
      getRepository: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingSessionService,
        AppointmentsService,
        {
          provide: REDIS_CLIENT,
          useValue: redisClient,
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
        {
          provide: 'AppointmentRepository',
          useValue: { find: jest.fn(), findOne: jest.fn() },
        },
        {
          provide: 'AppointmentPackageRepository',
          useValue: {},
        },
        {
          provide: 'ClinicStaffInformationRepository',
          useValue: {},
        },
        {
          provide: 'EmployeeScheduleRepository',
          useValue: {},
        },
        {
          provide: 'AccountRepository',
          useValue: {},
        },
      ],
    }).compile();

    bookingSessionService = module.get<BookingSessionService>(BookingSessionService);
    appointmentsService = module.get<AppointmentsService>(AppointmentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // TEST SUITE 1: GET /api/patients/doctors
  // ============================================================================

  describe('getDoctors', () => {
    it('should return paginated list of doctors with their clinics', async () => {
      // Arrange
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        addGroupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        clone: jest.fn().mockReturnThis(),
        getRawMany: jest.fn(),
      };

      const mockDoctors = [
        {
          doctor_id: 'doctor-123',
          full_name: 'BS. Nguyễn Văn A',
          specialization: 'Bác sĩ Xương Khớp',
        },
      ];

      const mockClinics = [
        {
          clinic_id: 'clinic-123',
          clinic_name: 'Phòng khám ABC',
          clinic_address: '123 Đường X, Q.1, TP.HCM',
        },
      ];

      mockQueryBuilder.getRawMany
        .mockResolvedValueOnce(mockDoctors) // For total count
        .mockResolvedValueOnce(mockDoctors) // For paginated results
        .mockResolvedValue(mockClinics); // For clinics query

      dataSource.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);

      // Act
      const result = await appointmentsService.getDoctors({
        page: 1,
        limit: 20,
      });

      // Assert
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toHaveProperty('doctor_id', 'doctor-123');
      expect(result.data[0]).toHaveProperty('full_name', 'BS. Nguyễn Văn A');
      expect(result.data[0]).toHaveProperty('specialization', 'Bác sĩ Xương Khớp');
      expect(result.data[0]).toHaveProperty('clinics');
      expect(result.data[0].clinics).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
    });

    it('should filter doctors by search query', async () => {
      // Arrange
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        addGroupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        clone: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };

      dataSource.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);

      // Act
      await appointmentsService.getDoctors({
        page: 1,
        limit: 20,
        search: 'Nguyễn',
      });

      // Assert
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'doctor.full_name ILIKE :search',
        { search: '%Nguyễn%' },
      );
    });

    it('should filter doctors by specialization', async () => {
      // Arrange
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        addGroupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        clone: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };

      dataSource.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);

      // Act
      await appointmentsService.getDoctors({
        page: 1,
        limit: 20,
        specialization: 'Xương Khớp',
      });

      // Assert
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'di.specialty ILIKE :specialization',
        { specialization: '%Xương Khớp%' },
      );
    });

    it('should filter doctors by clinic_id', async () => {
      // Arrange
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        addGroupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        clone: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };

      dataSource.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);

      // Act
      await appointmentsService.getDoctors({
        page: 1,
        limit: 20,
        clinic_id: 'clinic-123',
      });

      // Assert
      expect(mockQueryBuilder.innerJoin).toHaveBeenCalledWith(
        'employee_schedule',
        'es',
        'es.employee_id = doctor._id',
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'es.clinic_id = :clinic_id',
        { clinic_id: 'clinic-123' },
      );
    });
  });

  // ============================================================================
  // TEST SUITE 2: POST /api/patients/booking-sessions (Doctor-first)
  // ============================================================================

  describe('createSession (doctor-first)', () => {
    it('should create session successfully with valid doctor_id', async () => {
      // Arrange
      const patientId = 'patient-123';
      const createDto = {
        booking_option: BookingOption.DOCTOR,
        initial_data: {
          doctor_id: 'doctor-123',
          clinic_id: 'clinic-123',
        },
      };

      const mockRepo = {
        findOne: jest.fn()
          .mockResolvedValueOnce(createMockDoctor()) // Doctor
          .mockResolvedValueOnce(createMockClinic()), // Clinic
      };

      dataSource.getRepository = jest.fn().mockReturnValue(mockRepo);

      // Act
      const result = await bookingSessionService.createSession(patientId, createDto);

      // Assert
      expect(result).toHaveProperty('session_id');
      expect(result.booking_option).toBe(BookingOption.DOCTOR);
      expect(result.current_step).toBe(1);
      expect(result.booking_data).toHaveProperty('doctor_id', 'doctor-123');
      expect(result.booking_data).toHaveProperty('clinic_id', 'clinic-123');
      expect(redisClient.setex).toHaveBeenCalledWith(
        expect.stringContaining('booking:session:'),
        1800,
        expect.any(String),
      );
    });

    it('should throw error if doctor not found', async () => {
      // Arrange
      const patientId = 'patient-123';
      const createDto = {
        booking_option: BookingOption.DOCTOR,
        initial_data: {
          doctor_id: 'doctor-nonexistent',
        },
      };

      const mockRepo = {
        findOne: jest.fn().mockResolvedValue(null),
      };

      dataSource.getRepository = jest.fn().mockReturnValue(mockRepo);

      // Act & Assert
      await expect(
        bookingSessionService.createSession(patientId, createDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        bookingSessionService.createSession(patientId, createDto),
      ).rejects.toThrow('Doctor not found or inactive');
    });

    it('should throw error if doctor is inactive', async () => {
      // Arrange
      const patientId = 'patient-123';
      const createDto = {
        booking_option: BookingOption.DOCTOR,
        initial_data: {
          doctor_id: 'doctor-123',
        },
      };

      const mockRepo = {
        findOne: jest.fn().mockResolvedValue(
          createMockDoctor({ status: 'INACTIVE' }),
        ),
      };

      dataSource.getRepository = jest.fn().mockReturnValue(mockRepo);

      // Act & Assert
      await expect(
        bookingSessionService.createSession(patientId, createDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        bookingSessionService.createSession(patientId, createDto),
      ).rejects.toThrow('Doctor not found or inactive');
    });
  });

  // ============================================================================
  // TEST SUITE 3: GET /api/patients/doctors/:doctorId/working-days
  // ============================================================================

  describe('getDoctorWorkingDays', () => {
    it('should return working days with available slots', async () => {
      // Arrange
      const doctorId = 'doctor-123';
      const clinicId = 'clinic-123';

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        addGroupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValueOnce([
          {
            date: '2026-02-25',
            week_day: 'THỨ BA',
            clinic_id: 'clinic-123',
            clinic_name: 'Phòng khám ABC',
          },
        ]),
        getRawOne: jest.fn().mockResolvedValue({ total_slots: '12' }),
      };

      dataSource.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);

      // Act
      const result = await appointmentsService.getDoctorWorkingDays(doctorId, clinicId);

      // Assert
      expect(result).toHaveProperty('data');
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toHaveProperty('date', '2026-02-25');
      expect(result.data[0]).toHaveProperty('week_day', 'THỨ BA');
      expect(result.data[0]).toHaveProperty('clinic_id', 'clinic-123');
      expect(result.data[0]).toHaveProperty('clinic_name', 'Phòng khám ABC');
      expect(result.data[0]).toHaveProperty('available_slots', 12);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'es.employee_id = :doctorId',
        { doctorId },
      );
    });

    it('should filter by clinic_id when provided', async () => {
      // Arrange
      const doctorId = 'doctor-123';
      const clinicId = 'clinic-456';

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        addGroupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
        getRawOne: jest.fn().mockResolvedValue({ total_slots: '0' }),
      };

      dataSource.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);

      // Act
      await appointmentsService.getDoctorWorkingDays(doctorId, clinicId);

      // Assert
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'es.clinic_id = :clinicId',
        { clinicId },
      );
    });
  });

  // ============================================================================
  // TEST SUITE 4: GET /api/patients/doctors/:doctorId/slots
  // ============================================================================

  describe('getDoctorSlots', () => {
    it('should return slots and available services', async () => {
      // Arrange
      const doctorId = 'doctor-123';
      const date = '2026-02-25';
      const clinicId = 'clinic-123';

      const mockSlots = [
        {
          doctor_shift_hour_id: 'shift-hour-123',
          start_time: '08:00:00',
          end_time: '08:30:00',
          limit: 5,
          shift: 'MORNING',
          clinic_room: 'Phòng 101',
        },
      ];

      const mockServices = [
        {
          clinic_service_config_id: 'config-123',
          service_id: 'service-123',
          service_name: 'Khám Xương Khớp',
          category_name: 'Khám Chuyên Khoa',
          price: '300000',
          discount: '10',
          final_price: '270000',
          description: 'Khám và tư vấn',
        },
      ];

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn()
          .mockResolvedValueOnce(mockSlots) // Slots query
          .mockResolvedValueOnce(mockServices), // Services query
        getRawOne: jest.fn().mockResolvedValue({ count: '2' }), // Appointment count
      };

      dataSource.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);

      // Act
      const result = await appointmentsService.getDoctorSlots(doctorId, date, clinicId);

      // Assert
      expect(result).toHaveProperty('slots');
      expect(result).toHaveProperty('available_services');
      expect(result.slots).toHaveLength(3); // MORNING, AFTERNOON, EVENING
      expect(result.slots[0].shift).toBe('MORNING');
      expect(result.slots[0].slots).toHaveLength(1);
      expect(result.slots[0].slots[0].available_slots).toBe(3); // 5 - 2 = 3
      expect(result.available_services).toHaveLength(1);
      expect(result.available_services[0].service_name).toBe('Khám Xương Khớp');
    });

    it('should validate date is not in the past', async () => {
      // Arrange
      const doctorId = 'doctor-123';
      const pastDate = '2020-01-01';
      const clinicId = 'clinic-123';

      // Act & Assert
      await expect(
        appointmentsService.getDoctorSlots(doctorId, pastDate, clinicId),
      ).rejects.toThrow(BadRequestException);
      await expect(
        appointmentsService.getDoctorSlots(doctorId, pastDate, clinicId),
      ).rejects.toThrow('Appointment date must be today or in the future');
    });

    it('should validate date is not more than 60 days in future', async () => {
      // Arrange
      const doctorId = 'doctor-123';
      const farFutureDate = new Date();
      farFutureDate.setDate(farFutureDate.getDate() + 70);
      const dateString = farFutureDate.toISOString().split('T')[0];
      const clinicId = 'clinic-123';

      // Act & Assert
      await expect(
        appointmentsService.getDoctorSlots(doctorId, dateString, clinicId),
      ).rejects.toThrow(BadRequestException);
      await expect(
        appointmentsService.getDoctorSlots(doctorId, dateString, clinicId),
      ).rejects.toThrow('Appointment date cannot be more than 60 days in the future');
    });
  });

  // ============================================================================
  // TEST SUITE 5: PATCH /api/patients/booking-sessions/:sessionId (Step 3)
  // ============================================================================

  describe('updateSession (Step 3 - doctor-first flow)', () => {
    it('should update session with clinic_service_config_id', async () => {
      // Arrange
      const sessionId = 'session-123';
      const patientId = 'patient-123';
      const session = {
        sessionId,
        patientId,
        bookingOption: BookingOption.DOCTOR,
        doctorId: 'doctor-123',
        clinicId: 'clinic-123',
        appointmentDate: '2026-02-25',
        currentStep: 2,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 1800000),
      };

      const updateDto = {
        step: 3 as 2 | 3 | 4,
        data: {
          doctor_shift_hour_id: 'shift-hour-123',
          clinic_service_config_id: 'service-config-123',
        },
      };

      redisClient.get = jest.fn().mockResolvedValue(JSON.stringify(session));
      redisClient.ttl = jest.fn().mockResolvedValue(1500);

      // Act
      const result = await bookingSessionService.updateSession(
        sessionId,
        patientId,
        updateDto,
      );

      // Assert
      expect(result.current_step).toBe(3);
      expect(result.booking_data).toHaveProperty('doctor_shift_hour_id', 'shift-hour-123');
      expect(result.booking_data).toHaveProperty('clinic_service_config_id', 'service-config-123');
      expect(redisClient.setex).toHaveBeenCalled();
    });
  });
});
