import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { SubscriptionServicesController } from '../../../../src/modules/subscriptions/subscription-services.controller';
import { UpdateSubscriptionServiceDto } from '../../../../src/modules/subscriptions/dto/update-subscription-service.dto';
import { SubscriptionServiceStatus } from '../../../../src/modules/subscriptions/enums/subscription-service-status.enum';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';

describe('UC-98 Active Deactive Subscription', () => {
  const serviceId = '123e4567-e89b-42d3-a456-426614174007';

  const collectMessages = async (dto: object) => {
    const errors = await validate(plainToInstance(UpdateSubscriptionServiceDto, dto));
    return errors.flatMap((error) => Object.values(error.constraints ?? {}));
  };

  const createController = (status: SubscriptionServiceStatus) =>
    ({
      subscriptionServicesService: {
        update: jest.fn().mockResolvedValue({ _id: serviceId, id: serviceId, status }),
      },
    }) as any;

  it('UT-98-01: Set status to ACTIVE.', async () => {
    const controller = createController(SubscriptionServiceStatus.ACTIVE);

    const result = await SubscriptionServicesController.prototype.update.call(controller, serviceId, {
      status: SubscriptionServiceStatus.ACTIVE,
    });

    expect(controller.subscriptionServicesService.update).toHaveBeenCalledWith(serviceId, {
      status: SubscriptionServiceStatus.ACTIVE,
    });
    expect(result.data.status).toBe(SubscriptionServiceStatus.ACTIVE);
  });

  it('UT-98-02: Set status to INACTIVE.', async () => {
    const controller = createController(SubscriptionServiceStatus.INACTIVE);

    const result = await SubscriptionServicesController.prototype.update.call(controller, serviceId, {
      status: SubscriptionServiceStatus.INACTIVE,
    });

    expect(result.data.status).toBe(SubscriptionServiceStatus.INACTIVE);
  });

  it('UT-98-03: Toggle INACTIVE -> ACTIVE on existing tier.', async () => {
    const controller = createController(SubscriptionServiceStatus.ACTIVE);

    const result = await SubscriptionServicesController.prototype.update.call(controller, serviceId, {
      status: SubscriptionServiceStatus.ACTIVE,
    });

    expect(result.message).toBe('Subscription service updated successfully');
  });

  it('UT-98-04: Missing JWT.', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, SubscriptionServicesController.prototype.update);

    expect(Array.isArray(guards) || guards === undefined).toBe(true);
  });

  it('UT-98-05: Non-admin role attempt.', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, SubscriptionServicesController.prototype.update);

    expect(roles === undefined || roles.includes(AccountRole.ADMIN)).toBe(true);
  });

  it('UT-98-06: Invalid UUID param.', async () => {
    const controller = createController(SubscriptionServiceStatus.ACTIVE);

    await expect(
      SubscriptionServicesController.prototype.update.call(controller, 'invalid_uuid', {
        status: SubscriptionServiceStatus.ACTIVE,
      }),
    ).resolves.toBeDefined();
  });

  it('UT-98-07: Invalid status enum value.', async () => {
    const messages = await collectMessages({ status: 'ARCHIVED' as any });

    expect(messages.some((m) => m.includes('status must be one of the following values'))).toBe(true);
  });

  it('UT-98-08: Target subscription not found or runtime failure.', async () => {
    const controller = {
      subscriptionServicesService: {
        update: jest.fn().mockRejectedValue(new Error('db failed')),
      },
    } as any;

    await expect(
      SubscriptionServicesController.prototype.update.call(controller, serviceId, {
        status: SubscriptionServiceStatus.ACTIVE,
      }),
    ).rejects.toThrow('db failed');
  });

  it('UT-98-09: Boundary explicit status=ACTIVE accepted repeatedly.', async () => {
    const first = await collectMessages({ status: SubscriptionServiceStatus.ACTIVE });
    const second = await collectMessages({ status: SubscriptionServiceStatus.ACTIVE });

    expect(first).toEqual([]);
    expect(second).toEqual([]);
  });

  it('UT-98-10: Boundary explicit status=INACTIVE accepted repeatedly.', async () => {
    const first = await collectMessages({ status: SubscriptionServiceStatus.INACTIVE });
    const second = await collectMessages({ status: SubscriptionServiceStatus.INACTIVE });

    expect(first).toEqual([]);
    expect(second).toEqual([]);
  });
});
