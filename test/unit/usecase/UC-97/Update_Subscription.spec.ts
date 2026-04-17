import { NotFoundException, ParseUUIDPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { SubscriptionServicesController } from '../../../../src/modules/subscriptions/subscription-services.controller';
import { SubscriptionServicesService } from '../../../../src/modules/subscriptions/subscription-services.service';
import { UpdateSubscriptionServiceDto } from '../../../../src/modules/subscriptions/dto/update-subscription-service.dto';
import { SubscriptionServiceStatus } from '../../../../src/modules/subscriptions/enums/subscription-service-status.enum';

describe('UC-97 Update Subscription', () => {
  const serviceId = '123e4567-e89b-42d3-a456-426614174006';

  const baseDto: UpdateSubscriptionServiceDto = {
    serviceName: 'Updated Plan',
    code: 'UPD',
    description: 'Updated description',
    price: 300000,
    discount: 10,
    serviceFunctions: ['Feature A', 'Feature B'],
    isPopular: true,
    status: SubscriptionServiceStatus.ACTIVE,
    chartColor: '#111111',
  };

  const collectMessages = async (dto: object) => {
    const errors = await validate(plainToInstance(UpdateSubscriptionServiceDto, dto));
    return errors.flatMap((error) => Object.values(error.constraints ?? {}));
  };

  const createServiceContext = (opts?: {
    current?: any;
    nameConflict?: any;
    saveReject?: string;
  }) => ({
    subscriptionServiceRepository: {
      findById: jest.fn().mockResolvedValue(
        opts && 'current' in opts
          ? opts.current
          : { _id: serviceId, serviceName: 'Old Plan', code: 'OLD', price: 100000, discount: 5 },
      ),
      findByName: jest.fn().mockResolvedValue(opts?.nameConflict ?? null),
      save: jest.fn().mockImplementation(async (payload) => {
        if (opts?.saveReject) {
          throw new Error(opts.saveReject);
        }
        return payload;
      }),
    },
    toResponseDto: jest.fn().mockImplementation((payload) => ({ ...payload, id: payload._id })),
  }) as any;

  it('UT-97-01: Update full editable fields.', async () => {
    const context = createServiceContext();

    const result = await SubscriptionServicesService.prototype.update.call(context, serviceId, baseDto);

    expect(result.serviceName).toBe('Updated Plan');
    expect(context.subscriptionServiceRepository.save).toHaveBeenCalled();
  });

  it('UT-97-02: Update partial single field only.', async () => {
    const context = createServiceContext();

    const result = await SubscriptionServicesService.prototype.update.call(context, serviceId, { price: 200000 });

    expect(result.price).toBe(200000);
    expect(result.code).toBe('OLD');
  });

  it('UT-97-03: Update status to ACTIVE.', async () => {
    const context = createServiceContext();

    const result = await SubscriptionServicesService.prototype.update.call(context, serviceId, {
      status: SubscriptionServiceStatus.ACTIVE,
    });

    expect(result.status).toBe(SubscriptionServiceStatus.ACTIVE);
  });

  it('UT-97-04: Update status to INACTIVE.', async () => {
    const context = createServiceContext();

    const result = await SubscriptionServicesService.prototype.update.call(context, serviceId, {
      status: SubscriptionServiceStatus.INACTIVE,
    });

    expect(result.status).toBe(SubscriptionServiceStatus.INACTIVE);
  });

  it('UT-97-05: Invalid UUID path param.', async () => {
    const pipe = new ParseUUIDPipe();

    await expect(pipe.transform('invalid_uuid', {} as any)).rejects.toThrow('Validation failed (uuid is expected)');
  });

  it('UT-97-06: Subscription not found.', async () => {
    const context = createServiceContext({ current: null });

    await expect(SubscriptionServicesService.prototype.update.call(context, serviceId, { price: 1000 })).rejects.toThrow(
      new NotFoundException('Subscription service not found'),
    );
  });

  it('UT-97-07: Invalid field type.', async () => {
    const messages = await collectMessages({
      serviceName: 123,
      code: 456,
      description: 789,
      serviceFunctions: ['ok', 1],
      isPopular: 'yes',
      chartColor: 111,
    } as any);

    expect(messages).toContain('serviceName must be a string');
    expect(messages).toContain('code must be a string');
    expect(messages).toContain('description must be a string');
    expect(messages).toContain('each value in serviceFunctions must be a string');
    expect(messages).toContain('isPopular must be a boolean value');
    expect(messages).toContain('chartColor must be a string');
  });

  it('UT-97-08: Invalid numeric/enum constraints.', async () => {
    const messages = await collectMessages({
      price: -1,
      discount: 101,
      status: 'ARCHIVED',
    } as any);

    expect(messages).toContain('price must not be less than 0');
    expect(messages).toContain('discount must not be greater than 100');
    expect(messages.some((m) => m.includes('status must be one of the following values'))).toBe(true);
  });

  it('UT-97-09: Runtime save failure.', async () => {
    const context = createServiceContext({ saveReject: 'db failed' });

    await expect(SubscriptionServicesService.prototype.update.call(context, serviceId, { price: 1000 })).rejects.toThrow('db failed');
  });

  it('UT-97-10: Boundary discount=100 accepted in update.', async () => {
    const messages = await collectMessages({ discount: 100 });

    expect(messages).toEqual([]);
  });

  it('UT-97-11: Boundary price=0 accepted in update.', async () => {
    const messages = await collectMessages({ price: 0 });

    expect(messages).toEqual([]);
  });
});
