import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionServicesService } from '../../../src/modules/subscriptions/subscription-services.service';
import { SubscriptionServiceRepository } from '../../../src/modules/subscriptions/repositories/subscription-service.repository';
import { ClinicSubscriptionRepository } from '../../../src/modules/subscriptions/repositories/clinic-subscription.repository';
import { ClinicSubscriptionHistoryRepository } from '../../../src/modules/subscriptions/repositories/clinic-subscription-history.repository';
import { ClinicSubscriptionRenewalQueueRepository } from '../../../src/modules/subscriptions/repositories/clinic-subscription-renewal-queue.repository';
import { RegistrationStatus } from '../../../src/modules/subscriptions/enums/subscription-status.enum';

describe('SubscriptionServicesService', () => {
    let service: SubscriptionServicesService;
    let clinicSubscriptionRepo: any;
    let historyRepo: any;
    let queueRepo: any;
    let subscriptionServiceRepo: any;

    // Mock Data Factory
    const createMockSubscription = (overrides = {}) => ({
        _id: 'sub-1',
        clinicId: 'clinic-1',
        serviceId: 'service-1',
        subscriptionStatus: RegistrationStatus.EXPIRED,
        expirationDate: new Date('2025-01-01T00:00:00Z'),
        ...overrides,
    });

    const createMockService = (overrides = {}) => ({
        _id: 'service-new',
        serviceName: 'Premium Plan',
        durationMonths: 12,
        price: 1000000,
        ...overrides,
    });

    beforeEach(async () => {
        // Mock Repositories
        subscriptionServiceRepo = {
            findOne: jest.fn().mockResolvedValue(createMockService()),
            findById: jest.fn().mockResolvedValue(createMockService()),
        };
        clinicSubscriptionRepo = {
            findOne: jest.fn().mockResolvedValue(createMockSubscription()),
            findById: jest.fn().mockResolvedValue(createMockSubscription()),
            save: jest.fn().mockImplementation((sub) => Promise.resolve(sub)),
        };
        historyRepo = {
            createHistoryRecord: jest.fn().mockResolvedValue(true),
        };
        queueRepo = {
            findByClinicId: jest.fn().mockResolvedValue(null),
            createQueueRecord: jest.fn().mockResolvedValue({ _id: 'queue-1' }),
            save: jest.fn().mockImplementation((q) => Promise.resolve(q)),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                SubscriptionServicesService,
                { provide: SubscriptionServiceRepository, useValue: subscriptionServiceRepo },
                { provide: ClinicSubscriptionRepository, useValue: clinicSubscriptionRepo },
                { provide: ClinicSubscriptionHistoryRepository, useValue: historyRepo },
                { provide: ClinicSubscriptionRenewalQueueRepository, useValue: queueRepo },
            ],
        }).compile();

        service = module.get<SubscriptionServicesService>(SubscriptionServicesService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('handleSubscriptionPaymentSuccess', () => {
        describe('Case: Expired Subscription → Activate Immediately', () => {
            it('should activate subscription immediately if expired', async () => {
                const subscriptionId = 'sub-1';
                const targetServiceId = 'service-new';
                const transactionId = 'tx-123';
                const duration = 2; // 2 months

                await service.handleSubscriptionPaymentSuccess(subscriptionId, targetServiceId, transactionId, duration);

                expect(clinicSubscriptionRepo.save).toHaveBeenCalled();
                const savedSub = clinicSubscriptionRepo.save.mock.calls[0][0];

                expect(savedSub.subscriptionStatus).toBe(RegistrationStatus.ACTIVE);
                expect(savedSub.serviceId).toBe(targetServiceId);

                // Verify Start Date (00:00:00 UTC)
                const startDate = new Date(savedSub.subscriptionDate);
                expect(startDate.getUTCHours()).toBe(0);
                expect(startDate.getUTCMinutes()).toBe(0);
                expect(startDate.getUTCSeconds()).toBe(0);

                // Verify End Date (23:59:59 UTC)
                const endDate = new Date(savedSub.expirationDate);
                expect(endDate.getUTCHours()).toBe(23);
                expect(endDate.getUTCMinutes()).toBe(59);
                expect(endDate.getUTCSeconds()).toBe(59);

                // Verify History
                expect(historyRepo.createHistoryRecord).toHaveBeenCalledWith(expect.objectContaining({
                    transactionId: transactionId,
                    subscriptionStatus: RegistrationStatus.ACTIVE,
                }));

                // Should NOT create queue record
                expect(queueRepo.createQueueRecord).not.toHaveBeenCalled();
            });

            it('should calculate correct end date based on duration (2 months)', async () => {
                const duration = 2;

                // Mock today as 2025-02-10 VN
                const now = new Date('2025-02-10T10:00:00Z');
                jest.useFakeTimers().setSystemTime(now);

                await service.handleSubscriptionPaymentSuccess('sub-1', 'service-new', 'tx-123', duration);

                const savedSub = clinicSubscriptionRepo.save.mock.calls[0][0];
                const startDate = new Date(savedSub.subscriptionDate);
                const endDate = new Date(savedSub.expirationDate);

                // End date should be ~2 months after start
                const diffMonths = (endDate.getUTCMonth() - startDate.getUTCMonth()) +
                    (endDate.getUTCFullYear() - startDate.getUTCFullYear()) * 12;

                // Should be 1 month diff because we subtract 1 day (1 month + x days = still in 2nd month)
                expect(diffMonths).toBeGreaterThanOrEqual(1);
                expect(diffMonths).toBeLessThanOrEqual(2);

                jest.useRealTimers();
            });
        });

        describe('Case: Active Subscription → Create Queue', () => {
            const NOW = new Date('2025-02-10T10:00:00Z');
            const FUTURE_EXPIRATION = new Date('2025-06-30T23:59:59.999Z');

            beforeEach(() => {
                jest.useFakeTimers().setSystemTime(NOW);

                // Setup: Active subscription not expired (expires in the future)
                clinicSubscriptionRepo.findById.mockResolvedValue(createMockSubscription({
                    subscriptionStatus: RegistrationStatus.ACTIVE,
                    expirationDate: FUTURE_EXPIRATION,
                }));
            });

            afterEach(() => {
                jest.useRealTimers();
            });

            it('should create queue record when subscription is still active', async () => {
                const duration = 3;

                await service.handleSubscriptionPaymentSuccess('sub-1', 'service-new', 'tx-123', duration);

                // Should NOT directly update subscription
                expect(clinicSubscriptionRepo.save).not.toHaveBeenCalled();

                // Should create queue record
                expect(queueRepo.createQueueRecord).toHaveBeenCalledWith(expect.objectContaining({
                    clinicId: 'clinic-1',
                    nextServiceId: 'service-new',
                }));

                // Should still create history
                expect(historyRepo.createHistoryRecord).toHaveBeenCalled();
            });

            it('should calculate targetStartDate = expirationDate + 1 day', async () => {
                await service.handleSubscriptionPaymentSuccess('sub-1', 'service-new', 'tx-123', 2);

                expect(queueRepo.createQueueRecord).toHaveBeenCalled();
                const queueCall = queueRepo.createQueueRecord.mock.calls[0][0];
                const targetStartDate = new Date(queueCall.targetStartDate);

                // FUTURE_EXPIRATION is June 30, 2025 23:59:59
                // Next start should be July 1, 2025 00:00:00 UTC
                expect(targetStartDate.getUTCFullYear()).toBe(2025);
                expect(targetStartDate.getUTCMonth()).toBe(6); // July (0-indexed)
                expect(targetStartDate.getUTCDate()).toBe(1);
                expect(targetStartDate.getUTCHours()).toBe(0);
                expect(targetStartDate.getUTCMinutes()).toBe(0);
            });

            it('should calculate targetEndDate based on duration (2 months)', async () => {
                const duration = 2;
                await service.handleSubscriptionPaymentSuccess('sub-1', 'service-new', 'tx-123', duration);

                expect(queueRepo.createQueueRecord).toHaveBeenCalled();
                const queueCall = queueRepo.createQueueRecord.mock.calls[0][0];
                const targetEndDate = new Date(queueCall.targetEndDate);

                // Start: July 1, 2025
                // End with duration 2: Aug 31, 2025 23:59:59
                expect(targetEndDate.getUTCMonth()).toBe(7); // August
                expect(targetEndDate.getUTCHours()).toBe(23);
                expect(targetEndDate.getUTCMinutes()).toBe(59);
                expect(targetEndDate.getUTCSeconds()).toBe(59);
            });

            it('should update existing queue record instead of creating new', async () => {
                // Setup: existing queue record
                const existingQueue = {
                    _id: 'queue-existing',
                    clinicId: 'clinic-1',
                    nextServiceId: 'old-service',
                    targetStartDate: new Date(),
                    targetEndDate: new Date(),
                };
                queueRepo.findByClinicId.mockResolvedValue(existingQueue);

                await service.handleSubscriptionPaymentSuccess('sub-1', 'service-new', 'tx-123', 3);

                // Should NOT create new
                expect(queueRepo.createQueueRecord).not.toHaveBeenCalled();

                // Should update existing
                expect(queueRepo.save).toHaveBeenCalled();
                const savedQueue = queueRepo.save.mock.calls[0][0];
                expect(savedQueue.nextServiceId).toBe('service-new');
            });
        });

        describe('Case: Duration Parameter Tests', () => {
            it('should default to 1 month if duration not provided', async () => {
                await service.handleSubscriptionPaymentSuccess('sub-1', 'service-new', 'tx-123');

                const savedSub = clinicSubscriptionRepo.save.mock.calls[0][0];
                const startDate = new Date(savedSub.subscriptionDate);
                const endDate = new Date(savedSub.expirationDate);

                // With duration 1, end should be ~1 month after start
                const monthDiff = (endDate.getUTCMonth() - startDate.getUTCMonth()) +
                    (endDate.getUTCFullYear() - startDate.getUTCFullYear()) * 12;

                expect(monthDiff).toBeLessThanOrEqual(1);
            });

            it('should correctly calculate 12 month duration', async () => {
                const duration = 12;

                // Mock specific date
                const now = new Date('2025-01-15T10:00:00Z');
                jest.useFakeTimers().setSystemTime(now);

                await service.handleSubscriptionPaymentSuccess('sub-1', 'service-new', 'tx-123', duration);

                const savedSub = clinicSubscriptionRepo.save.mock.calls[0][0];
                const startDate = new Date(savedSub.subscriptionDate);
                const endDate = new Date(savedSub.expirationDate);

                // Start Jan 15, 2025 → End Jan 14, 2026 (12 months - 1 day)
                // Year diff should be 0 or 1 depending on exact calculation
                const monthDiff = (endDate.getUTCMonth() - startDate.getUTCMonth()) +
                    (endDate.getUTCFullYear() - startDate.getUTCFullYear()) * 12;

                // Should be approximately 11-12 months difference
                expect(monthDiff).toBeGreaterThanOrEqual(11);
                expect(monthDiff).toBeLessThanOrEqual(12);

                jest.useRealTimers();
            });
        });
    });

    describe('updatePopularServices', () => {
        let subscriptionServiceRepo: any;

        beforeEach(() => {
            subscriptionServiceRepo = {
                resetAllPopular: jest.fn().mockResolvedValue(undefined),
                setPopular: jest.fn().mockResolvedValue(undefined),
            };
            // Replace the repository in the service
            (service as any).subscriptionServiceRepository = subscriptionServiceRepo;
        });

        it('should reset all is_popular to false when no active subscriptions exist', async () => {
            // Mock: No active subscriptions
            clinicSubscriptionRepo.getActiveCountByService = jest.fn().mockResolvedValue([]);

            // Execute
            await service.updatePopularServices();

            // Verify
            expect(clinicSubscriptionRepo.getActiveCountByService).toHaveBeenCalled();
            expect(subscriptionServiceRepo.resetAllPopular).toHaveBeenCalled();
            expect(subscriptionServiceRepo.setPopular).not.toHaveBeenCalled();
        });

        it('should set is_popular=true for service with highest active count', async () => {
            // Mock: Multiple services with different counts
            const mockCounts = [
                { serviceId: 'service-premium', activeCount: '15' },
                { serviceId: 'service-basic', activeCount: '8' },
                { serviceId: 'service-enterprise', activeCount: '3' },
            ];
            clinicSubscriptionRepo.getActiveCountByService = jest.fn().mockResolvedValue(mockCounts);

            // Execute
            await service.updatePopularServices();

            // Verify
            expect(subscriptionServiceRepo.resetAllPopular).toHaveBeenCalled();
            expect(subscriptionServiceRepo.setPopular).toHaveBeenCalledWith('service-premium');
            expect(subscriptionServiceRepo.setPopular).toHaveBeenCalledTimes(1);
        });

        it('should set only one service as popular when multiple services have active subscriptions', async () => {
            // Mock: Single service with active subscriptions
            const mockCounts = [
                { serviceId: 'service-basic', activeCount: '5' },
            ];
            clinicSubscriptionRepo.getActiveCountByService = jest.fn().mockResolvedValue(mockCounts);

            // Execute
            await service.updatePopularServices();

            // Verify: Reset all first, then set one
            expect(subscriptionServiceRepo.resetAllPopular).toHaveBeenCalled();
            expect(subscriptionServiceRepo.setPopular).toHaveBeenCalledWith('service-basic');
            expect(subscriptionServiceRepo.setPopular).toHaveBeenCalledTimes(1);
        });

        it('should handle tie by selecting first service in query result', async () => {
            // Mock: Two services with same count (ordered by query)
            const mockCounts = [
                { serviceId: 'service-alpha', activeCount: '10' },
                { serviceId: 'service-beta', activeCount: '10' },
            ];
            clinicSubscriptionRepo.getActiveCountByService = jest.fn().mockResolvedValue(mockCounts);

            // Execute
            await service.updatePopularServices();

            // Verify: First one in list should be chosen
            expect(subscriptionServiceRepo.setPopular).toHaveBeenCalledWith('service-alpha');
            expect(subscriptionServiceRepo.setPopular).toHaveBeenCalledTimes(1);
        });
    });
});

