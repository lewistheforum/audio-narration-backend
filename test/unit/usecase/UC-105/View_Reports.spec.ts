import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';
import { GetReportsDto } from '../../../../src/modules/reports/dto/get-reports.dto';
import { ReportController } from '../../../../src/modules/reports/report.controller';
import { ReportService } from '../../../../src/modules/reports/report.service';

describe('UC-105 View Reports', () => {
  const reportId = '123e4567-e89b-42d3-a456-426614174201';
  const userId = '123e4567-e89b-42d3-a456-426614174202';

  const collectMessages = async (dto: object) => {
    const errors = await validate(plainToInstance(GetReportsDto, dto));
    return errors.flatMap((error) => Object.values(error.constraints ?? {}));
  };

  it('UT-105-01: ADMIN views all reports list.', async () => {
    const service = {
      reportRepository: {
        findAllReports: jest.fn().mockResolvedValue({ data: [{ _id: reportId }], total: 1 }),
      },
    } as any;

    const result = await ReportService.prototype.findAllReports.call(
      service,
      { page: 1, limit: 10 },
      { _id: userId, role: AccountRole.ADMIN },
    );

    expect(service.reportRepository.findAllReports).toHaveBeenCalledWith(1, 10, undefined);
    expect(result.total).toBe(1);
  });

  it('UT-105-02: Non-admin views own reports list only.', async () => {
    const service = {
      reportRepository: {
        findAllReports: jest.fn().mockResolvedValue({ data: [{ accountId: userId }], total: 1 }),
      },
    } as any;

    await ReportService.prototype.findAllReports.call(
      service,
      { page: 1, limit: 10 },
      { _id: userId, role: AccountRole.PATIENT },
    );

    expect(service.reportRepository.findAllReports).toHaveBeenCalledWith(1, 10, userId);
  });

  it('UT-105-03: Valid pagination list returns sorted data.', async () => {
    const controller = {
      reportService: {
        findAllReports: jest.fn().mockResolvedValue({ data: [{ _id: reportId }], total: 1 }),
      },
    } as any;

    const result = await ReportController.prototype.findAll.call(controller, { _id: userId, role: AccountRole.CLINIC_STAFF }, { page: 2, limit: 5 });

    expect(controller.reportService.findAllReports).toHaveBeenCalledWith({ page: 2, limit: 5 }, { _id: userId, role: AccountRole.CLINIC_STAFF });
    expect(result.data).toHaveLength(1);
  });

  it('UT-105-04: ADMIN views report detail by id.', async () => {
    const service = {
      reportRepository: {
        findReportById: jest.fn().mockResolvedValue({ _id: reportId, accountId: 'other' }),
      },
    } as any;

    const result = await ReportService.prototype.findReportById.call(service, reportId, { _id: userId, role: AccountRole.ADMIN });

    expect(result._id).toBe(reportId);
    expect(service.reportRepository.findReportById).toHaveBeenCalledWith(reportId, undefined);
  });

  it('UT-105-05: Non-admin views own report detail.', async () => {
    const service = {
      reportRepository: {
        findReportById: jest.fn().mockResolvedValue({ _id: reportId, accountId: userId }),
      },
    } as any;

    const result = await ReportService.prototype.findReportById.call(service, reportId, { _id: userId, role: AccountRole.DOCTOR });

    expect(result.accountId).toBe(userId);
  });

  it('UT-105-06: Missing JWT.', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, ReportController.prototype.findAll);

    expect(guards).toHaveLength(2);
  });

  it('UT-105-07: Invalid query params page/limit.', async () => {
    const messages = await collectMessages({ page: 0, limit: 'bad' as any });

    expect(messages.some((m) => m.includes('page must not be less than 1'))).toBe(true);
    expect(messages.some((m) => m.includes('limit must not be less than 1') || m.includes('limit must be an integer number'))).toBe(true);
  });

  it('UT-105-08: Report id not found.', async () => {
    const service = {
      reportRepository: {
        findReportById: jest.fn().mockResolvedValue(null),
      },
    } as any;

    await expect(ReportService.prototype.findReportById.call(service, reportId, { _id: userId, role: AccountRole.ADMIN })).rejects.toThrow(NotFoundException);
  });

  it('UT-105-09: Non-admin accesses others report.', async () => {
    const service = {
      reportRepository: {
        findReportById: jest.fn().mockResolvedValue({ _id: reportId, accountId: 'someone-else' }),
      },
    } as any;

    await expect(ReportService.prototype.findReportById.call(service, reportId, { _id: userId, role: AccountRole.CLINIC_ADMIN })).rejects.toThrow(ForbiddenException);
  });

  it('UT-105-10: Invalid id format causes not found branch.', async () => {
    const service = {
      reportRepository: {
        findReportById: jest.fn().mockResolvedValue(null),
      },
    } as any;

    await expect(ReportService.prototype.findReportById.call(service, 'invalid-id', { _id: userId, role: AccountRole.ADMIN })).rejects.toThrow('Report with ID invalid-id not found');
  });

  it('UT-105-11: Role GUEST blocked by guard metadata.', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, ReportController.prototype.findAll);

    expect(roles).toEqual([
      AccountRole.PATIENT,
      AccountRole.CLINIC_STAFF,
      AccountRole.CLINIC_ADMIN,
      AccountRole.CLINIC_MANAGER,
      AccountRole.DOCTOR,
      AccountRole.ADMIN,
    ]);
  });

  it('UT-105-12: Repository returns null in detail branch.', async () => {
    const service = {
      reportRepository: {
        findReportById: jest.fn().mockResolvedValue(null),
      },
    } as any;

    await expect(ReportService.prototype.findReportById.call(service, reportId, { _id: userId, role: AccountRole.DOCTOR })).rejects.toThrow(NotFoundException);
  });

  it('UT-105-13: Boundary page=1 accepted.', async () => {
    const messages = await collectMessages({ page: 1, limit: 10 });

    expect(messages).toEqual([]);
  });

  it('UT-105-14: Boundary limit=1 accepted.', async () => {
    const messages = await collectMessages({ page: 2, limit: 1 });

    expect(messages).toEqual([]);
  });
});
