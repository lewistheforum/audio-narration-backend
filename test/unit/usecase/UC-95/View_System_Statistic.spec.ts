import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { AdminController } from '../../../../src/modules/admin/admin.controller';
import { AdminStatisticsService } from '../../../../src/modules/admin/admin-statistics.service';
import {
  ClinicIdQueryDto,
  MonthQueryDto,
  ServiceMonthQueryDto,
  ServiceYearQueryDto,
  YearQueryDto,
} from '../../../../src/modules/admin/dto/admin-statistics-query.dto';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';

describe('UC-95 View System Statistic', () => {
  const clinicId = '123e4567-e89b-42d3-a456-426614174004';
  const serviceId = '123e4567-e89b-42d3-a456-426614174005';

  const collectMessages = async (cls: new () => any, dto: object) => {
    const errors = await validate(plainToInstance(cls, dto));
    return errors.flatMap((error) => Object.values(error.constraints ?? {}));
  };

  it('UT-95-01: Admin gets yearly income statistics.', async () => {
    const controller = {
      adminStatisticsService: {
        getIncomeByYear: jest.fn().mockResolvedValue([{ monthNum: 1, totalIncome: 1000 }]),
      },
    } as any;

    const result = await AdminController.prototype.getIncomeYearly.call(controller, { year: 2025 });

    expect(controller.adminStatisticsService.getIncomeByYear).toHaveBeenCalledWith(2025, undefined);
    expect(result.message).toBe('Income statistics retrieved successfully');
  });

  it('UT-95-02: Admin gets monthly income statistics.', async () => {
    const controller = {
      adminStatisticsService: {
        getIncomeByMonth: jest.fn().mockResolvedValue([{ transactionDate: '2025-05-01', totalIncome: 500 }]),
      },
    } as any;

    const result = await AdminController.prototype.getIncomeMonthly.call(controller, {
      year: 2025,
      month: 5,
      serviceId,
    });

    expect(controller.adminStatisticsService.getIncomeByMonth).toHaveBeenCalledWith(2025, 5, serviceId);
    expect(result.message).toBe('Income statistics retrieved successfully');
  });

  it('UT-95-03: Admin gets service/clinic KPI groups (clinics-by-service, service-usage, top-clinics).', async () => {
    const controller = {
      adminStatisticsService: {
        getClinicCountByServiceYear: jest.fn().mockResolvedValue([{ serviceName: 'S1' }]),
        getServiceUsagePieChartYear: jest.fn().mockResolvedValue([{ serviceName: 'S1', percentage: 50 }]),
        getTopClinicsYear: jest.fn().mockResolvedValue([{ clinicName: 'Clinic A' }]),
      },
    } as any;

    const byService = await AdminController.prototype.getClinicsByServiceYearly.call(controller, { year: 2025 });
    const usage = await AdminController.prototype.getServiceUsageYearly.call(controller, { year: 2025 });
    const top = await AdminController.prototype.getTopClinicsYearly.call(controller, { year: 2025 });

    expect(byService.data.data).toEqual([{ serviceName: 'S1' }]);
    expect(usage.data.data).toEqual([{ serviceName: 'S1', percentage: 50 }]);
    expect(top.data.data).toEqual([{ clinicName: 'Clinic A' }]);
  });

  it('UT-95-04: Admin gets clinic spending and clinic transaction log.', async () => {
    const controller = {
      adminStatisticsService: {
        getClinicSpendingYear: jest.fn().mockResolvedValue([{ clinicName: 'Clinic A', totalExtraSpent: 200 }]),
        getClinicTransactionLog: jest.fn().mockResolvedValue([{ transactionId: 'tx-1', amount: 100 }]),
      },
    } as any;

    const spending = await AdminController.prototype.getClinicSpendingYearly.call(controller, { year: 2025 });
    const log = await AdminController.prototype.getClinicTransactions.call(controller, { clinicId });

    expect(spending.data.data[0].clinicName).toBe('Clinic A');
    expect(log.data.data[0].transactionId).toBe('tx-1');
  });

  it('UT-95-05: Admin gets longest-using-clinics KPI list.', async () => {
    const controller = {
      adminStatisticsService: {
        getLongestUsingClinics: jest.fn().mockResolvedValue([{ clinicName: 'Clinic A', timeUsingSystem: '2 years' }]),
      },
    } as any;

    const result = await AdminController.prototype.getLongestUsingClinics.call(controller);

    expect(result.data.data[0].clinicName).toBe('Clinic A');
    expect(result.message).toBe('Longest using clinics retrieved successfully');
  });

  it('UT-95-06: Missing JWT.', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, AdminController);

    expect(guards).toHaveLength(2);
  });

  it('UT-95-07: Non-admin role blocked.', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, AdminController.prototype.getIncomeYearly);

    expect(roles).toEqual([AccountRole.ADMIN]);
  });

  it('UT-95-08: Invalid year/month numeric constraints.', async () => {
    const yearMessages = await collectMessages(YearQueryDto, { year: 2019 });
    const monthMessages = await collectMessages(MonthQueryDto, { year: 2025, month: 13 });

    expect(yearMessages).toContain('Year must be at least 2020');
    expect(monthMessages).toContain('Month must be at most 12');
  });

  it('UT-95-09: Invalid UUID in serviceId.', async () => {
    const messages = await collectMessages(YearQueryDto, { year: 2025, serviceId: 'invalid_uuid' });

    expect(messages).toContain('Service ID must be a valid UUID');
  });

  it('UT-95-10: Invalid UUID in clinicId.', async () => {
    const messages = await collectMessages(ClinicIdQueryDto, { clinicId: 'invalid_uuid' });

    expect(messages).toContain('Clinic ID must be a valid UUID');
  });

  it('UT-95-11: Invalid data type for year/month.', async () => {
    const yearMessages = await collectMessages(YearQueryDto, { year: 'abc' as any });
    const monthMessages = await collectMessages(MonthQueryDto, { year: 2025, month: 'abc' as any });

    expect(yearMessages).toContain('Year must be an integer');
    expect(monthMessages).toContain('Month must be an integer');
  });

  it('UT-95-12: Runtime repository/query error.', async () => {
    const serviceContext = {
      adminStatisticsRepository: {
        getIncomeByYear: jest.fn().mockRejectedValue(new Error('db failed')),
      },
    } as any;

    await expect(AdminStatisticsService.prototype.getIncomeByYear.call(serviceContext, 2025)).rejects.toThrow('db failed');
  });

  it('UT-95-13: year boundary values 2020 and 2100 accepted.', async () => {
    const minMessages = await collectMessages(ServiceYearQueryDto, { year: 2020 });
    const maxMessages = await collectMessages(ServiceYearQueryDto, { year: 2100 });

    expect(minMessages).toEqual([]);
    expect(maxMessages).toEqual([]);
  });

  it('UT-95-14: month boundary values 1 and 12 accepted.', async () => {
    const minMessages = await collectMessages(ServiceMonthQueryDto, { year: 2025, month: 1 });
    const maxMessages = await collectMessages(ServiceMonthQueryDto, { year: 2025, month: 12 });

    expect(minMessages).toEqual([]);
    expect(maxMessages).toEqual([]);
  });
});
