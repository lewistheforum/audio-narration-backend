import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';
import { TransactionsController } from '../../../../src/modules/transactions/transactions.controller';
import { TransactionsService } from '../../../../src/modules/transactions/transactions.service';

describe('UC-13 Renew Subscription Package', () => {
  let controller: TransactionsController;
  let service: TransactionsService;
  let clinicSubscriptionRepo: { findOne: jest.Mock };
  let subscriptionServiceRepo: { findOne: jest.Mock };
  let subscriptionServicesService: { getRenewalQueueByClinicId: jest.Mock };

  const createSubscription = (overrides: Record<string, unknown> = {}) => ({
    _id: 'subscription-1',
    clinicId: 'clinic-admin-1',
    serviceId: 'service-current',
    subscriptionDate: new Date('2026-01-01T00:00:00.000Z'),
    expirationDate: new Date('2026-04-01T00:00:00.000Z'),
    subscriptionStatus: 'ACTIVE',
    ...overrides,
  });

  beforeEach(() => {
    clinicSubscriptionRepo = {
      findOne: jest.fn(),
    };

    subscriptionServiceRepo = {
      findOne: jest.fn(),
    };

    subscriptionServicesService = {
      getRenewalQueueByClinicId: jest.fn(),
    };

    service = new TransactionsService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      clinicSubscriptionRepo as any,
      subscriptionServiceRepo as any,
      {} as any,
      {
        get: jest.fn((key: string) => {
          if (key === 'SEEPAY_ACC') return '123456789';
          if (key === 'SEEPAY_BANK') return 'VCB';
          if (key === 'SEEPAY_QR_BASE') return 'https://qr.example.com';
          if (key === 'SEEPAY_QR_EXPIRE_MINUTES') return 15;
          return undefined;
        }),
      } as any,
      subscriptionServicesService as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    controller = new TransactionsController(service);
  });

  it('UT-13-01: CLINIC_ADMIN creates renewal QR successfully.', async () => {
    const createQrSpy = jest
      .spyOn(service, 'createRenewalQr')
      .mockResolvedValue({ id: 'tx-1', amount: 900000 } as any);

    const result = await controller.createRenewalQr({
      _id: 'clinic-admin-1',
      role: AccountRole.CLINIC_ADMIN,
    } as any);

    expect(createQrSpy).toHaveBeenCalledWith('clinic-admin-1');
    expect(result.message).toBe('Renewal QR created successfully');
  });

  it('UT-13-02: CLINIC_MANAGER with parent clinic admin creates renewal QR successfully.', async () => {
    const createQrSpy = jest
      .spyOn(service, 'createRenewalQr')
      .mockResolvedValue({ id: 'tx-2', amount: 900000 } as any);

    await controller.createRenewalQr({
      _id: 'manager-1',
      parentId: 'clinic-admin-parent',
      role: AccountRole.CLINIC_MANAGER,
    } as any);

    expect(createQrSpy).toHaveBeenCalledWith('clinic-admin-parent');
  });

  it('UT-13-03: Reject missing or invalid JWT.', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      TransactionsController.prototype.createRenewalQr,
    );

    expect(guards).toHaveLength(2);
  });

  it('UT-13-04: Reject authenticated role outside CLINIC_ADMIN and CLINIC_MANAGER.', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      TransactionsController.prototype.createRenewalQr,
    );

    expect(roles).toEqual([
      AccountRole.CLINIC_ADMIN,
      AccountRole.CLINIC_MANAGER,
    ]);
  });

  it('UT-13-05: Reject manager without parent clinic admin.', async () => {
    await expect(
      controller.createRenewalQr({
        _id: 'manager-1',
        role: AccountRole.CLINIC_MANAGER,
      } as any),
    ).rejects.toThrow(
      new BadRequestException('Manager account must have a parent Clinic Admin'),
    );
  });

  it('UT-13-06: Reject when subscription does not exist.', async () => {
    clinicSubscriptionRepo.findOne.mockResolvedValue(null);

    await expect(service.createRenewalQr('clinic-admin-1')).rejects.toThrow(
      new NotFoundException('Subscription not found for this clinic'),
    );
  });

  it('UT-13-07: Reject when renewal queue already exists.', async () => {
    clinicSubscriptionRepo.findOne.mockResolvedValue(createSubscription());
    subscriptionServicesService.getRenewalQueueByClinicId.mockResolvedValue({
      _id: 'queue-1',
    });

    await expect(service.createRenewalQr('clinic-admin-1')).rejects.toThrow(
      new BadRequestException(
        'A renewal or package change is already queued for this clinic. Please wait for the current queued package to be activated.',
      ),
    );
  });

  it('UT-13-08: Reject when current service cannot be found.', async () => {
    subscriptionServiceRepo.findOne.mockResolvedValue(null);

    await expect(
      service.handleRenewalTransaction(createSubscription() as any),
    ).rejects.toThrow(new NotFoundException('Current service not found'));
  });

  it('UT-13-09: Clamp inferred renewal duration to 1 month when calculated month diff is non-positive.', async () => {
    subscriptionServiceRepo.findOne.mockResolvedValue({
      _id: 'service-current',
      serviceName: 'Premium',
      price: 1000000,
      discount: 10,
    });
    const createTransactionSpy = jest
      .spyOn(service, 'createOrUpdateTransaction')
      .mockResolvedValue({ id: 'tx-3', amount: 900000, status: 'PENDING' } as any);

    await service.handleRenewalTransaction(
      createSubscription({
        subscriptionDate: new Date('2026-04-01T00:00:00.000Z'),
        expirationDate: new Date('2026-04-01T00:00:00.000Z'),
      }) as any,
    );

    expect(createTransactionSpy).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'subscription-1' }),
      900000,
      JSON.stringify({ duration: 1 }),
      'Renewal for Premium (1 months)',
    );
  });
});
