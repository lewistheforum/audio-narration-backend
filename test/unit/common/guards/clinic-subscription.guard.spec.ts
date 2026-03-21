import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClinicSubscriptionGuard } from '../../../../src/common/guards/clinic-subscription.guard';
import { AccountsService } from '../../../../src/modules/accounts/accounts.service';
import { AccountRole } from '../../../../src/modules/accounts/enums';
import { RegistrationStatus } from '../../../../src/modules/subscriptions/enums/subscription-status.enum';

describe('ClinicSubscriptionGuard', () => {
  let guard: ClinicSubscriptionGuard;
  let reflector: jest.Mocked<Reflector>;
  let accountsService: jest.Mocked<AccountsService>;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as any;
    accountsService = {
      resolveClinicAdminId: jest.fn(),
      getClinicSubscription: jest.fn(),
    } as any;
    guard = new ClinicSubscriptionGuard(reflector, accountsService);
  });

  const mockExecutionContext = (user: any): ExecutionContext => ({
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as any);

  it('should allow access for non-clinic roles', async () => {
    const context = mockExecutionContext({ role: AccountRole.PATIENT });
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should allow access if subscription is ACTIVE', async () => {
    const user = { role: AccountRole.CLINIC_ADMIN, _id: 'admin-1' };
    accountsService.resolveClinicAdminId.mockResolvedValue('admin-1');
    accountsService.getClinicSubscription.mockResolvedValue({
      subscriptionStatus: RegistrationStatus.ACTIVE,
    });

    const context = mockExecutionContext(user);
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should block CLINIC_MANAGER if subscription is EXPIRED', async () => {
    const user = { role: AccountRole.CLINIC_MANAGER, _id: 'manager-1', parentId: 'admin-1' };
    accountsService.resolveClinicAdminId.mockResolvedValue('admin-1');
    accountsService.getClinicSubscription.mockResolvedValue({
      subscriptionStatus: RegistrationStatus.EXPIRED,
    });
    reflector.getAllAndOverride.mockReturnValue(false);

    const context = mockExecutionContext(user);
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('should block CLINIC_ADMIN if subscription is EXPIRED and endpoint not marked', async () => {
    const user = { role: AccountRole.CLINIC_ADMIN, _id: 'admin-1' };
    accountsService.resolveClinicAdminId.mockResolvedValue('admin-1');
    accountsService.getClinicSubscription.mockResolvedValue({
      subscriptionStatus: RegistrationStatus.EXPIRED,
    });
    reflector.getAllAndOverride.mockReturnValue(false); // No @AllowExpiredSubscription()

    const context = mockExecutionContext(user);
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('should allow CLINIC_ADMIN if subscription is EXPIRED and endpoint is marked', async () => {
    const user = { role: AccountRole.CLINIC_ADMIN, _id: 'admin-1' };
    accountsService.resolveClinicAdminId.mockResolvedValue('admin-1');
    accountsService.getClinicSubscription.mockResolvedValue({
      subscriptionStatus: RegistrationStatus.EXPIRED,
    });
    reflector.getAllAndOverride.mockReturnValue(true); // @AllowExpiredSubscription() exists

    const context = mockExecutionContext(user);
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should block DOCTOR even if endpoint is marked and subscription is EXPIRED', async () => {
    const user = { role: AccountRole.DOCTOR, _id: 'doctor-1', parentId: 'manager-1' };
    accountsService.resolveClinicAdminId.mockResolvedValue('admin-1');
    accountsService.getClinicSubscription.mockResolvedValue({
      subscriptionStatus: RegistrationStatus.EXPIRED,
    });
    reflector.getAllAndOverride.mockReturnValue(true); // Marked, but user is DOCTOR

    const context = mockExecutionContext(user);
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });
});
