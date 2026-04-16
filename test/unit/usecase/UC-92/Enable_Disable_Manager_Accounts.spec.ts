import { BadRequestException, ForbiddenException, NotFoundException, ParseUUIDPipe } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';
import { AccountStatus } from '../../../../src/modules/accounts/enums/account-status.enum';
import { ClinicManagerController } from '../../../../src/modules/accounts/api-clinic-admin/clinic-manager.controller';
import { ClinicManagerService } from '../../../../src/modules/accounts/api-clinic-admin/clinic-manager.service';

describe('UC-92 Enable Disable Manager Accounts', () => {
  const managerId = '123e4567-e89b-42d3-a456-426614174070';
  const clinicAdminId = 'clinic-admin-1';

  const createServiceContext = (options?: {
    manager?: any;
    count?: { staffCount: number; doctorCount: number };
    saveReject?: string;
  }) => ({
    accountRepository: {
      findAccountById: jest.fn().mockResolvedValue(
        options && 'manager' in options
          ? options.manager
          : {
              _id: managerId,
              parentId: clinicAdminId,
              role: AccountRole.CLINIC_MANAGER,
              status: AccountStatus.ACTIVE,
            },
      ),
      saveAccount: jest.fn().mockImplementation(async (payload: any) => {
        if (options?.saveReject) throw new Error(options.saveReject);
        return payload;
      }),
      countPersonnelByManager: jest
        .fn()
        .mockResolvedValue(options?.count ?? { staffCount: 2, doctorCount: 1 }),
    },
  }) as any;

  it('UT-92-01: Disable owned ACTIVE manager', async () => {
    const serviceContext = createServiceContext();

    const result = await ClinicManagerService.prototype.disableManager.call(serviceContext, clinicAdminId, managerId);

    expect(result.message).toContain('Manager disabled successfully');
  });

  it('UT-92-02: Enable owned MANAGER_DISABLED manager', async () => {
    const serviceContext = createServiceContext({
      manager: {
        _id: managerId,
        parentId: clinicAdminId,
        role: AccountRole.CLINIC_MANAGER,
        status: AccountStatus.MANAGER_DISABLED,
      },
    });

    const result = await ClinicManagerService.prototype.enableManager.call(serviceContext, clinicAdminId, managerId);

    expect(result.message).toContain('Manager enabled successfully');
  });

  it('UT-92-03: Disable success path message contract', async () => {
    const serviceContext = createServiceContext({ count: { staffCount: 5, doctorCount: 3 } });

    const result = await ClinicManagerService.prototype.disableManager.call(serviceContext, clinicAdminId, managerId);

    expect(result.message).toBe(
      'Manager disabled successfully. 5 staff and 3 doctors will be unable to login until manager is re-enabled.',
    );
  });

  it('UT-92-04: Enable success path message contract', async () => {
    const serviceContext = createServiceContext({
      manager: {
        _id: managerId,
        parentId: clinicAdminId,
        role: AccountRole.CLINIC_MANAGER,
        status: AccountStatus.MANAGER_DISABLED,
      },
      count: { staffCount: 5, doctorCount: 3 },
    });

    const result = await ClinicManagerService.prototype.enableManager.call(serviceContext, clinicAdminId, managerId);

    expect(result.message).toBe('Manager enabled successfully. 5 staff and 3 doctors can now login to the system.');
  });

  it('UT-92-05: Reject missing JWT', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, ClinicManagerController);

    expect(guards).toHaveLength(2);
  });

  it('UT-92-06: Reject non-clinic-admin role', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, ClinicManagerController.prototype.disableManager);

    expect(roles).toEqual([AccountRole.CLINIC_ADMIN]);
  });

  it('UT-92-07: Reject invalid UUID', async () => {
    const pipe = new ParseUUIDPipe();

    await expect(pipe.transform('invalid_uuid', {} as any)).rejects.toThrow('Validation failed (uuid is expected)');
  });

  it('UT-92-08: Reject manager not found', async () => {
    const serviceContext = createServiceContext({ manager: null });

    await expect(ClinicManagerService.prototype.enableManager.call(serviceContext, clinicAdminId, managerId)).rejects.toThrow(
      new NotFoundException('Manager not found'),
    );
  });

  it('UT-92-09: Reject ownership violation', async () => {
    const serviceContext = createServiceContext({
      manager: {
        _id: managerId,
        parentId: 'other-admin',
        role: AccountRole.CLINIC_MANAGER,
        status: AccountStatus.ACTIVE,
      },
    });

    await expect(ClinicManagerService.prototype.disableManager.call(serviceContext, clinicAdminId, managerId)).rejects.toThrow(
      new ForbiddenException('You do not have access to this manager'),
    );
  });

  it('UT-92-10: Reject invalid target role or status transition', async () => {
    const wrongRoleContext = createServiceContext({
      manager: {
        _id: managerId,
        parentId: clinicAdminId,
        role: AccountRole.CLINIC_STAFF,
        status: AccountStatus.ACTIVE,
      },
    });
    const wrongStatusContext = createServiceContext({
      manager: {
        _id: managerId,
        parentId: clinicAdminId,
        role: AccountRole.CLINIC_MANAGER,
        status: AccountStatus.PENDING_APPROVAL,
      },
    });

    await expect(ClinicManagerService.prototype.disableManager.call(wrongRoleContext, clinicAdminId, managerId)).rejects.toThrow(
      new BadRequestException('Account is not a clinic manager'),
    );
    await expect(ClinicManagerService.prototype.disableManager.call(wrongStatusContext, clinicAdminId, managerId)).rejects.toThrow(
      'Can only disable managers with ACTIVE status.',
    );
  });

  it('UT-92-11: Disable boundary at ACTIVE status', async () => {
    const serviceContext = createServiceContext({
      manager: {
        _id: managerId,
        parentId: clinicAdminId,
        role: AccountRole.CLINIC_MANAGER,
        status: AccountStatus.ACTIVE,
      },
    });

    const result = await ClinicManagerService.prototype.disableManager.call(serviceContext, clinicAdminId, managerId);

    expect(result.message).toContain('Manager disabled successfully');
  });

  it('UT-92-12: Enable boundary at MANAGER_DISABLED status', async () => {
    const serviceContext = createServiceContext({
      manager: {
        _id: managerId,
        parentId: clinicAdminId,
        role: AccountRole.CLINIC_MANAGER,
        status: AccountStatus.MANAGER_DISABLED,
      },
    });

    const result = await ClinicManagerService.prototype.enableManager.call(serviceContext, clinicAdminId, managerId);

    expect(result.message).toContain('Manager enabled successfully');
  });
});
