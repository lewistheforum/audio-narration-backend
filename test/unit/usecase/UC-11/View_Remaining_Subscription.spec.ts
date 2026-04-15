import { NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';

import { ALLOW_EXPIRED_SUBSCRIPTION_KEY } from '../../../../src/common/decorators/allow-expired-subscription.decorator';
import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';
import { SubscriptionServicesController } from '../../../../src/modules/subscriptions/subscription-services.controller';
import { SubscriptionServicesService } from '../../../../src/modules/subscriptions/subscription-services.service';
import { SubscriptionServiceRepository } from '../../../../src/modules/subscriptions/repositories/subscription-service.repository';
import { ClinicSubscriptionRepository } from '../../../../src/modules/subscriptions/repositories/clinic-subscription.repository';
import { ClinicSubscriptionHistoryRepository } from '../../../../src/modules/subscriptions/repositories/clinic-subscription-history.repository';
import { ClinicSubscriptionRenewalQueueRepository } from '../../../../src/modules/subscriptions/repositories/clinic-subscription-renewal-queue.repository';

describe('UC-11 View Remaining Subscription', () => {
  let controller: SubscriptionServicesController;
  let service: SubscriptionServicesService;
  let subscriptionServiceRepo: any;
  let clinicSubscriptionRepo: any;
  let queueRepo: any;

  const createSubscription = (overrides: Record<string, any> = {}) => ({
    _id: 'sub-1',
    clinicId: 'clinic-admin-1',
    serviceId: 'svc-1',
    subscriptionDate: new Date('2026-01-01T00:00:00.000Z'),
    expirationDate: new Date('2099-12-31T23:59:59.999Z'),
    subscriptionStatus: 'ACTIVE',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  });

  const createService = (overrides: Record<string, any> = {}) => ({
    _id: 'svc-1',
    serviceName: 'Premium',
    code: 'PREM',
    description: 'Premium service',
    price: 1000000,
    discount: 10,
    serviceFunctions: ['A', 'B'],
    ...overrides,
  });

  beforeEach(async () => {
    subscriptionServiceRepo = {
      findById: jest.fn(),
    };

    clinicSubscriptionRepo = {
      findByClinicId: jest.fn(),
    };

    queueRepo = {
      findByClinicId: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubscriptionServicesController],
      providers: [
        SubscriptionServicesService,
        { provide: SubscriptionServiceRepository, useValue: subscriptionServiceRepo },
        { provide: ClinicSubscriptionRepository, useValue: clinicSubscriptionRepo },
        { provide: ClinicSubscriptionHistoryRepository, useValue: {} },
        { provide: ClinicSubscriptionRenewalQueueRepository, useValue: queueRepo },
        { provide: DataSource, useValue: {} },
      ],
    }).compile();

    controller = module.get(SubscriptionServicesController);
    service = module.get(SubscriptionServicesService);
  });

  it('UT-11-01: View current subscription successfully without queued renewal.', async () => {
    clinicSubscriptionRepo.findByClinicId.mockResolvedValue(createSubscription());
    subscriptionServiceRepo.findById.mockResolvedValue(createService());
    queueRepo.findByClinicId.mockResolvedValue(null);

    const result = await controller.getCurrentSubscription({
      _id: 'clinic-admin-1',
      role: AccountRole.CLINIC_ADMIN,
    } as any);

    expect(result.message).toBe('Subscription fetched successfully');
    expect(result.data.serviceName).toBe('Premium');
    expect(result.data.queuedSubscription).toBeUndefined();
  });

  it('UT-11-02: View current subscription successfully with queued renewal.', async () => {
    clinicSubscriptionRepo.findByClinicId.mockResolvedValue(createSubscription());
    subscriptionServiceRepo.findById
      .mockResolvedValueOnce(createService())
      .mockResolvedValueOnce(createService({ _id: 'svc-2', serviceName: 'Enterprise' }));
    queueRepo.findByClinicId.mockResolvedValue({
      clinicId: 'clinic-admin-1',
      nextServiceId: 'svc-2',
      targetStartDate: new Date('2100-01-01T00:00:00.000Z'),
      targetEndDate: new Date('2100-12-31T23:59:59.999Z'),
    });

    const result = await service.getCurrentSubscription('clinic-admin-1');

    expect(result.queuedSubscription).toEqual(
      expect.objectContaining({
        serviceId: 'svc-2',
        serviceName: 'Enterprise',
      }),
    );
  });

  it('UT-11-03: Reject missing or invalid JWT.', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      SubscriptionServicesController.prototype.getCurrentSubscription,
    );

    expect(guards).toHaveLength(2);
  });

  it('UT-11-04: Reject authenticated non-admin role.', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      SubscriptionServicesController.prototype.getCurrentSubscription,
    );

    expect(roles).toEqual([AccountRole.CLINIC_ADMIN]);
  });

  it('UT-11-05: Reject when clinic has no current subscription.', async () => {
    clinicSubscriptionRepo.findByClinicId.mockResolvedValue(null);

    await expect(service.getCurrentSubscription('clinic-admin-2')).rejects.toThrow(
      new NotFoundException('No active subscription found for your clinic'),
    );
  });

  it('UT-11-06: Reject when linked subscription service is missing.', async () => {
    clinicSubscriptionRepo.findByClinicId.mockResolvedValue(createSubscription());
    subscriptionServiceRepo.findById.mockResolvedValue(null);

    await expect(service.getCurrentSubscription('clinic-admin-1')).rejects.toThrow(
      new NotFoundException('Subscription service not found'),
    );
  });

  it('UT-11-07: Return remainingDays = 0 when expiration date is now.', () => {
    const response = (service as any).toSubscriptionResponseDto(
      createSubscription({ expirationDate: new Date('2026-01-01T00:00:00.000Z') }),
      createService(),
    );

    expect(response.remainingDays).toBe(0);
  });

  it('UT-11-08: Return remainingDays = 1 when expiration date is one day from now.', () => {
    const tomorrow = new Date('2026-01-02T00:00:00.000Z');
    const response = (service as any).toSubscriptionResponseDto(
      createSubscription({ expirationDate: tomorrow }),
      createService(),
    );

    expect(response.remainingDays).toBe(1);
  });

  it('UT-11-09: Omit queuedSubscription when queue exists but queued service cannot be loaded.', async () => {
    clinicSubscriptionRepo.findByClinicId.mockResolvedValue(createSubscription());
    subscriptionServiceRepo.findById
      .mockResolvedValueOnce(createService())
      .mockResolvedValueOnce(null);
    queueRepo.findByClinicId.mockResolvedValue({
      clinicId: 'clinic-admin-1',
      nextServiceId: 'svc-missing',
      targetStartDate: new Date('2100-01-01T00:00:00.000Z'),
      targetEndDate: new Date('2100-12-31T23:59:59.999Z'),
    });

    const result = await service.getCurrentSubscription('clinic-admin-1');

    expect(result.queuedSubscription).toBeUndefined();
  });

  it('UT-11-10: Allow CLINIC_ADMIN access when current subscription status is EXPIRED because endpoint uses AllowExpiredSubscription().', async () => {
    const allowExpired = Reflect.getMetadata(
      ALLOW_EXPIRED_SUBSCRIPTION_KEY,
      SubscriptionServicesController.prototype.getCurrentSubscription,
    );
    clinicSubscriptionRepo.findByClinicId.mockResolvedValue(
      createSubscription({ subscriptionStatus: 'EXPIRED' }),
    );
    subscriptionServiceRepo.findById.mockResolvedValue(createService());
    queueRepo.findByClinicId.mockResolvedValue(null);

    const result = await controller.getCurrentSubscription({
      _id: 'clinic-admin-1',
      role: AccountRole.CLINIC_ADMIN,
    } as any);

    expect(allowExpired).toBe(true);
    expect(result.message).toBe('Subscription fetched successfully');
  });
});
