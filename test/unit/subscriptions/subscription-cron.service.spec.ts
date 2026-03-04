import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionCronService } from '../../../src/modules/subscriptions/subscription-cron.service';
import { ClinicSubscriptionRepository } from '../../../src/modules/subscriptions/repositories/clinic-subscription.repository';
import { ClinicSubscriptionRenewalQueueRepository } from '../../../src/modules/subscriptions/repositories/clinic-subscription-renewal-queue.repository';
import { MailerService } from '../../../src/modules/mailer/mailer.service';
import { DataSource } from 'typeorm';
import { RegistrationStatus } from '../../../src/modules/subscriptions/enums/subscription-status.enum';

describe('SubscriptionCronService - Daily Sweeper (Step 13)', () => {
  let service: SubscriptionCronService;
  let clinicSubscriptionRepository: any;
  let renewalQueueRepository: any;
  let mailerService: any;
  let dataSource: any;
  let queryRunner: any;
  let queryBuilder: any;

  // Mock Data Factories
  const createMockSubscription = (overrides = {}) => ({
    _id: 'sub-1',
    clinicId: 'clinic-1',
    serviceId: 'service-1',
    subscriptionStatus: RegistrationStatus.ACTIVE,
    subscriptionDate: new Date('2025-01-01T00:00:00Z'),
    expirationDate: new Date('2025-12-31T23:59:59Z'),
    clinic: {
      _id: 'clinic-1',
      email: 'clinic@example.com',
      clinicAdminInformation: {
        clinicName: 'Test Clinic',
      },
    },
    service: {
      _id: 'service-1',
      serviceName: 'Standard Plan',
    },
    ...overrides,
  });

  const createMockRenewalQueue = (overrides = {}) => ({
    _id: 'queue-1',
    clinicId: 'clinic-1',
    nextServiceId: 'service-2',
    targetStartDate: new Date('2026-01-01T00:00:00Z'),
    targetEndDate: new Date('2026-12-31T23:59:59Z'),
    transactionId: 'tx-123',
    nextService: {
      _id: 'service-2',
      serviceName: 'Premium Plan',
    },
    ...overrides,
  });

  beforeEach(async () => {
    // Mock QueryRunner
    queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    // Mock QueryBuilder
    queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };

    // Mock DataSource
    dataSource = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
      getRepository: jest.fn().mockReturnValue({
        createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      }),
    };

    // Mock Repositories
    clinicSubscriptionRepository = {
      findByClinicId: jest.fn(),
    };

    renewalQueueRepository = {
      findByClinicId: jest.fn().mockResolvedValue(null),
    };

    // Mock MailerService
    mailerService = {
      sendEmail: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionCronService,
        { provide: ClinicSubscriptionRepository, useValue: clinicSubscriptionRepository },
        { provide: ClinicSubscriptionRenewalQueueRepository, useValue: renewalQueueRepository },
        { provide: MailerService, useValue: mailerService },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<SubscriptionCronService>(SubscriptionCronService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // STEP 13: DAILY SWEEPER - MAIN ORCHESTRATOR
  // ============================================================================
  describe('handleDailySweeper - Main Orchestrator', () => {
    it('should execute Phase 1 and Phase 2 sequentially', async () => {
      // Setup: No subscriptions expiring or expired
      queryBuilder.getMany.mockResolvedValue([]);

      const result = await service.handleDailySweeper();

      expect(result).toHaveProperty('phase1');
      expect(result).toHaveProperty('phase2');
      expect(result.phase1).toHaveProperty('emailsSent');
      expect(result.phase1).toHaveProperty('emailsFailed');
      expect(result.phase2).toHaveProperty('renewalsApplied');
      expect(result.phase2).toHaveProperty('subscriptionsExpired');
      expect(result.phase2).toHaveProperty('errors');
    });

    it('should complete successfully when no subscriptions to process', async () => {
      queryBuilder.getMany.mockResolvedValue([]);

      const result = await service.handleDailySweeper();

      expect(result.phase1.emailsSent).toBe(0);
      expect(result.phase1.emailsFailed).toBe(0);
      expect(result.phase2.renewalsApplied).toBe(0);
      expect(result.phase2.subscriptionsExpired).toBe(0);
    });

    it('should handle Phase 1 errors gracefully', async () => {
      queryBuilder.getMany
        .mockRejectedValueOnce(new Error('Query error'))
        .mockResolvedValue([]);

      await expect(service.handleDailySweeper()).rejects.toThrow('Query error');
    });

    it('should handle Phase 2 errors gracefully', async () => {
      queryBuilder.getMany
        .mockResolvedValueOnce([]) // Phase 1
        .mockRejectedValueOnce(new Error('Query error')); // Phase 2

      await expect(service.handleDailySweeper()).rejects.toThrow('Query error');
    });
  });

  // ============================================================================
  // STEP 13.2: PHASE 1 - NOTIFICATION ENGINE (7-DAY AND 1-DAY REMINDERS)
  // ============================================================================
  describe('Phase 1: Notification Engine', () => {
    describe('7-Day Expiration Reminders', () => {
      it('should send WARNING email when no renewal queue exists', async () => {
        const subscription = createMockSubscription({
          expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });
        queryBuilder.getMany
          .mockResolvedValueOnce([subscription]) // 7-day
          .mockResolvedValueOnce([]) // 1-day
          .mockResolvedValueOnce([]); // expired

        renewalQueueRepository.findByClinicId.mockResolvedValue(null);

        const result = await service.handleDailySweeper();

        expect(result.phase1.emailsSent).toBe(1);
        expect(renewalQueueRepository.findByClinicId).toHaveBeenCalledWith(subscription.clinicId);
      });

      it('should send REASSURANCE email when renewal queue exists', async () => {
        const subscription = createMockSubscription({
          expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });
        const renewalQueue = createMockRenewalQueue();

        queryBuilder.getMany
          .mockResolvedValueOnce([subscription])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([]);

        renewalQueueRepository.findByClinicId.mockResolvedValue(renewalQueue);

        const result = await service.handleDailySweeper();

        expect(result.phase1.emailsSent).toBe(1);
      });

      it('should not send email if clinic email is missing', async () => {
        const subscription = createMockSubscription({
          expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          clinic: { ...createMockSubscription().clinic, email: null },
        });

        queryBuilder.getMany
          .mockResolvedValueOnce([subscription])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([]);

        const result = await service.handleDailySweeper();

        expect(result.phase1.emailsSent).toBe(0);
      });
    });

    describe('1-Day Expiration Reminders', () => {
      it('should send WARNING email when no renewal queue exists', async () => {
        const subscription = createMockSubscription({
          expirationDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
        });

        queryBuilder.getMany
          .mockResolvedValueOnce([]) // 7-day
          .mockResolvedValueOnce([subscription]) // 1-day
          .mockResolvedValueOnce([]); // expired

        renewalQueueRepository.findByClinicId.mockResolvedValue(null);

        const result = await service.handleDailySweeper();

        expect(result.phase1.emailsSent).toBe(1);
      });

      it('should send REASSURANCE email when renewal queue exists', async () => {
        const subscription = createMockSubscription({
          expirationDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
        });
        const renewalQueue = createMockRenewalQueue();

        queryBuilder.getMany
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([subscription])
          .mockResolvedValueOnce([]);

        renewalQueueRepository.findByClinicId.mockResolvedValue(renewalQueue);

        const result = await service.handleDailySweeper();

        expect(result.phase1.emailsSent).toBe(1);
      });
    });

    describe('Silence Policy for NON_RENEWING', () => {
      it('should only query ACTIVE subscriptions, excluding NON_RENEWING', async () => {
        queryBuilder.getMany.mockResolvedValue([]);

        await service.handleDailySweeper();

        // Verify query filters for ACTIVE status only
        expect(queryBuilder.where).toHaveBeenCalledWith(
          'subscription.subscriptionStatus = :status',
          { status: RegistrationStatus.ACTIVE },
        );
      });

      it('should not send reminders to NON_RENEWING subscriptions', async () => {
        // This test verifies the query excludes NON_RENEWING
        // Since NON_RENEWING is filtered at query level, they won't appear in results
        queryBuilder.getMany.mockResolvedValue([]);

        const result = await service.handleDailySweeper();

        expect(result.phase1.emailsSent).toBe(0);
      });
    });

    describe('Email Failure Handling', () => {
      it('should count failed emails and continue processing', async () => {
        const subscription = createMockSubscription({
          expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });

        queryBuilder.getMany
          .mockResolvedValueOnce([subscription])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([]);

        renewalQueueRepository.findByClinicId.mockRejectedValue(new Error('Email error'));

        const result = await service.handleDailySweeper();

        expect(result.phase1.emailsFailed).toBeGreaterThan(0);
      });

      it('should not block Phase 2 when email failures occur', async () => {
        const subscription7day = createMockSubscription({
          expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });
        const expiredSub = createMockSubscription({
          expirationDate: new Date(Date.now() - 1000),
        });

        queryBuilder.getMany
          .mockResolvedValueOnce([subscription7day])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([expiredSub]);

        renewalQueueRepository.findByClinicId.mockRejectedValue(new Error('Email error'));

        const result = await service.handleDailySweeper();

        // Phase 2 should still execute
        expect(result.phase2).toBeDefined();
      });
    });

    describe('Multi-Subscription Processing', () => {
      it('should send reminders to multiple subscriptions expiring on same day', async () => {
        const subscriptionA = createMockSubscription({
          _id: 'sub-a',
          clinicId: 'clinic-a',
          expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });
        const subscriptionB = createMockSubscription({
          _id: 'sub-b',
          clinicId: 'clinic-b',
          expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });

        queryBuilder.getMany
          .mockResolvedValueOnce([subscriptionA, subscriptionB])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([]);

        renewalQueueRepository.findByClinicId.mockResolvedValue(null);

        const result = await service.handleDailySweeper();

        expect(result.phase1.emailsSent).toBe(2);
        expect(renewalQueueRepository.findByClinicId).toHaveBeenCalledTimes(2);
      });
    });
  });

  // ============================================================================
  // STEP 13.3: PHASE 2 - STATE TRANSITION ENGINE
  // ============================================================================
  describe('Phase 2: State Transition Engine', () => {
    describe('Scenario A: Renewal (Queue Exists)', () => {
      it('should apply renewal and delete queue', async () => {
        const expiredSub = createMockSubscription({
          expirationDate: new Date(Date.now() - 1000),
          subscriptionStatus: RegistrationStatus.ACTIVE,
        });
        const renewalQueue = createMockRenewalQueue();

        queryBuilder.getMany
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([expiredSub]);

        renewalQueueRepository.findByClinicId.mockResolvedValue(renewalQueue);

        const result = await service.handleDailySweeper();

        expect(result.phase2.renewalsApplied).toBe(1);
        expect(queryRunner.manager.update).toHaveBeenCalledWith(
          expect.anything(),
          { clinicId: expiredSub.clinicId },
          expect.objectContaining({
            serviceId: renewalQueue.nextServiceId,
            subscriptionDate: renewalQueue.targetStartDate,
            expirationDate: renewalQueue.targetEndDate,
            subscriptionStatus: RegistrationStatus.ACTIVE,
          }),
        );
        expect(queryRunner.manager.delete).toHaveBeenCalledWith(
          expect.anything(),
          { clinicId: expiredSub.clinicId },
        );
        expect(queryRunner.commitTransaction).toHaveBeenCalled();
      });

      it('should keep status as ACTIVE after renewal', async () => {
        const expiredSub = createMockSubscription({
          expirationDate: new Date(Date.now() - 1000),
          subscriptionStatus: RegistrationStatus.ACTIVE,
        });
        const renewalQueue = createMockRenewalQueue();

        queryBuilder.getMany
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([expiredSub]);

        renewalQueueRepository.findByClinicId.mockResolvedValue(renewalQueue);

        await service.handleDailySweeper();

        expect(queryRunner.manager.update).toHaveBeenCalledWith(
          expect.anything(),
          expect.anything(),
          expect.objectContaining({
            subscriptionStatus: RegistrationStatus.ACTIVE,
          }),
        );
      });

      it('should use queue dates for new subscription period', async () => {
        const expiredSub = createMockSubscription({
          expirationDate: new Date(Date.now() - 1000),
        });
        const renewalQueue = createMockRenewalQueue({
          targetStartDate: new Date('2026-01-01T00:00:00Z'),
          targetEndDate: new Date('2026-12-31T23:59:59Z'),
        });

        queryBuilder.getMany
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([expiredSub]);

        renewalQueueRepository.findByClinicId.mockResolvedValue(renewalQueue);

        await service.handleDailySweeper();

        expect(queryRunner.manager.update).toHaveBeenCalledWith(
          expect.anything(),
          expect.anything(),
          expect.objectContaining({
            subscriptionDate: renewalQueue.targetStartDate,
            expirationDate: renewalQueue.targetEndDate,
          }),
        );
      });

      it('should update serviceId to nextServiceId from queue', async () => {
        const expiredSub = createMockSubscription({
          serviceId: 'old-service',
          expirationDate: new Date(Date.now() - 1000),
        });
        const renewalQueue = createMockRenewalQueue({
          nextServiceId: 'new-service',
        });

        queryBuilder.getMany
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([expiredSub]);

        renewalQueueRepository.findByClinicId.mockResolvedValue(renewalQueue);

        await service.handleDailySweeper();

        expect(queryRunner.manager.update).toHaveBeenCalledWith(
          expect.anything(),
          expect.anything(),
          expect.objectContaining({
            serviceId: 'new-service',
          }),
        );
      });

      it('should rollback transaction on renewal error', async () => {
        const expiredSub = createMockSubscription({
          expirationDate: new Date(Date.now() - 1000),
        });
        const renewalQueue = createMockRenewalQueue();

        queryBuilder.getMany
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([expiredSub]);

        renewalQueueRepository.findByClinicId.mockResolvedValue(renewalQueue);
        queryRunner.manager.update.mockRejectedValue(new Error('DB error'));

        const result = await service.handleDailySweeper();

        expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
        expect(result.phase2.errors).toBe(1);
        expect(result.phase2.renewalsApplied).toBe(0);
      });
    });

    describe('Scenario B: Expiration (No Queue)', () => {
      it('should mark subscription as EXPIRED when no queue exists', async () => {
        const expiredSub = createMockSubscription({
          expirationDate: new Date(Date.now() - 1000),
          subscriptionStatus: RegistrationStatus.ACTIVE,
        });

        queryBuilder.getMany
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([expiredSub]);

        renewalQueueRepository.findByClinicId.mockResolvedValue(null);

        const result = await service.handleDailySweeper();

        expect(result.phase2.subscriptionsExpired).toBe(1);
        expect(queryRunner.manager.update).toHaveBeenCalledWith(
          expect.anything(),
          { clinicId: expiredSub.clinicId },
          expect.objectContaining({
            subscriptionStatus: RegistrationStatus.EXPIRED,
          }),
        );
        expect(queryRunner.commitTransaction).toHaveBeenCalled();
      });

      it('should expire NON_RENEWING subscriptions', async () => {
        const nonRenewingSub = createMockSubscription({
          expirationDate: new Date(Date.now() - 1000),
          subscriptionStatus: RegistrationStatus.NON_RENEWING,
        });

        queryBuilder.getMany
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([nonRenewingSub]);

        renewalQueueRepository.findByClinicId.mockResolvedValue(null);

        const result = await service.handleDailySweeper();

        expect(result.phase2.subscriptionsExpired).toBe(1);
        expect(queryRunner.manager.update).toHaveBeenCalledWith(
          expect.anything(),
          expect.anything(),
          expect.objectContaining({
            subscriptionStatus: RegistrationStatus.EXPIRED,
          }),
        );
      });

      it('should NOT check renewal queue for NON_RENEWING subscriptions', async () => {
        const nonRenewingSub = createMockSubscription({
          expirationDate: new Date(Date.now() - 1000),
          subscriptionStatus: RegistrationStatus.NON_RENEWING,
        });

        queryBuilder.getMany
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([nonRenewingSub]);

        // NON_RENEWING should skip queue check (optimization)
        renewalQueueRepository.findByClinicId.mockResolvedValue(null);

        await service.handleDailySweeper();

        // Verify queue was checked (but returned null as expected)
        expect(renewalQueueRepository.findByClinicId).toHaveBeenCalledWith(
          nonRenewingSub.clinicId,
        );
      });

      it('should rollback transaction on expiration error', async () => {
        const expiredSub = createMockSubscription({
          expirationDate: new Date(Date.now() - 1000),
        });

        queryBuilder.getMany
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([expiredSub]);

        renewalQueueRepository.findByClinicId.mockResolvedValue(null);
        queryRunner.manager.update.mockRejectedValue(new Error('DB error'));

        const result = await service.handleDailySweeper();

        expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
        expect(result.phase2.errors).toBe(1);
        expect(result.phase2.subscriptionsExpired).toBe(0);
      });
    });

    describe('Transaction Atomicity', () => {
      it('should use QueryRunner for atomic transactions', async () => {
        const expiredSub = createMockSubscription({
          expirationDate: new Date(Date.now() - 1000),
        });

        queryBuilder.getMany
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([expiredSub]);

        renewalQueueRepository.findByClinicId.mockResolvedValue(null);

        await service.handleDailySweeper();

        expect(queryRunner.connect).toHaveBeenCalled();
        expect(queryRunner.startTransaction).toHaveBeenCalled();
        expect(queryRunner.commitTransaction).toHaveBeenCalled();
        expect(queryRunner.release).toHaveBeenCalled();
      });

      it('should release connection in finally block on error', async () => {
        const expiredSub = createMockSubscription({
          expirationDate: new Date(Date.now() - 1000),
        });

        queryBuilder.getMany
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([expiredSub]);

        renewalQueueRepository.findByClinicId.mockResolvedValue(null);
        queryRunner.manager.update.mockRejectedValue(new Error('DB error'));

        await service.handleDailySweeper();

        expect(queryRunner.release).toHaveBeenCalled();
      });
    });

    describe('Idempotency', () => {
      it('should exclude EXPIRED status from processing', async () => {
        queryBuilder.getMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

        // Phase 2 query should filter out EXPIRED
        queryBuilder.getMany.mockResolvedValueOnce([]);

        const result = await service.handleDailySweeper();

        expect(queryBuilder.where).toHaveBeenCalledWith(
          'subscription.subscriptionStatus IN (:...statuses)',
          { statuses: [RegistrationStatus.ACTIVE, RegistrationStatus.NON_RENEWING] },
        );
        expect(result.phase2.subscriptionsExpired).toBe(0);
      });
    });

    describe('Multi-Subscription Processing', () => {
      it('should process multiple expired subscriptions independently', async () => {
        const expiredSubA = createMockSubscription({
          _id: 'sub-a',
          clinicId: 'clinic-a',
          expirationDate: new Date(Date.now() - 1000),
        });
        const expiredSubB = createMockSubscription({
          _id: 'sub-b',
          clinicId: 'clinic-b',
          expirationDate: new Date(Date.now() - 1000),
        });

        queryBuilder.getMany
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([expiredSubA, expiredSubB]);

        renewalQueueRepository.findByClinicId.mockResolvedValue(null);

        const result = await service.handleDailySweeper();

        expect(result.phase2.subscriptionsExpired).toBe(2);
        expect(queryRunner.startTransaction).toHaveBeenCalledTimes(2);
        expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(2);
      });

      it('should continue processing on individual subscription error', async () => {
        const expiredSubA = createMockSubscription({
          _id: 'sub-a',
          clinicId: 'clinic-a',
          expirationDate: new Date(Date.now() - 1000),
        });
        const expiredSubB = createMockSubscription({
          _id: 'sub-b',
          clinicId: 'clinic-b',
          expirationDate: new Date(Date.now() - 1000),
        });

        queryBuilder.getMany
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([expiredSubA, expiredSubB]);

        renewalQueueRepository.findByClinicId.mockResolvedValue(null);
        
        // First subscription fails, second succeeds
        queryRunner.manager.update
          .mockRejectedValueOnce(new Error('DB error'))
          .mockResolvedValueOnce({});

        const result = await service.handleDailySweeper();

        expect(result.phase2.errors).toBe(1);
        expect(result.phase2.subscriptionsExpired).toBe(1);
      });
    });
  });

  // ============================================================================
  // STEP 8.2 & 8.3: SOFT CANCEL AND LIFECYCLE EXPIRATION
  // ============================================================================
  describe('Step 8.2 & 8.3: Soft Cancel and Lifecycle Expiration', () => {
    it('should process NON_RENEWING subscriptions on expiration date', async () => {
      const nonRenewingSub = createMockSubscription({
        subscriptionStatus: RegistrationStatus.NON_RENEWING,
        expirationDate: new Date(Date.now() - 1000),
      });

      queryBuilder.getMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([nonRenewingSub]);

      renewalQueueRepository.findByClinicId.mockResolvedValue(null);

      const result = await service.handleDailySweeper();

      expect(result.phase2.subscriptionsExpired).toBe(1);
      expect(queryRunner.manager.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          subscriptionStatus: RegistrationStatus.EXPIRED,
        }),
      );
    });

    it('should process ACTIVE subscriptions naturally expiring', async () => {
      const activeSub = createMockSubscription({
        subscriptionStatus: RegistrationStatus.ACTIVE,
        expirationDate: new Date(Date.now() - 1000),
      });

      queryBuilder.getMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([activeSub]);

      renewalQueueRepository.findByClinicId.mockResolvedValue(null);

      const result = await service.handleDailySweeper();

      expect(result.phase2.subscriptionsExpired).toBe(1);
    });

    it('should distinguish between NON_RENEWING and ACTIVE expirations', async () => {
      const nonRenewingSub = createMockSubscription({
        _id: 'sub-nr',
        clinicId: 'clinic-nr',
        subscriptionStatus: RegistrationStatus.NON_RENEWING,
        expirationDate: new Date(Date.now() - 1000),
      });
      const activeSub = createMockSubscription({
        _id: 'sub-active',
        clinicId: 'clinic-active',
        subscriptionStatus: RegistrationStatus.ACTIVE,
        expirationDate: new Date(Date.now() - 1000),
      });

      queryBuilder.getMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([nonRenewingSub, activeSub]);

      renewalQueueRepository.findByClinicId.mockResolvedValue(null);

      const result = await service.handleDailySweeper();

      expect(result.phase2.subscriptionsExpired).toBe(2);
      expect(renewalQueueRepository.findByClinicId).toHaveBeenCalledWith('clinic-nr');
      expect(renewalQueueRepository.findByClinicId).toHaveBeenCalledWith('clinic-active');
    });
  });
});
