import { Test, TestingModule } from '@nestjs/testing';
import { BookingSessionService } from '../../../src/modules/appointments/booking-session.service';
import { AppointmentsService } from '../../../src/modules/appointments/appointments.service';
import { DataSource } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { REDIS_CLIENT } from '../../../src/config/redis.config';
import { BookingOption } from '../../../src/modules/appointments/dto';

/**
 * ============================================================================
 * APPOINTMENTS SERVICE UNIT TESTS - OPTION 3 (DATE-FIRST BOOKING)
 * Test Coverage: Redis-Based Booking Session for Date-First Flow
 * ============================================================================
 *
 * This test suite covers Option 3: Date-first booking flow
 * 
 * Flow: NGÀY → CHI NHÁNH → DỊCH VỤ → SLOT & BÁC SĨ → XÁC NHẬN
 * 
 * Test Scenarios:
 * 1. ✅ Create booking session with appointment_date (Step 1)
 * 2. ✅ Update session with clinic_id (Step 2)
 * 3. ✅ Update session with clinic_service_config_id (Step 3)
 * 4. ✅ Update session with doctor_shift_hour_id + doctor_id (Step 4)
 * 5. ✅ Get clinics by working date with pagination and filters
 * 6. ✅ Validate date ranges (today to +60 days)
 * 7. ✅ Filter clinics with available slots only
 * 8. ✅ Error handling for invalid dates and missing data
 * 
 * @author Senior Backend Developer & QA Automation Engineer
 * @version 3.1
 * @date 2026-02-25
 */

describe('AppointmentsService - Option 3 (Date-first Booking)', () => {
  let bookingSessionService: BookingSessionService;
  let appointmentsService: AppointmentsService;
  let dataSource: any;
  let redisClient: any;

  // ============================================================================
  // MOCK DATA
  // ============================================================================

  const mockPatientId = 'patient-123';
  const mockAppointmentDate = '2026-02-25';
  const mockClinicId = 'clinic-123';
  const mockServiceConfigId = 'service-config-123';
  const mockDoctorShiftHourId = 'shift-hour-123';
  const mockDoctorId = 'doctor-123';

  const createMockSession = (overrides = {}) => ({
    sessionId: 'session-123',
    patientId: mockPatientId,
    bookingOption: BookingOption.DATE,
    appointmentDate: mockAppointmentDate,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    currentStep: 1,
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
      getRepository: jest.fn(),
      createQueryBuilder: jest.fn(),
      transaction: jest.fn(),
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
          useValue: {},
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
  // TEST SUITE: OPTION 3 BOOKING FLOW
  // ============================================================================

  describe('Step 1: Create Booking Session with Date', () => {
    it('should create session with valid appointment_date', async () => {
      const createDto = {
        booking_option: BookingOption.DATE,
        initial_data: {
          appointment_date: mockAppointmentDate,
        },
      };

      const result = await bookingSessionService.createSession(
        mockPatientId,
        createDto,
      );

      expect(result).toHaveProperty('session_id');
      expect(result.booking_option).toBe(BookingOption.DATE);
      expect(result.current_step).toBe(1);
      expect(result.booking_data).toHaveProperty('appointment_date', mockAppointmentDate);
      expect(redisClient.setex).toHaveBeenCalledWith(
        expect.stringContaining('booking:session:'),
        1800,
        expect.any(String),
      );
    });

    it('should reject date in the past', async () => {
      const createDto = {
        booking_option: BookingOption.DATE,
        initial_data: {
          appointment_date: '2025-01-01',
        },
      };

      await expect(
        bookingSessionService.createSession(mockPatientId, createDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        bookingSessionService.createSession(mockPatientId, createDto),
      ).rejects.toThrow('Appointment date must be today or in the future');
    });

    it('should reject date more than 60 days in future', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 61);
      const createDto = {
        booking_option: BookingOption.DATE,
        initial_data: {
          appointment_date: futureDate.toISOString().split('T')[0],
        },
      };

      await expect(
        bookingSessionService.createSession(mockPatientId, createDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        bookingSessionService.createSession(mockPatientId, createDto),
      ).rejects.toThrow('cannot be more than 60 days in the future');
    });
  });

  describe('Step 2: Update Session with Clinic ID', () => {
    it('should update session with clinic_id', async () => {
      const mockSession = createMockSession();
      redisClient.get.mockResolvedValue(JSON.stringify(mockSession));

      const updateDto = {
        step: 2 as 2,
        data: {
          clinic_id: mockClinicId,
        } as any,
      };

      const result = await bookingSessionService.updateSession(
        mockSession.sessionId,
        mockPatientId,
        updateDto,
      );

      expect(result.current_step).toBe(2);
      expect(result.booking_data).toHaveProperty('clinic_id', mockClinicId);
      expect(result.booking_data).toHaveProperty('appointment_date', mockAppointmentDate);
      expect(redisClient.setex).toHaveBeenCalled();
    });

    it('should reject invalid step sequence', async () => {
      const mockSession = createMockSession();
      redisClient.get.mockResolvedValue(JSON.stringify(mockSession));

      const updateDto = {
        step: 3 as 3, // Skipping step 2
        data: {
          clinic_service_config_id: mockServiceConfigId,
        } as any,
      };

      await expect(
        bookingSessionService.updateSession(
          mockSession.sessionId,
          mockPatientId,
          updateDto,
        ),
      ).rejects.toThrow(BadRequestException);
      await expect(
        bookingSessionService.updateSession(
          mockSession.sessionId,
          mockPatientId,
          updateDto,
        ),
      ).rejects.toThrow('Invalid step sequence');
    });
  });

  describe('Step 3: Update Session with Service Config ID', () => {
    it('should update session with clinic_service_config_id', async () => {
      const mockSession = createMockSession({
        currentStep: 2,
        clinicId: mockClinicId,
      });
      redisClient.get.mockResolvedValue(JSON.stringify(mockSession));

      const updateDto = {
        step: 3 as 3,
        data: {
          clinic_service_config_id: mockServiceConfigId,
        } as any,
      };

      const result = await bookingSessionService.updateSession(
        mockSession.sessionId,
        mockPatientId,
        updateDto,
      );

      expect(result.current_step).toBe(3);
      expect(result.booking_data).toHaveProperty('clinic_service_config_id', mockServiceConfigId);
      expect(result.booking_data).toHaveProperty('clinic_id', mockClinicId);
      expect(result.booking_data).toHaveProperty('appointment_date', mockAppointmentDate);
    });
  });

  describe('Step 4: Update Session with Slot and Doctor', () => {
    it('should update session with doctor_shift_hour_id and doctor_id', async () => {
      const mockSession = createMockSession({
        currentStep: 3,
        clinicId: mockClinicId,
        clinicServiceConfigId: mockServiceConfigId,
      });
      redisClient.get.mockResolvedValue(JSON.stringify(mockSession));

      const updateDto = {
        step: 4 as 4,
        data: {
          doctor_shift_hour_id: mockDoctorShiftHourId,
          doctor_id: mockDoctorId,
        } as any,
      };

      const result = await bookingSessionService.updateSession(
        mockSession.sessionId,
        mockPatientId,
        updateDto,
      );

      expect(result.current_step).toBe(4);
      expect(result.booking_data).toHaveProperty('doctor_shift_hour_id', mockDoctorShiftHourId);
      expect(result.booking_data).toHaveProperty('doctor_id', mockDoctorId);
      expect(result.booking_data).toHaveProperty('clinic_service_config_id', mockServiceConfigId);
      expect(result.booking_data).toHaveProperty('clinic_id', mockClinicId);
      expect(result.booking_data).toHaveProperty('appointment_date', mockAppointmentDate);
    });
  });

  describe('GET /api/patients/clinics - Get Clinics by Working Date', () => {
    it('should return paginated clinics with available slots', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        getRawMany: jest.fn(),
        getRawOne: jest.fn(),
      };

      // Mock clinic results
      mockQueryBuilder.getRawMany.mockResolvedValueOnce([
        {
          clinic_id: 'clinic-1',
          clinic_name: 'Phòng khám A',
          clinic_address: '123 Street',
          district: 'District 1',
        },
        {
          clinic_id: 'clinic-2',
          clinic_name: 'Phòng khám B',
          clinic_address: '456 Avenue',
          district: 'District 2',
        },
      ]);

      // Mock slots and doctors count for each clinic
      mockQueryBuilder.getRawOne
        .mockResolvedValueOnce({ total_slots: '20', doctor_count: '3' })
        .mockResolvedValueOnce({ booked_count: '5' })
        .mockResolvedValueOnce({ total_slots: '15', doctor_count: '2' })
        .mockResolvedValueOnce({ booked_count: '3' });

      dataSource.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await appointmentsService.getClinicsByWorkingDate({
        working_date: mockAppointmentDate,
        page: 1,
        limit: 20,
      });

      expect(result).toHaveProperty('data');
      expect(result.data).toBeInstanceOf(Array);
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('page', 1);
      expect(result).toHaveProperty('limit', 20);
      expect(dataSource.createQueryBuilder).toHaveBeenCalled();
    });

    it('should filter clinics by search term', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };

      dataSource.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await appointmentsService.getClinicsByWorkingDate({
        working_date: mockAppointmentDate,
        page: 1,
        limit: 20,
        search: 'Medicare',
      });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'clinic.full_name ILIKE :search',
        { search: '%Medicare%' },
      );
    });

    it('should filter clinics by district', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };

      dataSource.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await appointmentsService.getClinicsByWorkingDate({
        working_date: mockAppointmentDate,
        page: 1,
        limit: 20,
        district: 'Quận 1',
      });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'addr.district ILIKE :district',
        { district: '%Quận 1%' },
      );
    });

    it('should reject invalid working date (past)', async () => {
      await expect(
        appointmentsService.getClinicsByWorkingDate({
          working_date: '2025-01-01',
          page: 1,
          limit: 20,
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        appointmentsService.getClinicsByWorkingDate({
          working_date: '2025-01-01',
          page: 1,
          limit: 20,
        }),
      ).rejects.toThrow('Working date must be today or in the future');
    });

    it('should reject working date more than 60 days in future', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 61);

      await expect(
        appointmentsService.getClinicsByWorkingDate({
          working_date: futureDate.toISOString().split('T')[0],
          page: 1,
          limit: 20,
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        appointmentsService.getClinicsByWorkingDate({
          working_date: futureDate.toISOString().split('T')[0],
          page: 1,
          limit: 20,
        }),
      ).rejects.toThrow('cannot be more than 60 days in the future');
    });
  });

  describe('Session Ownership & Security', () => {
    it('should reject update from different patient', async () => {
      const mockSession = createMockSession();
      redisClient.get.mockResolvedValue(JSON.stringify(mockSession));

      const updateDto = {
        step: 2 as 2,
        data: {
          clinic_id: mockClinicId,
        } as any,
      };

      await expect(
        bookingSessionService.updateSession(
          mockSession.sessionId,
          'different-patient-id',
          updateDto,
        ),
      ).rejects.toThrow('You do not have permission to access this session');
    });

    it('should reject expired session', async () => {
      redisClient.get.mockResolvedValue(null);

      const updateDto = {
        step: 2 as 2,
        data: {
          clinic_id: mockClinicId,
        } as any,
      };

      await expect(
        bookingSessionService.updateSession(
          'expired-session-id',
          mockPatientId,
          updateDto,
        ),
      ).rejects.toThrow(NotFoundException);
      await expect(
        bookingSessionService.updateSession(
          'expired-session-id',
          mockPatientId,
          updateDto,
        ),
      ).rejects.toThrow('Booking session not found or expired');
    });
  });

  describe('Complete Option 3 Flow Integration', () => {
    it('should complete full Option 3 booking flow (Steps 1-4)', async () => {
      // Step 1: Create session with date
      const createDto = {
        booking_option: BookingOption.DATE,
        initial_data: {
          appointment_date: mockAppointmentDate,
        },
      };

      const step1Result = await bookingSessionService.createSession(
        mockPatientId,
        createDto,
      );

      expect(step1Result.current_step).toBe(1);
      expect(step1Result.booking_data).toHaveProperty('appointment_date', mockAppointmentDate);

      const sessionId = step1Result.session_id;

      // Step 2: Add clinic
      let mockSession = createMockSession({ sessionId });
      redisClient.get.mockResolvedValue(JSON.stringify(mockSession));

      const step2Result = await bookingSessionService.updateSession(
        sessionId,
        mockPatientId,
        {
          step: 2 as 2,
          data: { clinic_id: mockClinicId } as any,
        },
      );

      expect(step2Result.current_step).toBe(2);
      expect(step2Result.booking_data).toHaveProperty('clinic_id', mockClinicId);

      // Step 3: Add service
      mockSession = createMockSession({
        sessionId,
        currentStep: 2,
        clinicId: mockClinicId,
      });
      redisClient.get.mockResolvedValue(JSON.stringify(mockSession));

      const step3Result = await bookingSessionService.updateSession(
        sessionId,
        mockPatientId,
        {
          step: 3 as 3,
          data: { clinic_service_config_id: mockServiceConfigId } as any,
        },
      );

      expect(step3Result.current_step).toBe(3);
      expect(step3Result.booking_data).toHaveProperty('clinic_service_config_id', mockServiceConfigId);

      // Step 4: Add slot and doctor
      mockSession = createMockSession({
        sessionId,
        currentStep: 3,
        clinicId: mockClinicId,
        clinicServiceConfigId: mockServiceConfigId,
      });
      redisClient.get.mockResolvedValue(JSON.stringify(mockSession));

      const step4Result = await bookingSessionService.updateSession(
        sessionId,
        mockPatientId,
        {
          step: 4 as 4,
          data: {
            doctor_shift_hour_id: mockDoctorShiftHourId,
            doctor_id: mockDoctorId,
          } as any,
        },
      );

      expect(step4Result.current_step).toBe(4);
      expect(step4Result.booking_data).toHaveProperty('doctor_shift_hour_id', mockDoctorShiftHourId);
      expect(step4Result.booking_data).toHaveProperty('doctor_id', mockDoctorId);

      // Verify all data is present
      const finalBookingData = step4Result.booking_data;
      expect(finalBookingData).toHaveProperty('appointment_date', mockAppointmentDate);
      expect(finalBookingData).toHaveProperty('clinic_id', mockClinicId);
      expect(finalBookingData).toHaveProperty('clinic_service_config_id', mockServiceConfigId);
      expect(finalBookingData).toHaveProperty('doctor_shift_hour_id', mockDoctorShiftHourId);
      expect(finalBookingData).toHaveProperty('doctor_id', mockDoctorId);
    });
  });
});
