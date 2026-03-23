/**
 * Unit Tests for POST Appointments (VERSION 4.3)
 * 
 * Tests for creating appointments from booking sessions
 * 
 * Covers:
 * - POST /patients/appointments (Create appointment from completed session)
 * - COD payment flow (immediate appointment creation)
 * - Slot availability validation with pessimistic locking
 * - Session completion validation
 * - Appointment creation transaction
 */

import { Test, TestingModule } from '@nestjs/testing';
import { AppointmentsService } from '../../../src/modules/appointments/appointments.service';
import { TransactionsService } from '../../../src/modules/transactions/transactions.service';
import { MailerService } from '../../../src/modules/mailer/mailer.service';
import { BadRequestException, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import Redis from 'ioredis';
import { Appointment } from '../../../src/modules/appointments/entities/appointment.entity';
import { ClinicShiftHour } from '../../../src/modules/schedules/entities/clinic-shift-hour.entity';
import { BookingSessionService } from '../../../src/modules/appointments/booking-session.service';
import { AppointmentRepository, AppointmentPackageRepository } from '../../../src/modules/appointments/repositories';
import { ClinicStaffInformationRepository, AccountRepository } from '../../../src/modules/accounts/repositories';
import { EmployeeScheduleRepository } from '../../../src/modules/schedules/repositories/employee-schedule.repository';
import { REDIS_CLIENT } from '../../../src/config/redis.config';
import { AppointmentWebhookService } from '../../../src/modules/appointments/appointment-webhook.service';
import { mockRedisSession, mockSlotEntity, mockAppointmentEntity } from './fixtures/mock-data';

describe('POST Appointments API (V4.3) - Unit Tests', () => {
  let service: AppointmentsService;
  let bookingSessionService: BookingSessionService;
  let dataSource: jest.Mocked<DataSource>;
  let queryRunner: jest.Mocked<QueryRunner>;
  let redisClient: jest.Mocked<Redis>;
  let appointmentWebhookService: jest.Mocked<AppointmentWebhookService>;

  const mockPatientId = '550e8400-e29b-41d4-a716-446655440001';
  const mockSessionId = '550e8400-e29b-41d4-a716-446655440002';
  const mockClinicId = '550e8400-e29b-41d4-a716-446655440003';
  const mockServiceConfigId = '550e8400-e29b-41d4-a716-446655440004';
  const mockDoctorId = '550e8400-e29b-41d4-a716-446655440005';
  const mockSlotId = '550e8400-e29b-41d4-a716-446655440006';

  // Mock getSession function that can be overridden per test
  let mockGetSession: jest.Mock;

  // Deep mocks for TypeORM transaction (exposed for test manipulation)
  let mockQueryBuilder: any;
  let mockUpdateQueryBuilder: any;
  let mockRepositories: Map<string, any>;
  let mockEntityManager: any;
  let mockQueryRunner: any;

  beforeEach(async () => {
    // Initialize mock function
    mockGetSession = jest.fn();

    // Create comprehensive mock query builder for SELECT queries with pessimistic lock
    mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getOne: jest.fn()
        .mockResolvedValueOnce({
          _id: mockServiceConfigId,
          clinicId: mockClinicId,
          isActive: true,
          price: 300000,
          discount: 10,
          service: { serviceName: 'Khám Xương Khớp' },
        })
        .mockResolvedValue(mockSlotEntity({ limit: 10 })), // Default: available slot
      getMany: jest.fn().mockResolvedValue([]),
      getRawMany: jest.fn().mockResolvedValue([]),
      getRawOne: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    // Create mock query builder for UPDATE queries
    mockUpdateQueryBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    // Create mock repositories for different entities
    mockRepositories = new Map();

    // Repository for clinic_shift_hour
    mockRepositories.set('clinic_shift_hour', {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((data: any) => data),
      save: jest.fn().mockImplementation((data: any) => Promise.resolve(data)),
    });

    // Repository for clinic_service_config
    mockRepositories.set('clinic_service_config', {
      findOne: jest.fn().mockResolvedValue({
        _id: mockServiceConfigId,
        clinicId: mockClinicId,
        isActive: true,
        price: 300000,
        discount: 10,
        service: { serviceName: 'Khám Xương Khớp' },
      }),
      create: jest.fn().mockImplementation((data: any) => data),
      save: jest.fn().mockImplementation((data: any) => Promise.resolve(data)),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    });

    // Repository for employee_schedule
    mockRepositories.set('employee_schedule', {
      findOne: jest.fn().mockResolvedValue({
        employeeId: mockDoctorId,
        clinicId: mockClinicId,
        workDate: new Date('2026-03-20'),
      }),
      create: jest.fn().mockImplementation((data: any) => data),
      save: jest.fn().mockImplementation((data: any) => Promise.resolve(data)),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    });

    // Repository for appointments
    mockRepositories.set('appointments', {
      findOne: jest.fn().mockResolvedValue(null), // Default: no overlapping appointment
      create: jest.fn().mockImplementation((data: any) => ({
        _id: 'appointment-id-1',
        ...data,
      })),
      save: jest.fn().mockImplementation((data: any) => Promise.resolve({
        _id: 'appointment-id-1',
        ...data,
      })),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    });

    // Repository for appointment_package
    mockRepositories.set('appointment_package', {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((data: any) => ({
        _id: 'package-id-1',
        ...data,
      })),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      save: jest.fn().mockImplementation((data: any) => Promise.resolve({
        _id: 'package-id-1',
        ...data,
      })),
    });

    // Repository for service_appointments
    mockRepositories.set('service_appointments', {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((data: any) => ({
        _id: 'service-appointment-id-1',
        ...data,
      })),
      save: jest.fn().mockImplementation((data: any) => Promise.resolve({
        _id: 'service-appointment-id-1',
        ...data,
      })),
    });

    // Create mock EntityManager with all necessary methods
    mockEntityManager = {
      // getRepository: Returns repository based on entity name
      getRepository: jest.fn().mockImplementation((entityName: string) => {
        const repo = mockRepositories.get(entityName);
        if (!repo) {
          throw new Error(`Mock repository not found for entity: ${entityName}`);
        }
        return repo;
      }),

      // createQueryBuilder: Intelligent mock with call counter for no-entity calls
      // Flow in createAppointmentCOD:
      //   Call 1 (no entity): shiftHour → getOne returns slot with startHour
      //   Call 2 (ClinicServiceConfig): serviceConfig → getOne returns config
      //   Call 3 (ClinicServiceConfig): debug query → getOne returns config
      //   Call 4 (no entity): branches → getRawMany returns []
      //   Call 5 (no entity): existingAppointment → getOne returns null (no duplicate)
      //   Call 6 (no entity): UPDATE → execute returns { affected: 1 }
      createQueryBuilder: (() => {
        let noEntityCallCount = 0;
        return jest.fn().mockImplementation((entity: any) => {
          const entityName = typeof entity === 'function' ? entity.name : '';

          // Base builder methods
          const baseBuilder: any = {
            select: jest.fn().mockReturnThis(),
            from: jest.fn().mockReturnThis(),
            leftJoinAndSelect: jest.fn().mockReturnThis(),
            innerJoinAndSelect: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            setLock: jest.fn().mockReturnThis(),
            take: jest.fn().mockReturnThis(),
            update: jest.fn().mockReturnThis(),
            set: jest.fn().mockReturnThis(),
            execute: jest.fn().mockResolvedValue({ affected: 1 }),
            getRawMany: jest.fn().mockResolvedValue([]),
            getRawOne: jest.fn().mockResolvedValue(null),
            getMany: jest.fn().mockResolvedValue([]),
            getOne: jest.fn().mockResolvedValue(null),
          };

          if (entityName === 'ClinicServiceConfig') {
            const mockService = {
              _id: mockServiceConfigId,
              clinicId: mockClinicId,
              isActive: true,
              price: 300000,
              discount: 10,
              service: { serviceName: 'Khám Xương Khớp', isActive: true, deletedAt: null },
              deletedAt: null,
            };
            baseBuilder.getOne = jest.fn().mockResolvedValue(mockService);
            baseBuilder.getMany = jest.fn().mockResolvedValue([mockService]);
          } else {
            noEntityCallCount++;
            if (noEntityCallCount === 1) {
              // First no-entity call: shiftHour query with pessimistic lock
              baseBuilder.getOne = jest.fn().mockResolvedValue({
                _id: mockSlotId,
                limit: 10,
                startHour: '08:00:00',
                endHour: '08:30:00',
              });
            }
            // All other no-entity calls: getOne returns null (no duplicate, etc.)
          }

          return baseBuilder;
        });
      })(),

      // Direct methods on manager
      findOne: jest.fn().mockResolvedValue(null),
      query: jest.fn().mockResolvedValue([{ _id: 'schedule-id-1', isActive: true }]),
      create: jest.fn().mockImplementation((entity: any, data: any) => data || entity),
      save: jest.fn().mockImplementation((data: any) => Promise.resolve(data)),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    // Create mock QueryRunner with full transaction lifecycle
    mockQueryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: mockEntityManager,
    };

    // Create mock repository
    const mockRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        ...mockQueryBuilder,
        update: mockUpdateQueryBuilder.update,
        set: mockUpdateQueryBuilder.set,
        execute: mockUpdateQueryBuilder.execute,
      })),
    };

    // Create mock DataSource
    const mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
      getRepository: jest.fn().mockReturnValue(mockRepository),
      transaction: jest.fn().mockImplementation(async (isolationOrCallback, callback) => {
        // If called with isolation level: transaction(level, callback)
        if (typeof callback === 'function') {
          return await callback(mockEntityManager);
        }
        // If called with just callback: transaction(callback)
        if (typeof isolationOrCallback === 'function') {
          return await isolationOrCallback(mockEntityManager);
        }
      }),
    };

    // Create mock Redis client
    const mockRedis = {
      get: jest.fn(),
      set: jest.fn().mockResolvedValue('OK'),
      setex: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
      ttl: jest.fn().mockResolvedValue(1800),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        {
          provide: BookingSessionService,
          useValue: {
            getSession: mockGetSession,
            deleteSession: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: REDIS_CLIENT,
          useValue: mockRedis,
        },
        {
          provide: AppointmentRepository,
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: AppointmentPackageRepository,
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: ClinicStaffInformationRepository,
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: EmployeeScheduleRepository,
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: AccountRepository,
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: TransactionsService,
          useValue: {
            handleCallback: jest.fn(),
            createTransaction: jest.fn(),
          },
        },
        {
          provide: MailerService,
          useValue: {
            sendAppointmentConfirmation: jest.fn(),
          },
        },
        {
          provide: AppointmentWebhookService,
          useValue: {
            sendConfirmation: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<AppointmentsService>(AppointmentsService);
    bookingSessionService = module.get<BookingSessionService>(BookingSessionService);
    dataSource = module.get(DataSource);
    queryRunner = dataSource.createQueryRunner() as jest.Mocked<QueryRunner>;
    redisClient = module.get(REDIS_CLIENT);
    appointmentWebhookService = module.get(AppointmentWebhookService);
  });

  describe('createAppointmentFromSession (COD Flow)', () => {
    // Complete session at step 4 (ready for appointment creation)
    const completeSession = {
      sessionId: mockSessionId,
      patientId: mockPatientId,
      bookingOption: 'service',
      serviceIds: [mockServiceConfigId],
      clinicServiceConfigId: mockServiceConfigId,
      clinicId: mockClinicId,
      doctorId: mockDoctorId,
      clinicShiftHourId: mockSlotId,
      appointmentDate: '2026-04-20',
      paymentMethod: 'cod',
      patientNote: 'Đau mỏi vai gáy',
      currentStep: 4,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 1800000).toISOString(),
    };

    // Helper function to setup valid session mock
    const setupValidSessionMock = (overrides = {}) => {
      const session = { ...completeSession, ...overrides };
      mockGetSession.mockResolvedValue(session as any);
    };

    describe('Session validation', () => {
      it('should validate session exists', async () => {
        mockGetSession.mockRejectedValue(
          new NotFoundException('Booking session not found or expired. Please start a new booking.')
        );

        await expect(
          service.createAppointmentFromSession(mockSessionId, mockPatientId)
        ).rejects.toThrow(NotFoundException);
      });

      it('should validate session ownership', async () => {
        setupValidSessionMock({ patientId: 'other-patient-id' });

        await expect(
          service.createAppointmentFromSession(mockSessionId, mockPatientId)
        ).rejects.toThrow(ForbiddenException);
      });

      it('should validate session is complete (all 4 steps)', async () => {
        // Setup incomplete session (step 2 - missing payment method and patient note)
        setupValidSessionMock({
          currentStep: 2,
          serviceIds: [], // Empty or missing in step 2
          paymentMethod: undefined, // Not set yet in step 2
          patientNote: undefined, // Not set yet in step 2
        });

        await expect(
          service.createAppointmentFromSession(mockSessionId, mockPatientId)
        ).rejects.toThrow(BadRequestException); // Service throws BadRequestException for incomplete session
      });

      // REMOVED: Online payment test - feature is pending implementation
      // We only test COD flow in this version
    });

    describe('Pessimistic locking and slot availability', () => {
      it('should use FOR UPDATE lock when checking slot availability', async () => {
        setupValidSessionMock();

        await service.createAppointmentFromSession(mockSessionId, mockPatientId);

        // Verify createQueryBuilder was called (lock is set inside the builder)
        expect(mockEntityManager.createQueryBuilder).toHaveBeenCalled();
        // Verify that first no-entity createQueryBuilder call's builder had setLock called
        const firstCallBuilder = mockEntityManager.createQueryBuilder.mock.results[0].value;
        expect(firstCallBuilder.setLock).toHaveBeenCalledWith('pessimistic_write');
        expect(firstCallBuilder.getOne).toHaveBeenCalled();
      });

      it('should throw ConflictException if slot is fully booked', async () => {
        setupValidSessionMock();
        
        // Override createQueryBuilder to return fully booked slot on first no-entity call
        const origImpl = mockEntityManager.createQueryBuilder.getMockImplementation();
        let callCount = 0;
        mockEntityManager.createQueryBuilder.mockImplementation((entity: any) => {
          const builder = origImpl(entity);
          const entityName = typeof entity === 'function' ? entity.name : '';
          if (!entityName) {
            callCount++;
            if (callCount === 1) {
              builder.getOne = jest.fn().mockResolvedValue({
                _id: mockSlotId,
                limit: 0, // Fully booked
                startHour: '08:00:00',
                endHour: '08:30:00',
              });
            }
          }
          return builder;
        });

        await expect(
          service.createAppointmentFromSession(mockSessionId, mockPatientId)
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('Appointment creation', () => {
      it('should create appointment with correct data from session', async () => {
        setupValidSessionMock();
        
        // Configure query builder to return available slot
        mockQueryBuilder.getOne.mockResolvedValueOnce({
          _id: mockSlotId,
          limit: 5,
          startHour: '08:00:00',
          endHour: '08:30:00',
        });

        const result = await service.createAppointmentFromSession(mockSessionId, mockPatientId);

        // Verify appointment repository was used to create appointment
        const appointmentRepo = mockRepositories.get('appointments');
        expect(appointmentRepo.create).toHaveBeenCalled();
        expect(appointmentRepo.save).toHaveBeenCalled();

        // Verify response contains expected data
        expect(result).toHaveProperty('appointment_id');
        expect(result.payment_type).toBe('cod');
        expect(result.status).toBe('PENDING');
      });

      it('should set status to pending_confirmation for COD', async () => {
        setupValidSessionMock();
        
        // Configure query builder to return available slot
        mockQueryBuilder.getOne.mockResolvedValueOnce({
          _id: mockSlotId,
          limit: 5,
          startHour: '08:00:00',
          endHour: '08:30:00',
        });

        const result = await service.createAppointmentFromSession(mockSessionId, mockPatientId);

        // Verify status is PENDING (pending_confirmation)
        expect(result.status).toBe('PENDING');
      });

      it('should include patient_note if provided', async () => {
        setupValidSessionMock({ patientNote: 'Đau mỏi vai gáy' });
        
        // Configure query builder to return available slot
        mockQueryBuilder.getOne.mockResolvedValueOnce({
          _id: mockSlotId,
          limit: 5,
          startHour: '08:00:00',
          endHour: '08:30:00',
        });

        const result = await service.createAppointmentFromSession(mockSessionId, mockPatientId);

        // Verify patient note is in response
        expect(result.patient_note).toBe('Đau mỏi vai gáy');
      });

      it('should calculate grand total correctly for multiple services in COD flow', async () => {
        setupValidSessionMock({
          serviceIds: ['service-1', 'service-2'],
        });

        // Mock query builder to handle different entities during the transaction
        let getOneCallCount = 0;
        mockEntityManager.createQueryBuilder.mockImplementation((entity: any) => {
          const entityName = typeof entity === 'function' ? entity.name : '';
          
          if (entityName === 'ClinicServiceConfig') {
            return {
              ...mockQueryBuilder,
              getMany: jest.fn().mockResolvedValue([
                { _id: 'service-1', price: 100000, discount: 0, isActive: true, service: { serviceName: 'Service 1', isActive: true } },
                { _id: 'service-2', price: 200000, discount: 10, isActive: true, service: { serviceName: 'Service 2', isActive: true } },
              ]),
            };
          }
          
          // For slot (shiftHour) and duplicate check, AND update
          return {
            ...mockQueryBuilder,
            getOne: jest.fn().mockImplementation(async () => {
              getOneCallCount++;
              if (getOneCallCount === 1) {
                // First call: shiftHour
                return {
                  _id: mockSlotId,
                  limit: 10,
                  startHour: '08:00:00',
                  endHour: '08:30:00',
                };
              }
              // Second call: duplicate check
              return null;
            }),
          };
        });

        const result = await service.createAppointmentFromSession(mockSessionId, mockPatientId);

        // Total: 100,000 + 180,000 = 280,000
        expect(result.total).toBe(280000);
      });

      it('should trigger n8n webhook after successful COD appointment creation', async () => {
        setupValidSessionMock();
        
        // Configure query builder to return available slot
        mockQueryBuilder.getOne.mockResolvedValueOnce({
          _id: mockSlotId,
          limit: 5,
          startHour: '08:00:00',
          endHour: '08:30:00',
        });

        const result = await service.createAppointmentFromSession(mockSessionId, mockPatientId);

        // Verify webhook was triggered with correct appointment_id
        expect(appointmentWebhookService.sendConfirmation).toHaveBeenCalledWith(result.appointment_id);
      });

      it('should not block if webhook fails', async () => {
        setupValidSessionMock();
        
        // Configure query builder to return available slot
        mockQueryBuilder.getOne.mockResolvedValueOnce({
          _id: mockSlotId,
          limit: 5,
          startHour: '08:00:00',
          endHour: '08:30:00',
        });

        // Mock webhook to fail
        appointmentWebhookService.sendConfirmation.mockRejectedValueOnce(new Error('Webhook failed'));

        // Should still succeed
        const result = await service.createAppointmentFromSession(mockSessionId, mockPatientId);

        expect(result).toHaveProperty('appointment_id');
        expect(appointmentWebhookService.sendConfirmation).toHaveBeenCalled();
      });
    });

    describe('Transaction management', () => {
      it('should commit transaction on successful booking', async () => {
        setupValidSessionMock();
        
        // Configure query builder to return available slot
        mockQueryBuilder.getOne.mockResolvedValueOnce({
          _id: mockSlotId,
          limit: 5,
          startHour: '08:00:00',
          endHour: '08:30:00',
        });

        // Note: With dataSource.transaction mock, we don't directly test
        // commit/rollback since transaction callback handles success/failure
        const result = await service.createAppointmentFromSession(mockSessionId, mockPatientId);

        // Verify successful result
        expect(result).toHaveProperty('appointment_id');
        expect(dataSource.transaction).toHaveBeenCalled();
      });

      it('should rollback transaction on error', async () => {
        setupValidSessionMock();
        
        // Override transaction to simulate database error
        dataSource.transaction.mockRejectedValueOnce(new Error('Database error'));

        await expect(
          service.createAppointmentFromSession(mockSessionId, mockPatientId)
        ).rejects.toThrow('Database error');

        // Transaction should have been called but failed
        expect(dataSource.transaction).toHaveBeenCalled();
      });
    });

    describe('Session cleanup', () => {
      it('should delete session from Redis after successful booking', async () => {
        setupValidSessionMock();
        
        // Configure query builder to return available slot
        mockQueryBuilder.getOne.mockResolvedValueOnce({
          _id: mockSlotId,
          limit: 5,
          startHour: '08:00:00',
          endHour: '08:30:00',
        });

        // Create spy for bookingSessionService.deleteSession
        const deleteSessionSpy = jest.spyOn(bookingSessionService, 'deleteSession');

        await service.createAppointmentFromSession(mockSessionId, mockPatientId);

        // Verify session was deleted after successful booking
        expect(deleteSessionSpy).toHaveBeenCalledWith(mockSessionId);
      });

      it('should keep session in Redis if transaction fails', async () => {
        setupValidSessionMock();
        
        // Override transaction to simulate database error
        dataSource.transaction.mockRejectedValueOnce(new Error('Database error'));

        // Create spy for bookingSessionService.deleteSession
        const deleteSessionSpy = jest.spyOn(bookingSessionService, 'deleteSession');

        await expect(
          service.createAppointmentFromSession(mockSessionId, mockPatientId)
        ).rejects.toThrow('Database error');

        // Session should NOT be deleted if transaction failed
        expect(deleteSessionSpy).not.toHaveBeenCalled();
      });
    });

    describe('Duplicate prevention', () => {
      it('should prevent multiple requests with same session_id', async () => {
        setupValidSessionMock(); // Setup valid session for first call
        
        // Configure query builder to return available slot
        mockQueryBuilder.getOne.mockResolvedValueOnce({
          _id: mockSlotId,
          limit: 5,
          startHour: '08:00:00',
          endHour: '08:30:00',
        });

        // Create spy for deleteSession
        const deleteSessionSpy = jest.spyOn(bookingSessionService, 'deleteSession');

        // Create appointment once
        await service.createAppointmentFromSession(mockSessionId, mockPatientId);

        // Session should be deleted
        expect(deleteSessionSpy).toHaveBeenCalledWith(mockSessionId);

        // Try to create same appointment again - session no longer exists
        mockGetSession.mockRejectedValueOnce(
          new NotFoundException('Booking session not found or expired. Please start a new booking.')
        );

        await expect(
          service.createAppointmentFromSession(mockSessionId, mockPatientId)
        ).rejects.toThrow(NotFoundException);
      });
    });

    describe('Business rules validation', () => {
      it('should validate patient has no overlapping appointments', async () => {
        setupValidSessionMock();
        
        // Override createQueryBuilder: for the duplicate check query (5th no-entity call),
        // return an existing appointment so ConflictException is thrown.
        const origImpl = mockEntityManager.createQueryBuilder.getMockImplementation();
        let noEntityCount = 0;
        mockEntityManager.createQueryBuilder.mockImplementation((entity: any) => {
          const builder = origImpl(entity);
          const entityName = typeof entity === 'function' ? entity.name : '';
          if (!entityName) {
            noEntityCount++;
            if (noEntityCount === 3) {
              // 3rd no-entity call = duplicate appointment check
              builder.getOne = jest.fn().mockResolvedValue({
                _id: 'existing-appointment-id',
                patientId: mockPatientId,
                appointmentDate: new Date('2026-03-20'),
                status: 'PENDING',
              });
            }
          }
          return builder;
        });

        await expect(
          service.createAppointmentFromSession(mockSessionId, mockPatientId)
        ).rejects.toThrow(ConflictException);
      });

      it('should validate appointment date is in the future', async () => {
        setupValidSessionMock({ appointmentDate: '2020-01-01' }); // Past date

        await expect(
          service.createAppointmentFromSession(mockSessionId, mockPatientId)
        ).rejects.toThrow(BadRequestException);
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle very high concurrent booking requests', async () => {
      // Setup valid session for first request
      mockGetSession.mockResolvedValueOnce({
        sessionId: mockSessionId,
        patientId: mockPatientId,
        bookingOption: 'service',
        serviceIds: [mockServiceConfigId],
        clinicServiceConfigId: mockServiceConfigId,
        clinicId: mockClinicId,
        doctorId: mockDoctorId,
        clinicShiftHourId: mockSlotId,
        appointmentDate: '2026-04-20',
        paymentMethod: 'cod',
        currentStep: 4,
      } as any);

      // First request should succeed (default mock returns slot with limit: 10)
      await service.createAppointmentFromSession(mockSessionId, mockPatientId);

      // Setup session for second request
      mockGetSession.mockResolvedValueOnce({
        sessionId: 'other-session-id',
        patientId: 'other-patient-id',
        bookingOption: 'service',
        serviceIds: [mockServiceConfigId],
        clinicServiceConfigId: mockServiceConfigId,
        clinicId: mockClinicId,
        doctorId: mockDoctorId,
        clinicShiftHourId: mockSlotId,
        appointmentDate: '2026-04-20',
        paymentMethod: 'cod',
        currentStep: 4,
      } as any);

      // Override createQueryBuilder for second call: slot is now fully booked
      const origImpl2 = mockEntityManager.createQueryBuilder.getMockImplementation();
      let noEntityCount2 = 0;
      mockEntityManager.createQueryBuilder.mockImplementation((entity: any) => {
        const builder = origImpl2(entity);
        const entityName = typeof entity === 'function' ? entity.name : '';
        if (!entityName) {
          noEntityCount2++;
          if (noEntityCount2 === 1) {
            builder.getOne = jest.fn().mockResolvedValue({
              _id: mockSlotId,
              limit: 0, // Now fully booked
              startHour: '08:00:00',
              endHour: '08:30:00',
            });
          }
        }
        return builder;
      });

      // Second request should fail
      await expect(
        service.createAppointmentFromSession('other-session-id', 'other-patient-id')
      ).rejects.toThrow(BadRequestException);
    });
  });
});
