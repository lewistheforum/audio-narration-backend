import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionServicesService } from '../../../src/modules/subscriptions/subscription-services.service';
import { SubscriptionServiceRepository } from '../../../src/modules/subscriptions/repositories/subscription-service.repository';
import { ClinicSubscriptionRepository } from '../../../src/modules/subscriptions/repositories/clinic-subscription.repository';
import { ClinicSubscriptionHistoryRepository } from '../../../src/modules/subscriptions/repositories/clinic-subscription-history.repository';
import { ClinicSubscriptionRenewalQueueRepository } from '../../../src/modules/subscriptions/repositories/clinic-subscription-renewal-queue.repository';
import { RegistrationStatus } from '../../../src/modules/subscriptions/enums/subscription-status.enum';

// Mock Data
const mockSubscription = {
    _id: 'sub-1',
    clinicId: 'clinic-1',
    serviceId: 'service-1',
    subscriptionStatus: RegistrationStatus.EXPIRED,
    expirationDate: new Date('2025-01-01T00:00:00Z'),
};

const mockService = {
    _id: 'service-new',
    serviceName: 'Premium Plan',
    durationMonths: 12,
    price: 1000000,
};

describe('SubscriptionServicesService', () => {
    let service: SubscriptionServicesService;
    let clinicSubscriptionRepo: any;
    let historyRepo: any;

    beforeEach(async () => {
        // Mock Repositories
        const mockSubscriptionServiceRepo = {
            findOne: jest.fn().mockResolvedValue(mockService),
        };
        const mockClinicSubscriptionRepo = {
            findOne: jest.fn().mockResolvedValue(mockSubscription),
            save: jest.fn().mockImplementation((sub) => Promise.resolve(sub)),
        };
        const mockHistoryRepo = {
            createHistoryRecord: jest.fn().mockResolvedValue(true),
        };
        const mockQueueRepo = {
            findByClinicId: jest.fn(),
            createQueueRecord: jest.fn(),
            save: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                SubscriptionServicesService,
                { provide: SubscriptionServiceRepository, useValue: mockSubscriptionServiceRepo },
                { provide: ClinicSubscriptionRepository, useValue: mockClinicSubscriptionRepo },
                { provide: ClinicSubscriptionHistoryRepository, useValue: mockHistoryRepo },
                { provide: ClinicSubscriptionRenewalQueueRepository, useValue: mockQueueRepo },
            ],
        }).compile();

        service = module.get<SubscriptionServicesService>(SubscriptionServicesService);
        clinicSubscriptionRepo = module.get<ClinicSubscriptionRepository>(ClinicSubscriptionRepository);
        historyRepo = module.get<ClinicSubscriptionHistoryRepository>(ClinicSubscriptionHistoryRepository);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('handleSubscriptionPaymentSuccess', () => {
        it('should activate subscription immediately if expired', async () => {
            // Setup
            const subscriptionId = 'sub-1';
            const targetServiceId = 'service-new';
            const transactionId = 'tx-123';

            // Execute
            await service.handleSubscriptionPaymentSuccess(subscriptionId, targetServiceId, transactionId);

            // Verify
            expect(clinicSubscriptionRepo.save).toHaveBeenCalled();
            const savedSub = clinicSubscriptionRepo.save.mock.calls[0][0];

            expect(savedSub.subscriptionStatus).toBe(RegistrationStatus.ACTIVE);
            expect(savedSub.serviceId).toBe(targetServiceId);

            // Verify Date Logic (00:00:00 UTC check)
            const startDate = new Date(savedSub.subscriptionDate);
            expect(startDate.getUTCHours()).toBe(0);
            expect(startDate.getUTCMinutes()).toBe(0);
            expect(startDate.getUTCSeconds()).toBe(0);

            const endDate = new Date(savedSub.expirationDate);
            expect(endDate.getUTCHours()).toBe(23);
            expect(endDate.getUTCMinutes()).toBe(59);
            expect(endDate.getUTCSeconds()).toBe(59);

            // Verify History
            expect(historyRepo.createHistoryRecord).toHaveBeenCalledWith(expect.objectContaining({
                transactionId: transactionId,
                subscriptionStatus: RegistrationStatus.ACTIVE,
            }));
        });
    });
});
