import { NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { AccountsController } from '../../../../src/modules/accounts/accounts.controller';
import { AccountsService } from '../../../../src/modules/accounts/accounts.service';
import { GetStaffListDto } from '../../../../src/modules/accounts/dto/get-staff-list.dto';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';

describe('UC-51 View Staff List', () => {
  const baseAccount = {
    _id: 'staff-1',
    email: 'staff@clinic.com',
    clinicStaffInformation: {
      fullName: 'Reception Staff',
      clinicRole: 'RECEPTIONIST',
    },
  };

  const createServiceContext = ({ accounts = [baseAccount], total = 1 } = {}) => ({
    accountRepository: {
      findAccountById: jest.fn().mockResolvedValue({ _id: 'manager-1', parentId: 'clinic-admin-1' }),
      findByParentIdAndRole: jest.fn().mockResolvedValue([{ _id: 'manager-2' }]),
      findStaffByClinicWithFilters: jest.fn().mockResolvedValue([accounts, total]),
    },
  }) as any;

  const collectMessages = async (dto: object) => {
    const errors = await validate(plainToInstance(GetStaffListDto, dto));
    return errors.flatMap((error) => Object.values(error.constraints ?? {}));
  };

  it('UT-51-01: View staff list successfully with default query.', async () => {
    const serviceContext = createServiceContext();

    const result = await AccountsService.prototype.findAllStaffByManager.call(
      serviceContext,
      'manager-1',
      1,
      10,
    );

    expect(result.staff).toHaveLength(1);
    expect(result.pagination).toEqual({ page: 1, limit: 10, total: 1, totalPages: 1 });
  });

  it('UT-51-02: View staff list successfully with search filter.', async () => {
    const serviceContext = createServiceContext();

    await AccountsService.prototype.findAllStaffByManager.call(
      serviceContext,
      'manager-1',
      1,
      10,
      'reception',
    );

    expect(serviceContext.accountRepository.findStaffByClinicWithFilters).toHaveBeenCalledWith(
      ['clinic-admin-1', 'manager-2'],
      0,
      10,
      'reception',
      undefined,
      undefined,
      undefined,
      undefined,
    );
  });

  it('UT-51-03: View staff list successfully with date range.', async () => {
    const controllerContext = {
      accountsService: {
        findAllStaffByManager: jest.fn().mockResolvedValue({
          staff: [],
          pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        }),
      },
    } as any;

    const result = await AccountsController.prototype.getStaffList.call(
      controllerContext,
      { user: { _id: 'manager-1' } },
      { fromDate: '2026-01-01', toDate: '2026-12-31', page: 1, limit: 10 },
    );

    expect(result.message).toBe('Staff list retrieved successfully');
    expect(controllerContext.accountsService.findAllStaffByManager).toHaveBeenCalledWith(
      'manager-1',
      1,
      10,
      undefined,
      undefined,
      '2026-01-01',
      '2026-12-31',
    );
  });

  it('UT-51-04: View staff list successfully with custom pagination.', async () => {
    const serviceContext = createServiceContext();

    const result = await AccountsService.prototype.findAllStaffByManager.call(
      serviceContext,
      'manager-1',
      1,
      20,
    );

    expect(result.pagination.limit).toBe(20);
  });

  it('UT-51-05: Reject request without JWT.', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, AccountsController.prototype.getStaffList);

    expect(guards).toHaveLength(2);
  });

  it('UT-51-06: Reject non-manager role by RBAC.', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, AccountsController.prototype.getStaffList);

    expect(roles).toEqual([AccountRole.CLINIC_MANAGER]);
  });

  it('UT-51-07: Reject invalid query DTO values.', async () => {
    const messages = await collectMessages({
      search: 123,
      fromDate: '2026-99-99',
      toDate: '2026-99-99',
      page: 0,
      limit: 0,
    });

    expect(messages).toContain('search must be a string');
    expect(messages).toContain('fromDate must be a valid ISO 8601 date string');
    expect(messages).toContain('toDate must be a valid ISO 8601 date string');
    expect(messages).toContain('page must not be less than 1');
    expect(messages).toContain('limit must not be less than 1');
  });

  it('UT-51-08: Return not found when manager account is missing.', async () => {
    const serviceContext = createServiceContext();
    serviceContext.accountRepository.findAccountById.mockResolvedValue(null);

    await expect(
      AccountsService.prototype.findAllStaffByManager.call(serviceContext, 'manager-1', 1, 10),
    ).rejects.toThrow(new NotFoundException('User not found'));
  });

  it('UT-51-09: Return internal error when repository query fails.', async () => {
    const serviceContext = createServiceContext();
    serviceContext.accountRepository.findStaffByClinicWithFilters.mockRejectedValue(new Error('db failed'));

    await expect(
      AccountsService.prototype.findAllStaffByManager.call(
        serviceContext,
        'manager-1',
        1,
        10,
        'reception',
        undefined,
        '2026-01-01',
        '2026-12-31',
      ),
    ).rejects.toThrow('db failed');
  });

  it('UT-51-10: Return empty staff list when clinic has no staff.', async () => {
    const serviceContext = createServiceContext({ accounts: [], total: 0 });

    const result = await AccountsService.prototype.findAllStaffByManager.call(
      serviceContext,
      'manager-1',
      1,
      10,
    );

    expect(result).toEqual({
      staff: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });
  });

  it('UT-51-11: Return empty page for very high page index.', async () => {
    const serviceContext = createServiceContext({ accounts: [], total: 1 });

    const result = await AccountsService.prototype.findAllStaffByManager.call(
      serviceContext,
      'manager-1',
      999,
      10,
    );

    expect(result).toEqual({
      staff: [],
      pagination: { page: 999, limit: 10, total: 1, totalPages: 1 },
    });
  });
});
