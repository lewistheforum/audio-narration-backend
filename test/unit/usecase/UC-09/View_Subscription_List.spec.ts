import { ParseUUIDPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';

import { SubscriptionServicesController } from '../../../../src/modules/subscriptions/subscription-services.controller';
import { SubscriptionServicesService } from '../../../../src/modules/subscriptions/subscription-services.service';
import { SubscriptionServiceStatus } from '../../../../src/modules/subscriptions/enums/subscription-service-status.enum';
import { ClinicSubscriptionHistoryRepository } from '../../../../src/modules/subscriptions/repositories/clinic-subscription-history.repository';
import { ClinicSubscriptionRenewalQueueRepository } from '../../../../src/modules/subscriptions/repositories/clinic-subscription-renewal-queue.repository';
import { ClinicSubscriptionRepository } from '../../../../src/modules/subscriptions/repositories/clinic-subscription.repository';
import { SubscriptionServiceRepository } from '../../../../src/modules/subscriptions/repositories/subscription-service.repository';

describe('UC-09 View Subscription List', () => {
  let controller: SubscriptionServicesController;
  let service: SubscriptionServicesService;
  let subscriptionServiceRepository: {
    findAll: jest.Mock;
    findById: jest.Mock;
  };

  const validId = '11111111-1111-4111-8111-111111111111';

  const createSubscriptionService = (overrides: Record<string, any> = {}) => ({
    _id: validId,
    serviceName: 'Premium Plan',
    code: 'PREMIUM',
    description: 'Premium subscription',
    price: 1000,
    discount: 10,
    serviceFunctions: ['Feature A'],
    isPopular: true,
    status: SubscriptionServiceStatus.ACTIVE,
    chartColor: '#00FF00',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    ...overrides,
  });

  beforeEach(async () => {
    subscriptionServiceRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubscriptionServicesController],
      providers: [
        SubscriptionServicesService,
        { provide: SubscriptionServiceRepository, useValue: subscriptionServiceRepository },
        { provide: ClinicSubscriptionRepository, useValue: {} },
        { provide: ClinicSubscriptionHistoryRepository, useValue: {} },
        { provide: ClinicSubscriptionRenewalQueueRepository, useValue: {} },
        { provide: DataSource, useValue: {} },
      ],
    }).compile();

    controller = module.get(SubscriptionServicesController);
    service = module.get(SubscriptionServicesService);
  });

  it('UT-09-01: Retrieve active public subscription service list.', async () => {
    subscriptionServiceRepository.findAll.mockResolvedValue([createSubscriptionService()]);

    const result = await controller.findAll();

    expect(subscriptionServiceRepository.findAll).toHaveBeenCalledWith(
      false,
      SubscriptionServiceStatus.ACTIVE,
    );
    expect(result.message).toBe('Subscription services retrieved successfully');
    expect(result.data[0].priceAfterDiscount).toBe(900);
  });

  it('UT-09-02: Retrieve admin subscription service list including inactive records.', async () => {
    subscriptionServiceRepository.findAll.mockResolvedValue([
      createSubscriptionService(),
      createSubscriptionService({ _id: 'service-2', status: SubscriptionServiceStatus.INACTIVE }),
    ]);

    const result = await controller.findAllSubscriptionServices();

    expect(subscriptionServiceRepository.findAll).toHaveBeenCalledWith(false);
    expect(result.message).toBe('Subscription services retrieved successfully');
    expect(result.data).toHaveLength(2);
  });

  it('UT-09-03: Retrieve one subscription service by valid id.', async () => {
    subscriptionServiceRepository.findById.mockResolvedValue(createSubscriptionService());

    const result = await controller.findOne(validId);

    expect(result.message).toBe('Subscription service retrieved successfully');
    expect(result.data.id).toBe(validId);
    expect(result.data.priceAfterDiscount).toBe(900);
  });

  it('UT-09-04: Reject invalid UUID path parameter.', async () => {
    const pipe = new ParseUUIDPipe();

    await expect(
      pipe.transform('not-a-uuid', { type: 'param', metatype: String, data: 'id' }),
    ).rejects.toThrow('Validation failed (uuid is expected)');
  });

  it('UT-09-05: Reject non-existent subscription service id.', async () => {
    subscriptionServiceRepository.findById.mockResolvedValue(null);

    await expect(service.findOne(validId)).rejects.toThrow('Subscription service not found');
  });

  it('UT-09-06: Bubble repository read failure.', async () => {
    subscriptionServiceRepository.findAll.mockRejectedValue(new Error('db failed'));

    await expect(service.findAll()).rejects.toThrow('db failed');
  });

  it('UT-09-07: Return empty list when no services exist.', async () => {
    subscriptionServiceRepository.findAll.mockResolvedValue([]);

    const result = await controller.findAll();

    expect(result).toEqual({
      data: [],
      message: 'Subscription services retrieved successfully',
    });
  });

  it('UT-09-08: Return priceAfterDiscount 0 when discount is 100.', async () => {
    subscriptionServiceRepository.findById.mockResolvedValue(
      createSubscriptionService({ discount: 100 }),
    );

    const result = await service.findOne(validId);

    expect(result.priceAfterDiscount).toBe(0);
  });

  it('UT-09-09: Return priceAfterDiscount 0 when price is 0.', async () => {
    subscriptionServiceRepository.findAll.mockResolvedValue([
      createSubscriptionService({ price: 0, discount: 50 }),
    ]);

    const result = await service.findAll();

    expect(result[0].priceAfterDiscount).toBe(0);
  });
});
