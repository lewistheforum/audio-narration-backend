import { BadRequestException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { SubscriptionServicesController } from '../../../../src/modules/subscriptions/subscription-services.controller';
import { SubscriptionServicesService } from '../../../../src/modules/subscriptions/subscription-services.service';
import { CreateSubscriptionServiceDto } from '../../../../src/modules/subscriptions/dto/create-subscription-service.dto';
import { SubscriptionServiceStatus } from '../../../../src/modules/subscriptions/enums/subscription-service-status.enum';

describe('UC-96 Create New Subscription', () => {
  const baseDto: CreateSubscriptionServiceDto = {
    serviceName: 'Basic Plan',
    code: 'BASIC',
    description: 'Basic subscription plan',
    price: 500000,
    discount: 10,
    serviceFunctions: ['Appointment Management', 'Patient Records'],
    isPopular: true,
    status: SubscriptionServiceStatus.ACTIVE,
    chartColor: '#3B82F6',
  };

  const collectMessages = async (dto: object) => {
    const errors = await validate(plainToInstance(CreateSubscriptionServiceDto, dto));
    return errors.flatMap((error) => Object.values(error.constraints ?? {}));
  };

  const createController = (result?: any) =>
    ({
      subscriptionServicesService: {
        create: jest.fn().mockResolvedValue(result ?? { ...baseDto, id: 'svc-1' }),
      },
    }) as any;

  const createServiceContext = (opts?: { existing?: any; reject?: string }) => ({
    subscriptionServiceRepository: {
      findByName: jest.fn().mockResolvedValue(opts?.existing ?? null),
      create: jest.fn().mockImplementation((payload) => ({ _id: 'svc-1', ...payload })),
      save: jest.fn().mockImplementation(async (payload) => {
        if (opts?.reject) {
          throw new Error(opts.reject);
        }
        return payload;
      }),
    },
    toResponseDto: jest.fn().mockImplementation((payload) => ({ ...payload, id: payload._id })),
  }) as any;

  it('UT-96-01: Create with full valid payload.', async () => {
    const controller = createController();

    const result = await SubscriptionServicesController.prototype.create.call(controller, baseDto);

    expect(controller.subscriptionServicesService.create).toHaveBeenCalledWith(baseDto);
    expect(result.message).toBe('Subscription service created successfully');
  });

  it('UT-96-02: Create with optional fields omitted.', async () => {
    const serviceContext = createServiceContext();
    const result = await SubscriptionServicesService.prototype.create.call(serviceContext, {
      serviceName: 'Lite',
      code: 'LITE',
      price: 100000,
    });

    expect(result.serviceName).toBe('Lite');
    expect(result.price).toBe(100000);
  });

  it('UT-96-03: Create with status=ACTIVE.', async () => {
    const serviceContext = createServiceContext();
    const result = await SubscriptionServicesService.prototype.create.call(serviceContext, {
      ...baseDto,
      status: SubscriptionServiceStatus.ACTIVE,
    });

    expect(result.status).toBe(SubscriptionServiceStatus.ACTIVE);
  });

  it('UT-96-04: Create with status=INACTIVE.', async () => {
    const serviceContext = createServiceContext();
    const result = await SubscriptionServicesService.prototype.create.call(serviceContext, {
      ...baseDto,
      status: SubscriptionServiceStatus.INACTIVE,
    });

    expect(result.status).toBe(SubscriptionServiceStatus.INACTIVE);
  });

  it('UT-96-05: Missing required serviceName.', async () => {
    const messages = await collectMessages({
      code: 'BASIC',
      price: 100,
    });

    expect(messages).toContain('serviceName must be a string');
    expect(messages).toContain('serviceName should not be empty');
  });

  it('UT-96-06: Missing required code.', async () => {
    const messages = await collectMessages({
      serviceName: 'Basic',
      price: 100,
    });

    expect(messages).toContain('code must be a string');
    expect(messages).toContain('code should not be empty');
  });

  it('UT-96-07: Missing/invalid price.', async () => {
    const missingMessages = await collectMessages({ serviceName: 'Basic', code: 'BASIC' });
    const invalidMessages = await collectMessages({ serviceName: 'Basic', code: 'BASIC', price: -1 });

    expect(missingMessages).toContain('price must not be less than 0');
    expect(invalidMessages).toContain('price must not be less than 0');
  });

  it('UT-96-08: Invalid discount range/type.', async () => {
    const overMessages = await collectMessages({ ...baseDto, discount: 101 });
    const typeMessages = await collectMessages({ ...baseDto, discount: 'x' as any });

    expect(overMessages).toContain('discount must not be greater than 100');
    expect(typeMessages).toContain('discount must be a number conforming to the specified constraints');
  });

  it('UT-96-09: Invalid serviceFunctions type/items.', async () => {
    const nonArray = await collectMessages({ ...baseDto, serviceFunctions: 'abc' as any });
    const nonStringItem = await collectMessages({ ...baseDto, serviceFunctions: ['ok', 1] as any });

    expect(nonArray).toContain('serviceFunctions must be an array');
    expect(nonStringItem).toContain('each value in serviceFunctions must be a string');
  });

  it('UT-96-10: Invalid status enum.', async () => {
    const messages = await collectMessages({ ...baseDto, status: 'ARCHIVED' as any });

    expect(messages.some((m) => m.includes('status must be one of the following values'))).toBe(true);
  });

  it('UT-96-11: Runtime persistence failure.', async () => {
    const serviceContext = createServiceContext({ reject: 'db failed' });

    await expect(SubscriptionServicesService.prototype.create.call(serviceContext, baseDto)).rejects.toThrow('db failed');
  });

  it('UT-96-12: Boundary price=0 accepted.', async () => {
    const messages = await collectMessages({ ...baseDto, price: 0 });

    expect(messages).toEqual([]);
  });

  it('UT-96-13: Boundary discount=100 accepted.', async () => {
    const messages = await collectMessages({ ...baseDto, discount: 100 });

    expect(messages).toEqual([]);
  });
});
