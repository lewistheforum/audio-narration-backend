import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';
import { TransactionsController } from '../../../../src/modules/transactions/transactions.controller';
import { ChangePackageDto } from '../../../../src/modules/transactions/dto/subscription-payment.dto';
import { TransactionsService } from '../../../../src/modules/transactions/transactions.service';

describe('UC-12 Switch Subscription Package', () => {
  let controller: TransactionsController;
  let service: TransactionsService;
  let clinicSubscriptionRepo: { findOne: jest.Mock };
  let subscriptionServiceRepo: { findOne: jest.Mock };
  let subscriptionServicesService: { getRenewalQueueByClinicId: jest.Mock };

  const createSubscription = (overrides: Record<string, unknown> = {}) => ({
    _id: 'subscription-1',
    clinicId: 'clinic-admin-1',
    serviceId: 'service-current',
    ...overrides,
  });

  const createTargetService = (overrides: Record<string, unknown> = {}) => ({
    _id: 'service-target',
    serviceName: 'Enterprise',
    price: 1000000,
    discount: 10,
    ...overrides,
  });

  const validateDto = (payload: Record<string, unknown>) =>
    validate(plainToInstance(ChangePackageDto, payload));

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

  it('UT-12-01: CLINIC_ADMIN creates package-change QR successfully.', async () => {
    const payment = { id: 'tx-1', amount: 900000 };
    const createQrSpy = jest
      .spyOn(service, 'createPackageChangeQr')
      .mockResolvedValue(payment as any);

    const result = await controller.createPackageChangeQr(
      { _id: 'clinic-admin-1', role: AccountRole.CLINIC_ADMIN } as any,
      plainToInstance(ChangePackageDto, {
        targetServiceId: '550e8400-e29b-41d4-a716-446655440000',
      }),
    );

    expect(createQrSpy).toHaveBeenCalledWith(
      'clinic-admin-1',
      '550e8400-e29b-41d4-a716-446655440000',
      1,
    );
    expect(result).toEqual({
      data: payment,
      message: 'Package Change QR created successfully',
    });
  });

  it('UT-12-02: CLINIC_MANAGER with parent clinic admin creates package-change QR successfully.', async () => {
    const createQrSpy = jest
      .spyOn(service, 'createPackageChangeQr')
      .mockResolvedValue({ id: 'tx-2', amount: 2700000 } as any);

    await controller.createPackageChangeQr(
      {
        _id: 'manager-1',
        parentId: 'clinic-admin-parent',
        role: AccountRole.CLINIC_MANAGER,
      } as any,
      plainToInstance(ChangePackageDto, {
        targetServiceId: '550e8400-e29b-41d4-a716-446655440000',
        duration: 3,
      }),
    );

    expect(createQrSpy).toHaveBeenCalledWith(
      'clinic-admin-parent',
      '550e8400-e29b-41d4-a716-446655440000',
      3,
    );
  });

  it('UT-12-03: Reject missing or invalid JWT.', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      TransactionsController.prototype.createPackageChangeQr,
    );

    expect(guards).toHaveLength(2);
  });

  it('UT-12-04: Reject authenticated role outside CLINIC_ADMIN and CLINIC_MANAGER.', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      TransactionsController.prototype.createPackageChangeQr,
    );

    expect(roles).toEqual([
      AccountRole.CLINIC_ADMIN,
      AccountRole.CLINIC_MANAGER,
    ]);
  });

  it('UT-12-05: Reject manager without parent clinic admin.', async () => {
    await expect(
      controller.createPackageChangeQr(
        { _id: 'manager-1', role: AccountRole.CLINIC_MANAGER } as any,
        plainToInstance(ChangePackageDto, {
          targetServiceId: '550e8400-e29b-41d4-a716-446655440000',
          duration: 1,
        }),
      ),
    ).rejects.toThrow(
      new BadRequestException('Manager account must have a parent Clinic Admin'),
    );
  });

  it('UT-12-06: Reject when subscription does not exist.', async () => {
    clinicSubscriptionRepo.findOne.mockResolvedValue(null);

    await expect(
      service.createPackageChangeQr(
        'clinic-admin-1',
        '550e8400-e29b-41d4-a716-446655440000',
        1,
      ),
    ).rejects.toThrow(
      new NotFoundException('Subscription not found for this clinic'),
    );
  });

  it('UT-12-07: Reject when renewal queue already exists.', async () => {
    clinicSubscriptionRepo.findOne.mockResolvedValue(createSubscription());
    subscriptionServicesService.getRenewalQueueByClinicId.mockResolvedValue({
      _id: 'queue-1',
    });

    await expect(
      service.createPackageChangeQr(
        'clinic-admin-1',
        '550e8400-e29b-41d4-a716-446655440000',
        1,
      ),
    ).rejects.toThrow(
      new BadRequestException(
        'A renewal or package change is already queued for this clinic. Please wait for the current queued package to be activated.',
      ),
    );
  });

  it('UT-12-08: Reject when target service does not exist.', async () => {
    subscriptionServiceRepo.findOne.mockResolvedValue(null);

    await expect(
      service.handlePackageChangeTransaction(
        createSubscription() as any,
        '550e8400-e29b-41d4-a716-446655440099',
        1,
      ),
    ).rejects.toThrow(new NotFoundException('Target service not found'));
  });

  it('UT-12-09: Reject invalid targetServiceId DTO input.', async () => {
    const missingErrors = await validateDto({ duration: 1 });
    const invalidErrors = await validateDto({
      targetServiceId: 'invalid_uuid',
      duration: 1,
    });

    const missingMessages = missingErrors.flatMap((error) =>
      Object.values(error.constraints ?? {}),
    );
    const invalidMessages = invalidErrors.flatMap((error) =>
      Object.values(error.constraints ?? {}),
    );

    expect(missingMessages).toContain('targetServiceId should not be empty');
    expect(invalidMessages).toContain('targetServiceId must be a UUID');
  });

  it('UT-12-10: Reject out-of-range duration DTO input.', async () => {
    const lowerBoundErrors = await validateDto({
      targetServiceId: '550e8400-e29b-41d4-a716-446655440000',
      duration: 0,
    });
    const upperBoundErrors = await validateDto({
      targetServiceId: '550e8400-e29b-41d4-a716-446655440000',
      duration: 13,
    });

    const lowerBoundMessages = lowerBoundErrors.flatMap((error) =>
      Object.values(error.constraints ?? {}),
    );
    const upperBoundMessages = upperBoundErrors.flatMap((error) =>
      Object.values(error.constraints ?? {}),
    );

    expect(lowerBoundMessages).toContain('duration must not be less than 1');
    expect(upperBoundMessages).toContain('duration must not be greater than 12');
  });
});
