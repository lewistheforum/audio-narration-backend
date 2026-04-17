import { BadRequestException, NotFoundException } from '@nestjs/common';
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

describe('UC-93 View Global Revenue Reports', () => {
  const adminId = '123e4567-e89b-42d3-a456-426614174001';

  const collectMessages = async (dto: object) => {
    const errors = await validate(plainToInstance(ClinicRevenueFilterDto, dto));
    return errors.flatMap((error) => Object.values(error.constraints ?? {}));
  };

  const createController = (data?: any) =>
    ({
      clinicRevenueService: {
        getOverallRevenueReport: jest.fn().mockResolvedValue(data ?? { summary: { totalRevenue: 1000 }, revenueTrend: [] }),
      },
    }) as any;

  it('UT-93-01: Retrieve overall report with valid date range and default grouping.', async () => {
    const controller = createController();
    const user = { _id: adminId } as any;
    const dto = { startDate: '2026-01-01', endDate: '2026-01-31' };

    const result = await ClinicRevenueController.prototype.getOverallRevenueReport.call(controller, user, dto);

    expect(controller.clinicRevenueService.getOverallRevenueReport).toHaveBeenCalledWith(adminId, dto);
    expect(result.message).toBe('Overall revenue report retrieved successfully');
  });

  it('UT-93-02: Retrieve overall report with groupBy=week.', async () => {
    const controller = createController({ period: { groupedBy: RevenueGroupBy.WEEK } });

    const result = await ClinicRevenueController.prototype.getOverallRevenueReport.call(
      controller,
      { _id: adminId },
      { startDate: '2026-01-01', endDate: '2026-01-31', groupBy: RevenueGroupBy.WEEK },
    );

    expect(result.data.period.groupedBy).toBe(RevenueGroupBy.WEEK);
  });

  it('UT-93-03: Retrieve overall report with groupBy=month.', async () => {
    const controller = createController({ period: { groupedBy: RevenueGroupBy.MONTH } });

    const result = await ClinicRevenueController.prototype.getOverallRevenueReport.call(
      controller,
      { _id: adminId },
      { startDate: '2026-01-01', endDate: '2026-03-31', groupBy: RevenueGroupBy.MONTH },
    );

    expect(result.data.period.groupedBy).toBe(RevenueGroupBy.MONTH);
  });

  it('UT-93-04: Retrieve report successfully when period has no transaction data.', async () => {
    const controller = createController({ summary: { totalRevenue: 0 }, revenueTrend: [] });

    const result = await ClinicRevenueController.prototype.getOverallRevenueReport.call(
      controller,
      { _id: adminId },
      { startDate: '2026-02-01', endDate: '2026-02-28', groupBy: RevenueGroupBy.DAY },
    );

    expect(result.data.summary.totalRevenue).toBe(0);
    expect(result.data.revenueTrend).toEqual([]);
  });

  it('UT-93-05: Missing JWT.', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, ClinicRevenueController);

    expect(guards).toHaveLength(2);
  });

  it('UT-93-06: Non-clinic-admin role rejected by RBAC.', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, ClinicRevenueController);

    expect(roles).toEqual([AccountRole.CLINIC_ADMIN]);
  });

  it('UT-93-07: Invalid ISO date or invalid groupBy payload.', async () => {
    const messages = await collectMessages({
      startDate: 'invalid-date',
      endDate: 'invalid-date',
      groupBy: 'quarter',
    });

    expect(messages).toContain('startDate must be a valid ISO 8601 date string');
    expect(messages).toContain('endDate must be a valid ISO 8601 date string');
    expect(messages).toContain('groupBy must be day, week, or month');
  });

  it('UT-93-08: startDate >= endDate rejected by service validation.', () => {
    expect(() =>
      (ClinicRevenueService.prototype as any).validateDateRange.call({}, '2026-01-15', '2026-01-15'),
    ).toThrow(new BadRequestException('startDate must be before endDate'));
  });

  it('UT-93-09: Date range over 365 days rejected.', () => {
    expect(() =>
      (ClinicRevenueService.prototype as any).validateDateRange.call({}, '2025-01-01', '2026-01-02'),
    ).toThrow(new BadRequestException('Date range cannot exceed 365 days'));
  });

  it('UT-93-10: Clinic admin validation/branch lookup/runtime failure.', async () => {
    const adminNotFoundContext = {
      accountRepository: { findOne: jest.fn().mockResolvedValue(null) },
    } as any;

    await expect((ClinicRevenueService.prototype as any).validateClinicAdmin.call(adminNotFoundContext, adminId)).rejects.toThrow(
      new NotFoundException('Admin account not found'),
    );

    const emptyBranchContext = {
      validateClinicAdmin: jest.fn().mockResolvedValue(undefined),
      validateDateRange: jest.fn(),
      getAdminBranchIds: jest.fn().mockResolvedValue([]),
    } as any;

    await expect(
      ClinicRevenueService.prototype.getOverallRevenueReport.call(emptyBranchContext, adminId, {
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      }),
    ).rejects.toThrow(new NotFoundException('No branches found under this admin'));

    const runtimeContext = {
      validateClinicAdmin: jest.fn().mockResolvedValue(undefined),
      validateDateRange: jest.fn(),
      getAdminBranchIds: jest.fn().mockResolvedValue(['m1']),
      calculateOverviewRevenueSummary: jest.fn().mockRejectedValue(new Error('db failed')),
      calculateOverviewUniquePatients: jest.fn(),
      calculateOverviewPaymentMethodBreakdown: jest.fn(),
      calculateOverviewRevenueTrend: jest.fn(),
      calculateOverviewStatusBreakdown: jest.fn(),
      calculateOverviewTransactionTypeBreakdown: jest.fn(),
      calculateOverviewBranchOperationalBreakdown: jest.fn(),
    } as any;

    await expect(
      ClinicRevenueService.prototype.getOverallRevenueReport.call(runtimeContext, adminId, {
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      }),
    ).rejects.toThrow('db failed');
  });

  it('UT-93-11: Boundary range just below limit (365 days) accepted.', () => {
    expect(() =>
      (ClinicRevenueService.prototype as any).validateDateRange.call({}, '2025-01-01', '2026-01-01'),
    ).not.toThrow();
  });

  it('UT-93-12: Boundary grouping day explicit value accepted.', async () => {
    const messages = await collectMessages({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      groupBy: RevenueGroupBy.DAY,
    });

    expect(messages).toEqual([]);
  });
});
