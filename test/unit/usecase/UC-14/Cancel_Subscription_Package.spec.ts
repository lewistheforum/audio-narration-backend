import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';
import { RegistrationStatus } from '../../../../src/modules/subscriptions/enums/subscription-status.enum';
import { SubscriptionServicesController } from '../../../../src/modules/subscriptions/subscription-services.controller';
import { SubscriptionServicesService } from '../../../../src/modules/subscriptions/subscription-services.service';
import { ClinicSubscriptionHistoryRepository } from '../../../../src/modules/subscriptions/repositories/clinic-subscription-history.repository';
import { ClinicSubscriptionRenewalQueueRepository } from '../../../../src/modules/subscriptions/repositories/clinic-subscription-renewal-queue.repository';
import { ClinicSubscriptionRepository } from '../../../../src/modules/subscriptions/repositories/clinic-subscription.repository';
import { SubscriptionServiceRepository } from '../../../../src/modules/subscriptions/repositories/subscription-service.repository';

describe('UC-14 Cancel Subscription Package', () => {
  let controller: SubscriptionServicesController;
  let service: SubscriptionServicesService;
  let clinicSubscriptionRepository: { findByClinicId: jest.Mock };
  let clinicSubscriptionHistoryRepository: { create: jest.Mock };
  let queryRunner: any;

  const createSubscription = (status = RegistrationStatus.ACTIVE) => ({
    _id: 'subscription-1',
    clinicId: 'clinic-admin-1',
    serviceId: 'service-1',
    subscriptionDate: new Date('2026-01-01T00:00:00.000Z'),
    expirationDate: new Date('2026-12-31T23:59:59.999Z'),
    subscriptionStatus: status,
  });

  beforeEach(async () => {
    clinicSubscriptionRepository = {
      findByClinicId: jest.fn(),
    };

    clinicSubscriptionHistoryRepository = {
      create: jest.fn((payload: Record<string, unknown>) => payload),
    };

    queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        save: jest.fn((entity: unknown) => Promise.resolve(entity)),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubscriptionServicesController],
      providers: [
        SubscriptionServicesService,
        { provide: SubscriptionServiceRepository, useValue: {} },
        {
          provide: ClinicSubscriptionRepository,
          useValue: clinicSubscriptionRepository,
        },
        {
          provide: ClinicSubscriptionHistoryRepository,
          useValue: clinicSubscriptionHistoryRepository,
        },
        {
          provide: ClinicSubscriptionRenewalQueueRepository,
          useValue: {},
        },
        {
          provide: DataSource,
          useValue: { createQueryRunner: jest.fn().mockReturnValue(queryRunner) },
        },
      ],
    }).compile();

    controller = module.get(SubscriptionServicesController);
    service = module.get(SubscriptionServicesService);
  });

  it('UT-14-01: Cancel active subscription successfully.', async () => {
    clinicSubscriptionRepository.findByClinicId.mockResolvedValue(createSubscription());

    const result = await controller.cancelCurrentSubscription({
      _id: 'clinic-admin-1',
      role: AccountRole.CLINIC_ADMIN,
    } as any);

    expect(queryRunner.commitTransaction).toHaveBeenCalled();
    expect(clinicSubscriptionHistoryRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        clinicId: 'clinic-admin-1',
        subscriptionStatus: RegistrationStatus.NON_RENEWING,
      }),
    );
    expect(result.message).toBe('Subscription renewal cancelled successfully.');
  });

  it('UT-14-02: Reject missing or invalid JWT.', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      SubscriptionServicesController.prototype.cancelCurrentSubscription,
    );

    expect(guards).toHaveLength(2);
  });

  it('UT-14-03: Reject authenticated non-admin role.', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      SubscriptionServicesController.prototype.cancelCurrentSubscription,
    );

    expect(roles).toEqual([AccountRole.CLINIC_ADMIN]);
  });

  it('UT-14-04: Reject when subscription does not exist.', async () => {
    clinicSubscriptionRepository.findByClinicId.mockResolvedValue(null);

    await expect(service.cancelCurrentSubscription('clinic-admin-1')).rejects.toThrow(
      new NotFoundException('No active subscription found.'),
    );
  });

  it('UT-14-05: Reject when subscription is already NON_RENEWING.', async () => {
    clinicSubscriptionRepository.findByClinicId.mockResolvedValue(
      createSubscription(RegistrationStatus.NON_RENEWING),
    );

    await expect(service.cancelCurrentSubscription('clinic-admin-1')).rejects.toThrow(
      new BadRequestException(
        'Cannot cancel subscription in status NON_RENEWING. Only active subscriptions can be cancelled.',
      ),
    );
  });

  it('UT-14-06: Reject when subscription status is EXPIRED.', async () => {
    clinicSubscriptionRepository.findByClinicId.mockResolvedValue(
      createSubscription(RegistrationStatus.EXPIRED),
    );

    await expect(service.cancelCurrentSubscription('clinic-admin-1')).rejects.toThrow(
      new BadRequestException(
        'Cannot cancel subscription in status EXPIRED. Only active subscriptions can be cancelled.',
      ),
    );
  });

  it('UT-14-07: Bubble transaction failure as internal server error.', async () => {
    clinicSubscriptionRepository.findByClinicId.mockResolvedValue(createSubscription());
    queryRunner.manager.save
      .mockResolvedValueOnce(createSubscription(RegistrationStatus.NON_RENEWING))
      .mockRejectedValueOnce(new Error('Internal Server Error'));

    await expect(service.cancelCurrentSubscription('clinic-admin-1')).rejects.toThrow(
      'Internal Server Error',
    );
    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
  });
});
