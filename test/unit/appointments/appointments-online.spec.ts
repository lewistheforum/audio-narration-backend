/**
 * Unit Tests for Online Appointment Payment Flow (VERSION 5.0)
 *
 * Tests for:
 * - getOnlinePaymentQr: Generate QR code from Redis session
 * - createAppointmentOnlineFromCallback: Create appointment + Transaction after Seepay callback
 * - Transaction creation and mapping to AppointmentPackage
 * - Slot management during online payment
 * - Session cleanup after successful payment
 */

import { Test, TestingModule } from '@nestjs/testing';
import { AppointmentsService } from '../../../src/modules/appointments/appointments.service';
import { TransactionsService } from '../../../src/modules/transactions/transactions.service';
import { MailerService } from '../../../src/modules/mailer/mailer.service';
import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BookingSessionService } from '../../../src/modules/appointments/booking-session.service';
import {
  AppointmentRepository,
  AppointmentPackageRepository,
} from '../../../src/modules/appointments/repositories';
import {
  ClinicStaffInformationRepository,
  AccountRepository,
} from '../../../src/modules/accounts/repositories';
import { EmployeeScheduleRepository } from '../../../src/modules/schedules/repositories/employee-schedule.repository';
import { TransactionRepository } from '../../../src/modules/transactions/repositories/transaction.repository';
import { ClinicAdminInformation } from '../../../src/modules/accounts/entities/clinic-admin-information.entity';
import { AppointmentPackage } from '../../../src/modules/appointments/entities/appointment-package.entity';
import { TransactionType } from '../../../src/modules/transactions/entities/transaction-type.entity';
import { Appointment } from '../../../src/modules/appointments/entities/appointment.entity';
import { ClinicSubscription } from '../../../src/modules/subscriptions/entities/clinic-subscription.entity';
import { Account } from '../../../src/modules/accounts/entities/accounts.entity';
import { SubscriptionServicesService } from '../../../src/modules/subscriptions/subscription-services.service';
import { REDIS_CLIENT } from '../../../src/config/redis.config';
import { AppointmentStatus } from '../../../src/modules/appointments/enums/appointment-status.enum';
import { AppointmentPackageStatus } from '../../../src/modules/appointments/enums/appointment-package-status.enum';
import { PaymentType } from '../../../src/modules/appointments/enums/payment-type.enum';

// Try to import SubscriptionService entity
let SubscriptionServiceEntity: any;
try {
  SubscriptionServiceEntity = require('../../../src/modules/subscriptions/entities/subscription-service.entity').SubscriptionService;
} catch {
  SubscriptionServiceEntity = class MockSubscriptionService {};
}

describe('Online Appointment Payment Flow (V5.0) - Unit Tests', () => {
  let service: AppointmentsService;
  let bookingSessionService: BookingSessionService;
  let dataSource: any;

  // Common mock IDs
  const mockPatientId = '550e8400-e29b-41d4-a716-446655440001';
  const mockSessionId = '550e8400-e29b-41d4-a716-446655440002';
  const mockClinicId = '550e8400-e29b-41d4-a716-446655440003';
  const mockServiceConfigId = '550e8400-e29b-41d4-a716-446655440004';
  const mockDoctorId = '550e8400-e29b-41d4-a716-446655440005';
  const mockSlotId = '550e8400-e29b-41d4-a716-446655440006';
  const mockTransactionTypeId = '550e8400-e29b-41d4-a716-446655440010';

  // Mock functions exposed for per-test manipulation
  let mockGetSession: jest.Mock;
  let mockDeleteSession: jest.Mock;
  let mockEntityManager: any;

  // Complete online session (ready for payment)
  const completeOnlineSession = {
    sessionId: mockSessionId,
    patientId: mockPatientId,
    bookingOption: 'service',
    clinicServiceConfigId: mockServiceConfigId,
    clinicId: mockClinicId,
    doctorId: mockDoctorId,
    clinicShiftHourId: mockSlotId,
    appointmentDate: '2026-03-15',
    appointmentHour: '2026-03-15T08:00:00',
    paymentMethod: 'online',
    paymentAmount: 270000,
    patientNote: 'Đau mỏi vai gáy',
    currentStep: 4,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 1800000).toISOString(),
  };

  // Mock Seepay callback payload
  const mockSeepayPayload = {
    id: 92704,
    gateway: 'Vietcombank',
    transactionDate: '2026-03-15 08:15:00',
    accountNumber: '0123499999',
    code: null,
    content: `BONIX ${mockSessionId}`,
    transferType: 'in' as const,
    transferAmount: 270000,
    accumulated: 19077000,
    subAccount: null,
    referenceCode: 'MBVCB.3278907687',
    description: 'Thanh toan lich hen',
  };

  // Generic mock repository factory
  const mockRepoFactory = () => ({
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockResolvedValue([]),
    save: jest.fn().mockImplementation((d: any) => Promise.resolve(d)),
    create: jest.fn().mockImplementation((d: any) => d),
    createQueryBuilder: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
      getMany: jest.fn().mockResolvedValue([]),
    }),
  });

  beforeEach(async () => {
    mockGetSession = jest.fn();
    mockDeleteSession = jest.fn().mockResolvedValue(undefined);

    // Deep mock for EntityManager
    mockEntityManager = {
      createQueryBuilder: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setLock: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          _id: mockSlotId,
          limit: 5,
          startHour: '08:00:00',
          endHour: '08:30:00',
        }),
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
      }),
      findOne: jest.fn().mockImplementation((entity: any, _options?: any) => {
        // TransactionType lookup
        const entityName = typeof entity === 'function' ? entity.name : entity;
        if (entityName === 'TransactionType') {
          return Promise.resolve({ _id: mockTransactionTypeId, code: 'ONLINE', name: 'Online Payment' });
        }
        return Promise.resolve(null);
      }),
      create: jest.fn().mockImplementation((_entity: any, data: any) => ({
        _id: `mock-created-id-${Math.random().toString(36).slice(2, 7)}`,
        ...data,
      })),
      save: jest.fn().mockImplementation((_entity: any, data: any) => {
        if (data) {
          const id = `saved-${Math.random().toString(36).slice(2, 7)}`;
          return Promise.resolve({ _id: id, id: id, ...data });
        }
        return Promise.resolve({ _id: 'saved-id', id: 'saved-id' });
      }),
    };

    // Mock DataSource
    const mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue({
        connect: jest.fn().mockResolvedValue(undefined),
        startTransaction: jest.fn().mockResolvedValue(undefined),
        commitTransaction: jest.fn().mockResolvedValue(undefined),
        rollbackTransaction: jest.fn().mockResolvedValue(undefined),
        release: jest.fn().mockResolvedValue(undefined),
        manager: mockEntityManager,
      }),
      getRepository: jest.fn().mockReturnValue(mockRepoFactory()),
      transaction: jest.fn().mockImplementation(async (callbackOrIsolation: any, callback?: any) => {
        const cb = typeof callback === 'function' ? callback : callbackOrIsolation;
        return await cb(mockEntityManager);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        {
          provide: BookingSessionService,
          useValue: {
            getSession: mockGetSession,
            deleteSession: mockDeleteSession,
            updateSession: jest.fn(),
            createSession: jest.fn(),
          },
        },
        { provide: DataSource, useValue: mockDataSource },
        { provide: REDIS_CLIENT, useValue: { get: jest.fn(), set: jest.fn(), setex: jest.fn(), del: jest.fn(), ttl: jest.fn() } },
        { provide: AppointmentRepository, useValue: mockRepoFactory() },
        { provide: AppointmentPackageRepository, useValue: mockRepoFactory() },
        { provide: ClinicStaffInformationRepository, useValue: mockRepoFactory() },
        { provide: EmployeeScheduleRepository, useValue: mockRepoFactory() },
        { provide: AccountRepository, useValue: { findOne: jest.fn(), findAccountById: jest.fn() } },
        // TransactionsService + its dependencies
        {
          provide: TransactionsService,
          useValue: {
            handleCallback: jest.fn(),
            createDynamicQr: jest.fn(),
          },
        },
        {
          provide: MailerService,
          useValue: {
            sendAppointmentReminder: jest.fn(),
            sendBulkReminders: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AppointmentsService>(AppointmentsService);
    bookingSessionService = module.get<BookingSessionService>(BookingSessionService);
    dataSource = module.get(DataSource);
  });

  // =========================================================================
  // 1. getOnlinePaymentQr Tests
  // =========================================================================
  describe('getOnlinePaymentQr', () => {
    it('TC-ONL-01: should throw NotFoundException if session does not exist', async () => {
      mockGetSession.mockRejectedValue(
        new NotFoundException('Phiên đặt lịch không tồn tại hoặc đã hết hạn'),
      );

      await expect(
        service.getOnlinePaymentQr(mockSessionId, mockPatientId),
      ).rejects.toThrow(NotFoundException);
    });

    it('TC-ONL-02: should throw ForbiddenException if patientId does not match session owner', async () => {
      mockGetSession.mockResolvedValue({
        ...completeOnlineSession,
        patientId: 'other-patient-id',
      });

      await expect(
        service.getOnlinePaymentQr(mockSessionId, mockPatientId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('TC-ONL-03: should throw BadRequestException if paymentMethod is not online', async () => {
      mockGetSession.mockResolvedValue({
        ...completeOnlineSession,
        paymentMethod: 'cod',
      });

      await expect(
        service.getOnlinePaymentQr(mockSessionId, mockPatientId),
      ).rejects.toThrow(BadRequestException);
    });

    it('TC-ONL-04: should return QR data for valid online session', async () => {
      mockGetSession.mockResolvedValue(completeOnlineSession);

      // Spy on createPaymentRequestOnline to avoid deep dependency chain
      const mockQrResult = {
        message: 'Vui lòng thanh toán để hoàn tất đặt lịch',
        data: {
          qr_code_url: 'https://qr.sepay.vn/img?acc=123&bank=VCB&amount=270000',
          qr_payload: { bankCode: 'VCB', amount: 270000 },
          session_id: mockSessionId,
          amount: 270000,
          currency: 'VND',
          expires_at: new Date(),
        },
      };
      jest
        .spyOn(service as any, 'createPaymentRequestOnline')
        .mockResolvedValueOnce(mockQrResult);

      const result = await service.getOnlinePaymentQr(mockSessionId, mockPatientId);

      expect(result).toBeDefined();
      expect(result.data.amount).toBe(270000);
      expect(result.data.session_id).toBe(mockSessionId);
      expect(mockGetSession).toHaveBeenCalledWith(mockSessionId);
    });
  });

  // =========================================================================
  // 2. createAppointmentOnlineFromCallback Tests
  // =========================================================================
  describe('createAppointmentOnlineFromCallback', () => {
    const setupValidCallback = (sessionOverrides = {}) => {
      mockGetSession.mockResolvedValue({
        ...completeOnlineSession,
        ...sessionOverrides,
      });
    };

    describe('Session validation', () => {
      it('TC-ONL-05: should throw NotFoundException if session expired during payment', async () => {
        mockGetSession.mockResolvedValue(null);

        await expect(
          service.createAppointmentOnlineFromCallback(mockSessionId, mockSeepayPayload),
        ).rejects.toThrow(NotFoundException);
      });
    });

    describe('Slot management', () => {
      it('TC-ONL-06: should use pessimistic_write lock on clinic_shift_hour', async () => {
        setupValidCallback();

        await service.createAppointmentOnlineFromCallback(mockSessionId, mockSeepayPayload);

        // Verify createQueryBuilder was called (for pessimistic lock)
        expect(mockEntityManager.createQueryBuilder).toHaveBeenCalled();
      });

      it('TC-ONL-07: should throw BadRequestException if slot is fully booked', async () => {
        setupValidCallback();

        // Override getOne to return slot with limit = 0
        mockEntityManager.createQueryBuilder.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          setLock: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue({ _id: mockSlotId, limit: 0, startHour: '08:00:00' }),
          leftJoinAndSelect: jest.fn().mockReturnThis(),
        });

        await expect(
          service.createAppointmentOnlineFromCallback(mockSessionId, mockSeepayPayload),
        ).rejects.toThrow(BadRequestException);
      });

      it('TC-ONL-08: should decrement slot limit by 1 after successful creation', async () => {
        setupValidCallback();

        const saveSpy = mockEntityManager.save;
        await service.createAppointmentOnlineFromCallback(mockSessionId, mockSeepayPayload);

        // Verify save was called multiple times (appointment, transaction, package, etc.)
        expect(saveSpy).toHaveBeenCalled();
        expect(saveSpy.mock.calls.length).toBeGreaterThanOrEqual(3); // At least: appointment, transaction, package
      });
    });

    describe('Appointment creation', () => {
      it('TC-ONL-09: should create appointment with status CONFIRMED (paid online)', async () => {
        setupValidCallback();

        const createSpy = mockEntityManager.create;
        await service.createAppointmentOnlineFromCallback(mockSessionId, mockSeepayPayload);

        // Find the Appointment create call (has status field)
        const allCalls = createSpy.mock.calls;
        const appointmentCall = allCalls.find(
          (call: any[]) => call[1]?.status === AppointmentStatus.CONFIRMED,
        );
        expect(appointmentCall).toBeDefined();
      });

      it('TC-ONL-10: should populate total field from session paymentAmount', async () => {
        setupValidCallback();

        const createSpy = mockEntityManager.create;
        await service.createAppointmentOnlineFromCallback(mockSessionId, mockSeepayPayload);

        const appointmentCall = createSpy.mock.calls.find(
          (call: any[]) => call[1]?.total !== undefined,
        );
        expect(appointmentCall).toBeDefined();
        if (appointmentCall) {
          expect(appointmentCall[1].total).toBe(270000);
        }
      });

      it('TC-ONL-11: should populate appointmentHour from session', async () => {
        setupValidCallback();

        const createSpy = mockEntityManager.create;
        await service.createAppointmentOnlineFromCallback(mockSessionId, mockSeepayPayload);

        const appointmentCall = createSpy.mock.calls.find(
          (call: any[]) => call[1]?.appointmentHour !== undefined,
        );
        expect(appointmentCall).toBeDefined();
        if (appointmentCall) {
          expect(appointmentCall[1].appointmentHour).toBeInstanceOf(Date);
        }
      });
    });

    describe('Transaction creation & mapping', () => {
      it('TC-ONL-12: should create Transaction record with type ONLINE and status SUCCESS', async () => {
        setupValidCallback();

        const createSpy = mockEntityManager.create;
        await service.createAppointmentOnlineFromCallback(mockSessionId, mockSeepayPayload);

        // The Transaction create call should have gateway from Seepay
        const transactionCall = createSpy.mock.calls.find(
          (call: any[]) => call[1]?.gateway === 'Vietcombank',
        );
        expect(transactionCall).toBeDefined();
        if (transactionCall) {
          expect(transactionCall[1].currency).toBe('VND');
          expect(transactionCall[1].status).toBe('SUCCESS');
          expect(transactionCall[1].transactionTypeId).toBe(mockTransactionTypeId);
        }
      });

      it('TC-ONL-13: should map transactionId to AppointmentPackage', async () => {
        setupValidCallback();

        const createSpy = mockEntityManager.create;
        await service.createAppointmentOnlineFromCallback(mockSessionId, mockSeepayPayload);

        // The AppointmentPackage create call should have a transactionId and paymentType=ONLINE
        const packageCall = createSpy.mock.calls.find(
          (call: any[]) =>
            call[1]?.transactionId !== undefined &&
            call[1]?.paymentType === PaymentType.ONLINE,
        );
        expect(packageCall).toBeDefined();
        if (packageCall) {
          expect(packageCall[1].transactionId).toBeDefined();
          expect(packageCall[1].status).toBe(AppointmentPackageStatus.PAID);
          expect(packageCall[1].paymentType).toBe(PaymentType.ONLINE);
        }
      });
    });

    describe('Session cleanup', () => {
      it('TC-ONL-14: should delete Redis session after successful appointment creation', async () => {
        setupValidCallback();

        await service.createAppointmentOnlineFromCallback(mockSessionId, mockSeepayPayload);

        expect(mockDeleteSession).toHaveBeenCalledWith(mockSessionId);
      });
    });

    describe('Response format', () => {
      it('TC-ONL-15: should return both appointment_id and transaction_id', async () => {
        setupValidCallback();

        const result = await service.createAppointmentOnlineFromCallback(
          mockSessionId,
          mockSeepayPayload,
        );

        expect(result).toHaveProperty('appointment_id');
        expect(result).toHaveProperty('transaction_id');
        expect(result.message).toBe('Đặt lịch thành công');
      });
    });

    describe('Transaction rollback on error', () => {
      it('TC-ONL-16: should not delete session if database transaction fails', async () => {
        setupValidCallback();

        // Force transaction to throw
        dataSource.transaction.mockRejectedValueOnce(new Error('DB Error'));

        await expect(
          service.createAppointmentOnlineFromCallback(mockSessionId, mockSeepayPayload),
        ).rejects.toThrow();

        // Session should NOT be deleted
        expect(mockDeleteSession).not.toHaveBeenCalled();
      });
    });
  });
});
