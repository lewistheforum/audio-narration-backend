import { BadRequestException, ForbiddenException, NotFoundException, ParseUUIDPipe } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { ClinicRevenueController } from '../../../../src/modules/accounts/api-clinic-admin/clinic-revenue.controller';
import { ClinicRevenueService } from '../../../../src/modules/accounts/api-clinic-admin/clinic-revenue.service';
import {
  ClinicRevenueFilterDto,
  RevenueGroupBy,
} from '../../../../src/modules/accounts/api-clinic-admin/dto/clinic-revenue-filter.dto';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';
import { TransactionsController } from '../../../../src/modules/transactions/transactions.controller';
import { TransactionsService } from '../../../../src/modules/transactions/transactions.service';
import {
  ManagerRevenueReportDto,
  RevenuePeriod,
} from '../../../../src/modules/transactions/dto/manager-revenue-report.dto';

describe('UC-94 View Branch Financial Reports', () => {
  const managerId = '123e4567-e89b-42d3-a456-426614174002';
  const adminId = '123e4567-e89b-42d3-a456-426614174003';

  const collectManagerDtoMessages = async (dto: object) => {
    const errors = await validate(plainToInstance(ManagerRevenueReportDto, dto));
    return errors.flatMap((error) => Object.values(error.constraints ?? {}));
  };

  const collectBranchDtoMessages = async (dto: object) => {
    const errors = await validate(plainToInstance(ClinicRevenueFilterDto, dto));
    return errors.flatMap((error) => Object.values(error.constraints ?? {}));
  };

  it('UT-94-01: CLINIC_MANAGER views daily branch revenue with valid date range.', async () => {
    const controller = {
      transactionsService: {
        getManagerRevenueStats: jest.fn().mockResolvedValue({ period: RevenuePeriod.DAILY, data: [{ total_revenue: 100 }] }),
      },
    } as any;

    const result = await TransactionsController.prototype.getManagerRevenueReport.call(
      controller,
      { _id: managerId },
      { startDate: '2026-01-01', endDate: '2026-01-31', period: RevenuePeriod.DAILY },
    );

    expect(controller.transactionsService.getManagerRevenueStats).toHaveBeenCalledWith(managerId, {
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      period: RevenuePeriod.DAILY,
    });
    expect(result.message).toBe('Revenue report retrieved successfully');
  });

  it('UT-94-02: CLINIC_MANAGER views monthly branch revenue.', async () => {
    const controller = {
      transactionsService: {
        getManagerRevenueStats: jest.fn().mockResolvedValue({ period: RevenuePeriod.MONTHLY, data: [] }),
      },
    } as any;

    const result = await TransactionsController.prototype.getManagerRevenueReport.call(
      controller,
      { _id: managerId },
      { startDate: '2026-01-01', endDate: '2026-01-31', period: RevenuePeriod.MONTHLY },
    );

    expect(result.data.period).toBe(RevenuePeriod.MONTHLY);
  });

  it('UT-94-03: CLINIC_MANAGER views yearly branch revenue.', async () => {
    const controller = {
      transactionsService: {
        getManagerRevenueStats: jest.fn().mockResolvedValue({ period: RevenuePeriod.YEARLY, data: [] }),
      },
    } as any;

    const result = await TransactionsController.prototype.getManagerRevenueReport.call(
      controller,
      { _id: managerId },
      { startDate: '2026-01-01', endDate: '2026-12-31', period: RevenuePeriod.YEARLY },
    );

    expect(result.data.period).toBe(RevenuePeriod.YEARLY);
  });

  it('UT-94-04: CLINIC_ADMIN views specific branch report by valid managerId.', async () => {
    const controller = {
      clinicRevenueService: {
        getBranchRevenueReport: jest.fn().mockResolvedValue({ branchInfo: { managerId } }),
      },
    } as any;

    const dto = { startDate: '2026-01-01', endDate: '2026-01-31', groupBy: RevenueGroupBy.DAY };
    const result = await ClinicRevenueController.prototype.getBranchRevenueReport.call(
      controller,
      { _id: adminId },
      managerId,
      dto,
    );

    expect(controller.clinicRevenueService.getBranchRevenueReport).toHaveBeenCalledWith(adminId, managerId, dto);
    expect(result.message).toBe('Branch revenue report retrieved successfully');
  });

  it('UT-94-05: CLINIC_ADMIN uses groupBy=week and receives aggregated data.', async () => {
    const controller = {
      clinicRevenueService: {
        getBranchRevenueReport: jest.fn().mockResolvedValue({ period: { groupedBy: RevenueGroupBy.WEEK }, servicesStats: [] }),
      },
    } as any;

    const result = await ClinicRevenueController.prototype.getBranchRevenueReport.call(
      controller,
      { _id: adminId },
      managerId,
      { startDate: '2026-01-01', endDate: '2026-01-31', groupBy: RevenueGroupBy.WEEK },
    );

    expect(result.data.period.groupedBy).toBe(RevenueGroupBy.WEEK);
  });

  it('UT-94-06: Valid query returns empty dataset structure when no data exists.', async () => {
    const controller = {
      clinicRevenueService: {
        getBranchRevenueReport: jest.fn().mockResolvedValue({ servicesStats: [], topServices: [], customerStats: [] }),
      },
    } as any;

    const result = await ClinicRevenueController.prototype.getBranchRevenueReport.call(
      controller,
      { _id: adminId },
      managerId,
      { startDate: '2026-01-01', endDate: '2026-01-31', groupBy: RevenueGroupBy.MONTH },
    );

    expect(result.data.servicesStats).toEqual([]);
    expect(result.data.topServices).toEqual([]);
  });

  it('UT-94-07: Missing JWT is rejected.', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, TransactionsController.prototype.getManagerRevenueReport);

    expect(guards).toHaveLength(2);
  });

  it('UT-94-08: Wrong role blocked at manager endpoint.', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, TransactionsController.prototype.getManagerRevenueReport);

    expect(roles).toEqual([AccountRole.CLINIC_MANAGER]);
  });

  it('UT-94-09: Wrong role blocked at clinic-admin endpoint.', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, ClinicRevenueController);

    expect(roles).toEqual([AccountRole.CLINIC_ADMIN]);
  });

  it('UT-94-10: Invalid UUID for managerId.', async () => {
    const pipe = new ParseUUIDPipe();

    await expect(pipe.transform('invalid_uuid', {} as any)).rejects.toThrow('Validation failed (uuid is expected)');
  });

  it('UT-94-11: Invalid date/enum query payload.', async () => {
    const managerMessages = await collectManagerDtoMessages({
      startDate: 'invalid-date',
      endDate: 'invalid-date',
      period: 'quarter',
    });
    const branchMessages = await collectBranchDtoMessages({
      startDate: 'invalid-date',
      endDate: 'invalid-date',
      groupBy: 'quarter',
    });

    expect(managerMessages).toContain('startDate must be a valid ISO 8601 date string');
    expect(managerMessages.some((m) => m.includes('period must be one of'))).toBe(true);
    expect(branchMessages).toContain('groupBy must be day, week, or month');
  });

  it('UT-94-12: Admin/manager ownership and role validation failures.', async () => {
    const missingContext = {
      accountRepository: { findOne: jest.fn().mockResolvedValue(null) },
    } as any;
    const wrongRoleContext = {
      accountRepository: {
        findOne: jest.fn().mockResolvedValue({ _id: managerId, role: AccountRole.CLINIC_STAFF, parentId: adminId }),
      },
    } as any;
    const wrongOwnerContext = {
      accountRepository: {
        findOne: jest.fn().mockResolvedValue({ _id: managerId, role: AccountRole.CLINIC_MANAGER, parentId: 'other-admin' }),
      },
    } as any;

    await expect((ClinicRevenueService.prototype as any).validateManagerOwnership.call(missingContext, adminId, managerId)).rejects.toThrow(
      new NotFoundException('Manager account not found'),
    );
    await expect((ClinicRevenueService.prototype as any).validateManagerOwnership.call(wrongRoleContext, adminId, managerId)).rejects.toThrow(
      new BadRequestException('Specified account is not a CLINIC_MANAGER'),
    );
    await expect((ClinicRevenueService.prototype as any).validateManagerOwnership.call(wrongOwnerContext, adminId, managerId)).rejects.toThrow(
      new ForbiddenException('You do not have access to this branch'),
    );
  });

  it('UT-94-13: Service runtime/data-layer failure.', async () => {
    const serviceContext = {
      transactionRepository: {
        getRevenueStats: jest.fn().mockRejectedValue(new Error('db failed')),
      },
    } as any;

    await expect(
      TransactionsService.prototype.getManagerRevenueStats.call(serviceContext, managerId, {
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        period: RevenuePeriod.DAILY,
      }),
    ).rejects.toThrow('db failed');
  });

  it('UT-94-14: Date range boundary exactly 365 days is accepted.', () => {
    expect(() =>
      (ClinicRevenueService.prototype as any).validateDateRange.call({}, '2025-01-01', '2026-01-01'),
    ).not.toThrow();
  });

  it('UT-94-15: Boundary where startDate == endDate is rejected.', () => {
    expect(() =>
      (ClinicRevenueService.prototype as any).validateDateRange.call({}, '2026-01-01', '2026-01-01'),
    ).toThrow(new BadRequestException('startDate must be before endDate'));
  });
});
