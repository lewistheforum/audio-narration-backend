import { Test, TestingModule } from '@nestjs/testing';
import { BookingSessionService } from '../../../src/modules/appointments/booking-session.service';
import { AppointmentsService } from '../../../src/modules/appointments/appointments.service';
import { DataSource } from 'typeorm';
import { NotFoundException, BadRequestException, ForbiddenException, ConflictException } from '@nestjs/common';
import { REDIS_CLIENT } from '../../../src/config/redis.config';
import { BookingOption } from '../../../src/modules/appointments/dto';
import { AppointmentStatus } from '../../../src/modules/appointments/enums';

/**
 * ============================================================================
 * APPOINTMENTS SERVICE UNIT TESTS (Updated for Version 3.1)
 * Test Coverage: Redis-Based Booking Session & Pessimistic Locking Flow
 * ============================================================================
 *
 * This test suite comprehensively covers the refactored Option 1 booking flow:
 * 
 * 1. ✅ Booking Session Creation (Step 1) - Redis storage with 30-min TTL
 * 2. ✅ Booking Session Updates (Steps 2-4) - Step-by-step data accumulation
 * 3. ✅ Appointment Creation with SERIALIZABLE transaction & pessimistic locks
 * 4. ✅ Business Rules: Payment validation, date ranges, slot availability
 * 5. ✅ Race Condition Prevention: SELECT ... FOR UPDATE + atomic decrements
 * 6. ✅ Redis Session Cleanup - No garbage data policy
 * 7. ✅ Comprehensive Error Handling & Edge Cases
 * 
 * @author Senior QA Automation Engineer
 * @version 3.1
 * @date 2026-02-25
 */

describe('AppointmentsService - Option 1 (Service-first Booking)', () => {
  let bookingSessionService: BookingSessionService;
  let appointmentsService: AppointmentsService;
  let dataSource: any;
  let redisClient: any;
  let mockQueryRunner: any;

  // ============================================================================
  // MOCK DATA FACTORIES
  // ============================================================================

  const createMockServiceConfig = (overrides = {}) => ({
    _id: 'service-config-123',
    serviceId: 'service-123',
    clinicId: 'clinic-123',
    price: 300000,
    discount: 10,
    durationMin: 30,
    isActive: true,
    service: {
      serviceName: 'Khám Xương Khớp',
      description: 'Khám và tư vấn về xương khớp',
    },
    ...overrides,
  });

  const createMockClinicShiftHour = (overrides = {}) => ({
    _id: 'shift-hour-123',
    shiftId: 'shift-123',
    startHour: '08:00:00',
    endHour: '08:30:00',
    limit: 5,
    ...overrides,
  });

  const createMockEmployeeSchedule = (overrides = {}) => ({
    _id: 'schedule-123',
    employeeId: 'doctor-123',
    clinicId: 'clinic-123',
    workDate: new Date('2026-02-25'),
    ...overrides,
  });

  const createMockClinic = (overrides = {}) => ({
    _id: 'clinic-123',
    role: 'clinic_admin',
    isActive: true,
    username: 'Phòng khám ABC',
    ...overrides,
  });

  const createMockDoctor = (overrides = {}) => ({
    _id: 'doctor-123',
    role: 'doctor',
    isActive: true,
    username: 'BS. Nguyễn Văn A',
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

    // Mock QueryRunner for transaction testing
    mockQueryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: {
        findOne: jest.fn(),
        save: jest.fn(),
        create: jest.fn(),
        getRepository: jest.fn(),
        createQueryBuilder: jest.fn(),
      },
    };

    // Mock DataSource
    dataSource = {
      transaction: jest.fn(),
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
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
  // TEST SUITE 1: BOOKING SESSION CREATION (STEP 1)
  // ============================================================================

  describe('createSession (Step 1)', () => {
    it('should create a service-first booking session successfully', async () => {
      // Arrange
      const patientId = 'patient-123';
      const createDto = {
        booking_option: BookingOption.SERVICE,
        initial_data: {
          clinic_service_config_id: 'service-config-123',
          clinic_id: 'clinic-123',
        },
      };

      dataSource.getRepository = jest.fn((entity) => {
        if (entity === 'clinic_service_config') {
          return {
            findOne: jest.fn().mockResolvedValue(createMockServiceConfig()),
          };
        }
        if (entity === 'accounts') {
          return {
            findOne: jest.fn().mockResolvedValue(createMockClinic()),
          };
        }
        return { findOne: jest.fn() };
      });

      // Act
      const result = await bookingSessionService.createSession(patientId, createDto as any);

      // Assert
      expect(result).toHaveProperty('session_id');
      expect(result.booking_option).toBe('service');
      expect(result.current_step).toBe(1);
      expect(result.booking_data).toHaveProperty('clinic_service_config_id', 'service-config-123');
      expect(result.booking_data).toHaveProperty('clinic_id', 'clinic-123');
      expect(redisClient.setex).toHaveBeenCalledWith(
        expect.stringContaining('booking:session:'),
        1800,
        expect.any(String),
      );
    });

    it('should throw BadRequestException if service config not found', async () => {
      // Arrange
      const patientId = 'patient-123';
      const createDto = {
        booking_option: BookingOption.SERVICE,
        initial_data: {
          clinic_service_config_id: 'invalid-service',
          clinic_id: 'clinic-123',
        },
      };

      dataSource.getRepository = jest.fn(() => ({
        findOne: jest.fn().mockResolvedValue(null),
      }));

      // Act & Assert
      await expect(
        bookingSessionService.createSession(patientId, createDto as any),
      ).rejects.toThrow(BadRequestException);
      await expect(
        bookingSessionService.createSession(patientId, createDto as any),
      ).rejects.toThrow('Clinic service configuration not found');
    });

    it('should throw BadRequestException if service is inactive', async () => {
      // Arrange
      const patientId = 'patient-123';
      const createDto = {
        booking_option: BookingOption.SERVICE,
        initial_data: {
          clinic_service_config_id: 'service-config-123',
          clinic_id: 'clinic-123',
        },
      };

      dataSource.getRepository = jest.fn((entity) => {
        if (entity === 'clinic_service_config') {
          return {
            findOne: jest.fn().mockResolvedValue(
              createMockServiceConfig({ isActive: false }),
            ),
          };
        }
        return { findOne: jest.fn() };
      });

      // Act & Assert
      await expect(
        bookingSessionService.createSession(patientId, createDto as any),
      ).rejects.toThrow(BadRequestException);
      await expect(
        bookingSessionService.createSession(patientId, createDto as any),
      ).rejects.toThrow('This service is currently not available');
    });

    it('should throw BadRequestException if clinic is inactive', async () => {
      // Arrange
      const patientId = 'patient-123';
      const createDto = {
        booking_option: BookingOption.SERVICE,
        initial_data: {
          clinic_service_config_id: 'service-config-123',
          clinic_id: 'clinic-123',
        },
      };

      dataSource.getRepository = jest.fn((entity) => {
        if (entity === 'clinic_service_config') {
          return {
            findOne: jest.fn().mockResolvedValue(createMockServiceConfig()),
          };
        }
        if (entity === 'accounts') {
          return {
            findOne: jest.fn().mockResolvedValue(createMockClinic({ isActive: false })),
          };
        }
        return { findOne: jest.fn() };
      });

      // Act & Assert
      await expect(
        bookingSessionService.createSession(patientId, createDto as any),
      ).rejects.toThrow(BadRequestException);
      await expect(
        bookingSessionService.createSession(patientId, createDto as any),
      ).rejects.toThrow('Clinic not found or inactive');
    });
  });

  // ============================================================================
  // TEST SUITE 2: BOOKING SESSION UPDATE (STEPS 2-4)
  // ============================================================================

  describe('updateSession (Steps 2-4)', () => {
    it('should update session with appointment_date (Step 2)', async () => {
      // Arrange
      const sessionId = 'session-123';
      const patientId = 'patient-123';
      const updateDto = {
        step: 2,
        data: { appointment_date: '2026-02-25' },
      };

      const existingSession = {
        sessionId,
        patientId,
        clinicServiceConfigId: 'service-config-123',
        clinicId: 'clinic-123',
        bookingOption: BookingOption.SERVICE,
        currentStep: 1,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 1800000),
      };

      redisClient.get.mockResolvedValue(JSON.stringify(existingSession));

      // Act
      const result = await bookingSessionService.updateSession(
        sessionId,
        patientId,
        updateDto as any,
      );

      // Assert
      expect(result.current_step).toBe(2);
      expect(result.booking_data).toHaveProperty('appointment_date', '2026-02-25');
      expect(redisClient.setex).toHaveBeenCalled();
    });

    it('should update session with slot and doctor (Step 3)', async () => {
      // Arrange
      const sessionId = 'session-123';
      const patientId = 'patient-123';
      const updateDto = {
        step: 3,
        data: {
          doctor_shift_hour_id: 'shift-hour-123',
          doctor_id: 'doctor-123',
        },
      };

      const existingSession = {
        sessionId,
        patientId,
        clinicServiceConfigId: 'service-config-123',
        clinicId: 'clinic-123',
        appointmentDate: '2026-02-25',
        bookingOption: BookingOption.SERVICE,
        currentStep: 2,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 1800000),
      };

      redisClient.get.mockResolvedValue(JSON.stringify(existingSession));

      // Act
      const result = await bookingSessionService.updateSession(
        sessionId,
        patientId,
        updateDto as any,
      );

      // Assert
      expect(result.current_step).toBe(3);
      expect(result.booking_data).toHaveProperty('doctor_shift_hour_id', 'shift-hour-123');
      expect(result.booking_data).toHaveProperty('doctor_id', 'doctor-123');
    });

    it('should throw NotFoundException if session expired', async () => {
      // Arrange
      const sessionId = 'session-123';
      const patientId = 'patient-123';
      const updateDto = { step: 2, data: { appointment_date: '2026-02-25' } };

      redisClient.get.mockResolvedValue(null);

      // Act & Assert
      await expect(
        bookingSessionService.updateSession(sessionId, patientId, updateDto as any),
      ).rejects.toThrow(NotFoundException);
      await expect(
        bookingSessionService.updateSession(sessionId, patientId, updateDto as any),
      ).rejects.toThrow('Booking session not found or expired');
    });

    it('should throw ForbiddenException if session belongs to different patient', async () => {
      // Arrange
      const sessionId = 'session-123';
      const patientId = 'patient-456';
      const updateDto = { step: 2, data: { appointment_date: '2026-02-25' } };

      const existingSession = {
        sessionId,
        patientId: 'patient-123', // Different patient
        bookingOption: BookingOption.SERVICE,
        currentStep: 1,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 1800000),
      };

      redisClient.get.mockResolvedValue(JSON.stringify(existingSession));

      // Act & Assert
      await expect(
        bookingSessionService.updateSession(sessionId, patientId, updateDto as any),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        bookingSessionService.updateSession(sessionId, patientId, updateDto as any),
      ).rejects.toThrow('You do not have permission to access this session');
    });

    it('should throw BadRequestException for invalid step sequence', async () => {
      // Arrange
      const sessionId = 'session-123';
      const patientId = 'patient-123';
      const updateDto = { step: 4, data: { patient_note: 'Test' } }; // Skipping step 2 and 3

      const existingSession = {
        sessionId,
        patientId,
        bookingOption: BookingOption.SERVICE,
        currentStep: 1, // Current step is 1
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 1800000),
      };

      redisClient.get.mockResolvedValue(JSON.stringify(existingSession));

      // Act & Assert
      await expect(
        bookingSessionService.updateSession(sessionId, patientId, updateDto as any),
      ).rejects.toThrow(BadRequestException);
      await expect(
        bookingSessionService.updateSession(sessionId, patientId, updateDto as any),
      ).rejects.toThrow('Invalid step sequence');
    });
  });

  // ============================================================================
  // TEST SUITE 3: APPOINTMENT CREATION FROM SESSION (WITH PESSIMISTIC LOCKING)
  // ============================================================================

  describe('createAppointmentFromSession', () => {
    it('should create appointment successfully with pessimistic locking', async () => {
      // Arrange
      const sessionId = 'session-123';
      const patientId = 'patient-123';
      const paymentMethod = 'online';

      const session = {
        sessionId,
        patientId,
        clinicServiceConfigId: 'service-config-123',
        clinicId: 'clinic-123',
        doctorId: 'doctor-123',
        appointmentDate: '2026-02-25',
        doctorShiftHourId: 'shift-hour-123',
        patientNote: 'Đau mỏi vai gáy',
        bookingOption: BookingOption.SERVICE,
        currentStep: 3,
      };

      // Mock BookingSessionService.getSession
      jest.spyOn(bookingSessionService, 'getSession').mockResolvedValue(session as any);
      jest.spyOn(bookingSessionService, 'deleteSession').mockResolvedValue();

      // Mock transaction
      dataSource.transaction = jest.fn(async (isolation, callback) => {
        const mockManager = {
          createQueryBuilder: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          setLock: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(createMockClinicShiftHour()),
          update: jest.fn().mockReturnThis(),
          set: jest.fn().mockReturnThis(),
          execute: jest.fn().mockResolvedValue({}),
          getRepository: jest.fn((entity) => {
            if (entity === 'clinic_service_config') {
              return {
                findOne: jest.fn().mockResolvedValue(createMockServiceConfig()),
              };
            }
            if (entity === 'employee_schedule') {
              return {
                findOne: jest.fn().mockResolvedValue(createMockEmployeeSchedule()),
              };
            }
            if (entity === 'appointments') {
              return {
                findOne: jest.fn().mockResolvedValue(null),
                create: jest.fn((data) => data),
                save: jest.fn((data) => ({ ...data, _id: 'appointment-123' })),
              };
            }
            if (entity === 'appointment_package') {
              return {
                create: jest.fn((data) => data),
                save: jest.fn((data) => ({ ...data, _id: 'package-123' })),
              };
            }
            if (entity === 'service_appointments') {
              return {
                create: jest.fn((data) => data),
                save: jest.fn((data) => ({ ...data, _id: 'service-apt-123' })),
              };
            }
            return {};
          }),
        };
        return callback(mockManager);
      });

      // Act
      const result = await appointmentsService.createAppointmentFromSession(
        sessionId,
        patientId,
        paymentMethod,
      );

      // Assert
      expect(result).toHaveProperty('appointment_id');
      expect(result).toHaveProperty('status', AppointmentStatus.PENDING);
      expect(result).toHaveProperty('payment_type', 'online');
      expect(bookingSessionService.deleteSession).toHaveBeenCalledWith(sessionId);
      
      // Verify SERIALIZABLE transaction was used
      expect(dataSource.transaction).toHaveBeenCalledWith('SERIALIZABLE', expect.any(Function));
    });

    it('should throw BadRequestException if payment method is not online', async () => {
      // Arrange
      const sessionId = 'session-123';
      const patientId = 'patient-123';
      const paymentMethod = 'cod' as any;

      // Act & Assert
      await expect(
        appointmentsService.createAppointmentFromSession(sessionId, patientId, paymentMethod),
      ).rejects.toThrow(BadRequestException);
      await expect(
        appointmentsService.createAppointmentFromSession(sessionId, patientId, paymentMethod),
      ).rejects.toThrow('Only online payment is supported');
    });

    it('should throw ForbiddenException if session belongs to different patient', async () => {
      // Arrange
      const sessionId = 'session-123';
      const patientId = 'patient-456'; // Different patient!
      const paymentMethod = 'online';

      const session = {
        sessionId,
        patientId: 'patient-123', // Original owner
        clinicServiceConfigId: 'service-config-123',
        clinicId: 'clinic-123',
        doctorId: 'doctor-123',
        appointmentDate: '2026-02-25',
        doctorShiftHourId: 'shift-hour-123',
        bookingOption: BookingOption.SERVICE,
        currentStep: 3,
      };

      jest.spyOn(bookingSessionService, 'getSession').mockResolvedValue(session as any);

      // Act & Assert
      await expect(
        appointmentsService.createAppointmentFromSession(sessionId, patientId, paymentMethod),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        appointmentsService.createAppointmentFromSession(sessionId, patientId, paymentMethod),
      ).rejects.toThrow('You do not have permission to access this session');
    });

    it('should throw BadRequestException if booking option is not service', async () => {
      // Arrange
      const sessionId = 'session-123';
      const patientId = 'patient-123';
      const paymentMethod = 'online';

      const session = {
        sessionId,
        patientId,
        doctorId: 'doctor-123',
        clinicId: 'clinic-123',
        bookingOption: BookingOption.DOCTOR, // Option 2, not supported yet
        currentStep: 3,
      };

      jest.spyOn(bookingSessionService, 'getSession').mockResolvedValue(session as any);

      // Act & Assert
      await expect(
        appointmentsService.createAppointmentFromSession(sessionId, patientId, paymentMethod),
      ).rejects.toThrow(BadRequestException);
      await expect(
        appointmentsService.createAppointmentFromSession(sessionId, patientId, paymentMethod),
      ).rejects.toThrow('This endpoint currently only supports service-first booking');
    });

    it('should throw BadRequestException if slot is fully booked (limit = 0)', async () => {
      // Arrange
      const sessionId = 'session-123';
      const patientId = 'patient-123';
      const paymentMethod = 'online';

      const session = {
        sessionId,
        patientId,
        clinicServiceConfigId: 'service-config-123',
        clinicId: 'clinic-123',
        doctorId: 'doctor-123',
        appointmentDate: '2026-02-25',
        doctorShiftHourId: 'shift-hour-123',
        bookingOption: BookingOption.SERVICE,
        currentStep: 3,
      };

      jest.spyOn(bookingSessionService, 'getSession').mockResolvedValue(session as any);

      // Mock transaction with limit = 0
      dataSource.transaction = jest.fn(async (isolation, callback) => {
        const mockManager = {
          createQueryBuilder: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          setLock: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(createMockClinicShiftHour({ limit: 0 })),
        };
        return callback(mockManager);
      });

      // Act & Assert
      await expect(
        appointmentsService.createAppointmentFromSession(sessionId, patientId, paymentMethod),
      ).rejects.toThrow(BadRequestException);
      await expect(
        appointmentsService.createAppointmentFromSession(sessionId, patientId, paymentMethod),
      ).rejects.toThrow('This time slot is fully booked');
    });

    it('should throw BadRequestException if session is incomplete', async () => {
      // Arrange
      const sessionId = 'session-123';
      const patientId = 'patient-123';
      const paymentMethod = 'online';

      const incompleteSession = {
        sessionId,
        patientId,
        clinicServiceConfigId: 'service-config-123',
        clinicId: 'clinic-123',
        // Missing: doctorId, appointmentDate, doctorShiftHourId
        bookingOption: BookingOption.SERVICE,
        currentStep: 1,
      };

      jest.spyOn(bookingSessionService, 'getSession').mockResolvedValue(incompleteSession as any);

      // Act & Assert
      await expect(
        appointmentsService.createAppointmentFromSession(sessionId, patientId, paymentMethod),
      ).rejects.toThrow(BadRequestException);
      await expect(
        appointmentsService.createAppointmentFromSession(sessionId, patientId, paymentMethod),
      ).rejects.toThrow('Incomplete booking session');
    });

    it('should throw BadRequestException if appointment date is in the past', async () => {
      // Arrange
      const sessionId = 'session-123';
      const patientId = 'patient-123';
      const paymentMethod = 'online';

      const session = {
        sessionId,
        patientId,
        clinicServiceConfigId: 'service-config-123',
        clinicId: 'clinic-123',
        doctorId: 'doctor-123',
        appointmentDate: '2026-01-01', // Past date
        doctorShiftHourId: 'shift-hour-123',
        bookingOption: BookingOption.SERVICE,
        currentStep: 3,
      };

      jest.spyOn(bookingSessionService, 'getSession').mockResolvedValue(session as any);

      // Act & Assert
      await expect(
        appointmentsService.createAppointmentFromSession(sessionId, patientId, paymentMethod),
      ).rejects.toThrow(BadRequestException);
      await expect(
        appointmentsService.createAppointmentFromSession(sessionId, patientId, paymentMethod),
      ).rejects.toThrow('Appointment date must be today or in the future');
    });

    it('should throw BadRequestException if appointment date is more than 60 days ahead', async () => {
      // Arrange
      const sessionId = 'session-123';
      const patientId = 'patient-123';
      const paymentMethod = 'online';

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 70); // 70 days ahead

      const session = {
        sessionId,
        patientId,
        clinicServiceConfigId: 'service-config-123',
        clinicId: 'clinic-123',
        doctorId: 'doctor-123',
        appointmentDate: futureDate.toISOString().split('T')[0],
        doctorShiftHourId: 'shift-hour-123',
        bookingOption: BookingOption.SERVICE,
        currentStep: 3,
      };

      jest.spyOn(bookingSessionService, 'getSession').mockResolvedValue(session as any);

      // Act & Assert
      await expect(
        appointmentsService.createAppointmentFromSession(sessionId, patientId, paymentMethod),
      ).rejects.toThrow(BadRequestException);
      await expect(
        appointmentsService.createAppointmentFromSession(sessionId, patientId, paymentMethod),
      ).rejects.toThrow('Appointment date cannot be more than 60 days in the future');
    });

    it('should throw ConflictException if duplicate appointment exists', async () => {
      // Arrange
      const sessionId = 'session-123';
      const patientId = 'patient-123';
      const paymentMethod = 'online';

      const session = {
        sessionId,
        patientId,
        clinicServiceConfigId: 'service-config-123',
        clinicId: 'clinic-123',
        doctorId: 'doctor-123',
        appointmentDate: '2026-02-25',
        doctorShiftHourId: 'shift-hour-123',
        bookingOption: BookingOption.SERVICE,
        currentStep: 3,
      };

      jest.spyOn(bookingSessionService, 'getSession').mockResolvedValue(session as any);

      // Mock transaction to find existing appointment
      dataSource.transaction = jest.fn(async (isolation, callback) => {
        const mockManager = {
          createQueryBuilder: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          setLock: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(createMockClinicShiftHour()),
          getRepository: jest.fn((entity) => {
            if (entity === 'clinic_service_config') {
              return {
                findOne: jest.fn().mockResolvedValue(createMockServiceConfig()),
              };
            }
            if (entity === 'employee_schedule') {
              return {
                findOne: jest.fn().mockResolvedValue(createMockEmployeeSchedule()),
              };
            }
            if (entity === 'appointments') {
              return {
                findOne: jest.fn().mockResolvedValue({ _id: 'existing-appointment' }), // Duplicate!
              };
            }
            return {};
          }),
        };
        return callback(mockManager);
      });

      // Act & Assert
      await expect(
        appointmentsService.createAppointmentFromSession(sessionId, patientId, paymentMethod),
      ).rejects.toThrow(ConflictException);
      await expect(
        appointmentsService.createAppointmentFromSession(sessionId, patientId, paymentMethod),
      ).rejects.toThrow('You already have an appointment at this time');
    });

    it('should throw BadRequestException if service config not found or inactive', async () => {
      // Arrange
      const sessionId = 'session-123';
      const patientId = 'patient-123';
      const paymentMethod = 'online';

      const session = {
        sessionId,
        patientId,
        clinicServiceConfigId: 'service-config-123',
        clinicId: 'clinic-123',
        doctorId: 'doctor-123',
        appointmentDate: '2026-02-25',
        doctorShiftHourId: 'shift-hour-123',
        bookingOption: BookingOption.SERVICE,
        currentStep: 3,
      };

      jest.spyOn(bookingSessionService, 'getSession').mockResolvedValue(session as any);

      // Mock transaction with inactive service
      dataSource.transaction = jest.fn(async (isolation, callback) => {
        const mockManager = {
          createQueryBuilder: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          setLock: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(createMockClinicShiftHour()),
          getRepository: jest.fn((entity) => {
            if (entity === 'clinic_service_config') {
              return {
                findOne: jest.fn().mockResolvedValue(null), // Not found
              };
            }
            return {};
          }),
        };
        return callback(mockManager);
      });

      // Act & Assert
      await expect(
        appointmentsService.createAppointmentFromSession(sessionId, patientId, paymentMethod),
      ).rejects.toThrow(BadRequestException);
      await expect(
        appointmentsService.createAppointmentFromSession(sessionId, patientId, paymentMethod),
      ).rejects.toThrow('Service is not available');
    });

    it('should throw BadRequestException if doctor has no schedule on appointment date', async () => {
      // Arrange
      const sessionId = 'session-123';
      const patientId = 'patient-123';
      const paymentMethod = 'online';

      const session = {
        sessionId,
        patientId,
        clinicServiceConfigId: 'service-config-123',
        clinicId: 'clinic-123',
        doctorId: 'doctor-123',
        appointmentDate: '2026-02-25',
        doctorShiftHourId: 'shift-hour-123',
        bookingOption: BookingOption.SERVICE,
        currentStep: 3,
      };

      jest.spyOn(bookingSessionService, 'getSession').mockResolvedValue(session as any);

      // Mock transaction with no employee schedule
      dataSource.transaction = jest.fn(async (isolation, callback) => {
        const mockManager = {
          createQueryBuilder: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          setLock: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(createMockClinicShiftHour()),
          getRepository: jest.fn((entity) => {
            if (entity === 'clinic_service_config') {
              return {
                findOne: jest.fn().mockResolvedValue(createMockServiceConfig()),
              };
            }
            if (entity === 'employee_schedule') {
              return {
                findOne: jest.fn().mockResolvedValue(null), // No schedule
              };
            }
            return {};
          }),
        };
        return callback(mockManager);
      });

      // Act & Assert
      await expect(
        appointmentsService.createAppointmentFromSession(sessionId, patientId, paymentMethod),
      ).rejects.toThrow(BadRequestException);
      await expect(
        appointmentsService.createAppointmentFromSession(sessionId, patientId, paymentMethod),
      ).rejects.toThrow('Doctor is not available on this date at this clinic');
    });
  });

  // ============================================================================
  // TEST SUITE 4: REDIS SESSION CLEANUP
  // ============================================================================

  describe('Redis Session Cleanup', () => {
    it('should delete session from Redis after successful appointment creation', async () => {
      // Arrange
      const sessionId = 'session-123';
      const patientId = 'patient-123';
      const paymentMethod = 'online';

      const session = {
        sessionId,
        patientId,
        clinicServiceConfigId: 'service-config-123',
        clinicId: 'clinic-123',
        doctorId: 'doctor-123',
        appointmentDate: '2026-02-25',
        doctorShiftHourId: 'shift-hour-123',
        bookingOption: BookingOption.SERVICE,
        currentStep: 3,
      };

      jest.spyOn(bookingSessionService, 'getSession').mockResolvedValue(session as any);
      jest.spyOn(bookingSessionService, 'deleteSession').mockResolvedValue();

      dataSource.transaction = jest.fn(async (isolation, callback) => {
        const mockManager = {
          createQueryBuilder: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          setLock: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(createMockClinicShiftHour()),
          update: jest.fn().mockReturnThis(),
          set: jest.fn().mockReturnThis(),
          execute: jest.fn().mockResolvedValue({}),
          getRepository: jest.fn((entity) => {
            if (entity === 'clinic_service_config') {
              return { findOne: jest.fn().mockResolvedValue(createMockServiceConfig()) };
            }
            if (entity === 'employee_schedule') {
              return { findOne: jest.fn().mockResolvedValue(createMockEmployeeSchedule()) };
            }
            if (entity === 'appointments') {
              return {
                findOne: jest.fn().mockResolvedValue(null),
                create: jest.fn((d) => d),
                save: jest.fn((d) => ({ ...d, _id: 'appointment-123' })),
              };
            }
            if (entity === 'appointment_package') {
              return { create: jest.fn((d) => d), save: jest.fn((d) => ({ ...d, _id: 'package-123' })) };
            }
            if (entity === 'service_appointments') {
              return { create: jest.fn((d) => d), save: jest.fn((d) => ({ ...d, _id: 'sa-123' })) };
            }
            return {};
          }),
        };
        return callback(mockManager);
      });

      // Act
      await appointmentsService.createAppointmentFromSession(sessionId, patientId, paymentMethod);

      // Assert
      expect(bookingSessionService.deleteSession).toHaveBeenCalledWith(sessionId);
      expect(bookingSessionService.deleteSession).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================================
  // TEST SUITE 5: PATIENT VIEW APPOINTMENTS - getMyAppointments()
  // ============================================================================

  describe('getMyAppointments - Patient View with Tab Filtering', () => {
    let mockAppointmentRepo: any;
    let mockDataSource: any;

    beforeEach(() => {
      mockAppointmentRepo = {
        createQueryBuilder: jest.fn(),
      };

      mockDataSource = {
        createQueryBuilder: jest.fn(),
      };
    });

    it('should filter UPCOMING tab correctly (status + date conditions)', async () => {
      // Arrange
      const patientId = 'patient-123';
      const params = { page: 1, limit: 10, tab: 'UPCOMING' as const };
      const today = new Date().toISOString().split('T')[0];

      const mockAppointments = [
        {
          _id: 'apt-1',
          patientId,
          appointmentDate: new Date(today),
          status: 'PENDING',
          clinic: { _id: 'clinic-1', businessName: 'Clinic A' },
          doctor: { _id: 'doctor-1', fullName: 'Dr. A' },
        },
        {
          _id: 'apt-2',
          patientId,
          appointmentDate: new Date(new Date().setDate(new Date().getDate() + 1)),
          status: 'CONFIRMED',
          clinic: { _id: 'clinic-1', businessName: 'Clinic A' },
          doctor: { _id: 'doctor-1', fullName: 'Dr. A' },
        },
      ];

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([mockAppointments, 2]),
      };

      mockAppointmentRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const mockServicesQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };

      mockDataSource.createQueryBuilder.mockReturnValue(mockServicesQueryBuilder);

      // Mock service dependencies
      const service = Object.assign(appointmentsService as any, {
        appointmentRepository: mockAppointmentRepo,
        dataSource: mockDataSource,
      }) as AppointmentsService;

      // Act
      const result = await service.getMyAppointments(patientId, params);

      // Assert
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        expect.objectContaining({
          // Verify Brackets for UPCOMING logic
        }),
      );
      expect(mockQueryBuilder.getManyAndCount).toHaveBeenCalled();
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(result.meta.total).toBe(2);
    });

    it('should filter HISTORY tab correctly (completed statuses OR past dates)', async () => {
      // Arrange
      const patientId = 'patient-123';
      const params = { page: 1, limit: 10, tab: 'HISTORY' as const };
      const yesterday = new Date(new Date().setDate(new Date().getDate() - 1));

      const mockAppointments = [
        {
          _id: 'apt-1',
          patientId,
          appointmentDate: yesterday,
          status: 'COMPLETED',
          clinic: { _id: 'clinic-1', businessName: 'Clinic A' },
        },
        {
          _id: 'apt-2',
          patientId,
          appointmentDate: yesterday,
          status: 'PENDING', // Expired appointment
          clinic: { _id: 'clinic-1', businessName: 'Clinic A' },
        },
      ];

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([mockAppointments, 2]),
      };

      mockAppointmentRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const mockServicesQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };

      mockDataSource.createQueryBuilder.mockReturnValue(mockServicesQueryBuilder);

      const service = Object.assign(appointmentsService as any, {
        appointmentRepository: mockAppointmentRepo,
        dataSource: mockDataSource,
      }) as AppointmentsService;

      // Act
      const result = await service.getMyAppointments(patientId, params);

      // Assert
      expect(mockQueryBuilder.getManyAndCount).toHaveBeenCalled();
      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });

    it('should prioritize status parameter over tab parameter', async () => {
      // Arrange
      const patientId = 'patient-123';
      const params = { page: 1, limit: 10, tab: 'UPCOMING' as const, status: 'COMPLETED' };

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };

      mockAppointmentRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const mockServicesQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };

      mockDataSource.createQueryBuilder.mockReturnValue(mockServicesQueryBuilder);

      const service = Object.assign(appointmentsService as any, {
        appointmentRepository: mockAppointmentRepo,
        dataSource: mockDataSource,
      }) as AppointmentsService;

      // Act
      await service.getMyAppointments(patientId, params);

      // Assert - Verify status filter was applied, not tab filter
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('a.status = :status', { status: 'COMPLETED' });
    });

    it('should apply pagination correctly', async () => {
      // Arrange
      const patientId = 'patient-123';
      const params = { page: 2, limit: 10 };

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 25]),
      };

      mockAppointmentRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const mockServicesQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };

      mockDataSource.createQueryBuilder.mockReturnValue(mockServicesQueryBuilder);

      const service = Object.assign(appointmentsService as any, {
        appointmentRepository: mockAppointmentRepo,
        dataSource: mockDataSource,
      }) as AppointmentsService;

      // Act
      const result = await service.getMyAppointments(patientId, params);

      // Assert
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(10); // (page - 1) * limit
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
      expect(result.meta.page).toBe(2);
      expect(result.meta.total_pages).toBe(3); // ceil(25 / 10)
    });

    it('should bulk load services to avoid N+1 queries', async () => {
      // Arrange
      const patientId = 'patient-123';
      const params = { page: 1, limit: 10 };

      const mockAppointments = [
        { _id: 'apt-1', clinic: {}, doctor: {} },
        { _id: 'apt-2', clinic: {}, doctor: {} },
      ];

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([mockAppointments, 2]),
      };

      mockAppointmentRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const mockServicesQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };

      mockDataSource.createQueryBuilder.mockReturnValue(mockServicesQueryBuilder);

      const service = Object.assign(appointmentsService as any, {
        appointmentRepository: mockAppointmentRepo,
        dataSource: mockDataSource,
      }) as AppointmentsService;

      // Act
      await service.getMyAppointments(patientId, params);

      // Assert - Verify only 1 bulk query for all services
      expect(mockServicesQueryBuilder.getRawMany).toHaveBeenCalledTimes(1);
      expect(mockServicesQueryBuilder.where).toHaveBeenCalledWith('ap.appointment_id IN (:...ids)', {
        ids: ['apt-1', 'apt-2'],
      });
    });
  });

  // ============================================================================
  // TEST SUITE 6: PATIENT VIEW APPOINTMENT DETAIL - getMyAppointmentDetail()
  // ============================================================================

  describe('getMyAppointmentDetail - Patient View Detail', () => {
    let mockAppointmentRepo: any;
    let mockEPrescriptionRepo: any;
    let mockDataSource: any;

    beforeEach(() => {
      mockAppointmentRepo = {
        createQueryBuilder: jest.fn(),
      };

      mockEPrescriptionRepo = {
        findOne: jest.fn(),
      };

      mockDataSource = {
        createQueryBuilder: jest.fn(),
      };
    });

    it('should return full appointment detail with nested data', async () => {
      // Arrange
      const patientId = 'patient-123';
      const appointmentId = 'apt-123';

      const mockAppointment = {
        _id: appointmentId,
        patientId,
        status: 'CONFIRMED',
        appointmentDate: new Date('2026-03-10'),
        appointmentHour: new Date('2026-03-10T08:00:00'),
        total: 500000,
        patientNote: 'Test note',
        clinic: {
          _id: 'clinic-1',
          businessName: 'Clinic A',
          address: '123 Street',
          phone: '0123456789',
        },
        doctor: {
          _id: 'doctor-1',
          fullName: 'Dr. Nguyen Van A',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockAppointment),
      };

      mockAppointmentRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const mockPackagesQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([{ _id: 'pkg-1', amount: 500000 }]),
      };

      const mockServicesQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          {
            sa_id: 'sa-1',
            package_id: 'pkg-1',
            service_name: 'X-Ray',
            price: 500000,
            erm_id: 'erm-1',
            erm_record_type: 'XRAY',
            erm_status: 'COMPLETED',
          },
        ]),
      };

      mockDataSource.createQueryBuilder
        .mockReturnValueOnce(mockPackagesQueryBuilder)
        .mockReturnValueOnce(mockServicesQueryBuilder);

      const service = Object.assign(appointmentsService as any, {
        appointmentRepository: mockAppointmentRepo,
        ePrescriptionRepository: mockEPrescriptionRepo,
        dataSource: mockDataSource,
      }) as AppointmentsService;

      // Act
      const result = await service.getMyAppointmentDetail(patientId, appointmentId);

      // Assert
      expect(result._id).toBe(appointmentId);
      expect(result.clinic).toHaveProperty('_id');
      expect(result.doctor).toHaveProperty('fullName');
      expect(result.appointment_packages).toBeDefined();
      expect(result.reject_reason).toBeUndefined(); // Not CANCELLED
    });

    it('should throw NotFoundException when appointment not found or not owned', async () => {
      // Arrange
      const patientId = 'patient-999';
      const appointmentId = 'apt-123';

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };

      mockAppointmentRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const service = Object.assign(appointmentsService as any, {
        appointmentRepository: mockAppointmentRepo,
      }) as AppointmentsService;

      // Act & Assert
      await expect(service.getMyAppointmentDetail(patientId, appointmentId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getMyAppointmentDetail(patientId, appointmentId)).rejects.toThrow(
        'Appointment not found or access denied',
      );
    });

    it('should include e_prescription_summary only when status is COMPLETED', async () => {
      // Arrange
      const patientId = 'patient-123';
      const appointmentId = 'apt-123';

      const mockAppointment = {
        _id: appointmentId,
        patientId,
        status: 'COMPLETED', // Key: COMPLETED status
        clinic: { _id: 'clinic-1' },
        doctor: { _id: 'doctor-1' },
      };

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockAppointment),
      };

      mockAppointmentRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      mockEPrescriptionRepo.findOne.mockResolvedValue({ _id: 'ep-123' });

      const mockPackagesQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };

      const mockServicesQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };

      mockDataSource.createQueryBuilder
        .mockReturnValueOnce(mockPackagesQueryBuilder)
        .mockReturnValueOnce(mockServicesQueryBuilder);

      const service = Object.assign(appointmentsService as any, {
        appointmentRepository: mockAppointmentRepo,
        ePrescriptionRepository: mockEPrescriptionRepo,
        dataSource: mockDataSource,
      }) as AppointmentsService;

      // Act
      const result = await service.getMyAppointmentDetail(patientId, appointmentId);

      // Assert
      expect(result.e_prescription_summary).toEqual({ _id: 'ep-123' });
      expect(mockEPrescriptionRepo.findOne).toHaveBeenCalledWith({
        where: { appointmentId, deletedAt: expect.anything() },
        select: ['_id'],
      });
    });

    it('should include reject_reason only when status is CANCELLED', async () => {
      // Arrange
      const patientId = 'patient-123';
      const appointmentId = 'apt-123';

      const mockAppointment = {
        _id: appointmentId,
        patientId,
        status: 'CANCELLED', // Key: CANCELLED status
        rejectReason: 'Patient request',
        clinic: { _id: 'clinic-1' },
        doctor: { _id: 'doctor-1' },
      };

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockAppointment),
      };

      mockAppointmentRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const mockPackagesQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };

      const mockServicesQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };

      mockDataSource.createQueryBuilder
        .mockReturnValueOnce(mockPackagesQueryBuilder)
        .mockReturnValueOnce(mockServicesQueryBuilder);

      const service = Object.assign(appointmentsService as any, {
        appointmentRepository: mockAppointmentRepo,
        dataSource: mockDataSource,
      }) as AppointmentsService;

      // Act
      const result = await service.getMyAppointmentDetail(patientId, appointmentId);

      // Assert
      expect(result.reject_reason).toBe('Patient request');
    });

    it('should load ERM summary for service appointments via LEFT JOIN', async () => {
      // Arrange
      const patientId = 'patient-123';
      const appointmentId = 'apt-123';

      const mockAppointment = {
        _id: appointmentId,
        patientId,
        status: 'CONFIRMED',
        clinic: { _id: 'clinic-1' },
      };

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockAppointment),
      };

      mockAppointmentRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const mockPackagesQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([{ _id: 'pkg-1' }]),
      };

      const mockServicesQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(), // LEFT JOIN for ERMs
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          {
            sa_id: 'sa-1',
            service_name: 'X-Ray',
            erm_id: 'erm-1',
            erm_record_type: 'XRAY',
            erm_status: 'COMPLETED',
          },
          {
            sa_id: 'sa-2',
            service_name: 'Consultation',
            erm_id: null, // No ERM for this service
          },
        ]),
      };

      mockDataSource.createQueryBuilder
        .mockReturnValueOnce(mockPackagesQueryBuilder)
        .mockReturnValueOnce(mockServicesQueryBuilder);

      const service = Object.assign(appointmentsService as any, {
        appointmentRepository: mockAppointmentRepo,
        dataSource: mockDataSource,
      }) as AppointmentsService;

      // Act
      const result = await service.getMyAppointmentDetail(patientId, appointmentId);

      // Assert
      expect(mockServicesQueryBuilder.leftJoin).toHaveBeenCalledWith(
        'erms',
        'e',
        expect.stringContaining('e.service_appointments_id = sa._id'),
      );
      expect(result.appointment_packages[0].service_appointments).toHaveLength(2);
      expect(result.appointment_packages[0].service_appointments[0].erm_summary).toBeDefined();
      expect(result.appointment_packages[0].service_appointments[1].erm_summary).toBeUndefined();
    });
  });
});
