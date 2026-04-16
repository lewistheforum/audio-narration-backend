import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';
import { ReportController } from '../../../../src/modules/reports/report.controller';
import { ReportService } from '../../../../src/modules/reports/report.service';
import { ResponseReportDto } from '../../../../src/modules/reports/dto/response-report.dto';

describe('UC-106 Response Reports', () => {
  const reportId = '123e4567-e89b-42d3-a456-426614174301';
  const responseText = 'We reviewed your case.';

  const collectMessages = async (dto: object) => {
    const errors = await validate(plainToInstance(ResponseReportDto, dto));
    return errors.flatMap((error) => Object.values(error.constraints ?? {}));
  };

  it('UT-106-01: Admin responds report successfully.', async () => {
    const report = { _id: reportId, isResponse: false, account: { email: 'u@example.com', username: 'u' } };
    const saved = { ...report, isResponse: true, responseDescription: responseText };
    const service = {
      reportRepository: {
        findReportById: jest.fn().mockResolvedValue(report),
        saveReport: jest.fn().mockResolvedValue(saved),
      },
      mailerService: { sendReportResponseEmail: jest.fn().mockResolvedValue(undefined) },
    } as any;

    const result = await ReportService.prototype.respondToReport.call(service, reportId, { responseDescription: responseText });

    expect(result.isResponse).toBe(true);
    expect(result.responseDescription).toBe(responseText);
  });

  it('UT-106-02: Service sets isResponse=true and saves response text.', async () => {
    const report = { _id: reportId, isResponse: false, account: null };
    const service = {
      reportRepository: {
        findReportById: jest.fn().mockResolvedValue(report),
        saveReport: jest.fn().mockImplementation(async (r: any) => r),
      },
      mailerService: { sendReportResponseEmail: jest.fn() },
    } as any;

    const result = await ReportService.prototype.respondToReport.call(service, reportId, { responseDescription: responseText });

    expect(service.reportRepository.saveReport).toHaveBeenCalledWith(expect.objectContaining({ isResponse: true, responseDescription: responseText }));
    expect(result.isResponse).toBe(true);
  });

  it('UT-106-03: Email notification sent when report owner exists.', async () => {
    const report = { _id: reportId, isResponse: false, account: { email: 'u@example.com', username: 'User' } };
    const service = {
      reportRepository: {
        findReportById: jest.fn().mockResolvedValue(report),
        saveReport: jest.fn().mockImplementation(async (r: any) => r),
      },
      mailerService: { sendReportResponseEmail: jest.fn().mockResolvedValue(undefined) },
    } as any;

    await ReportService.prototype.respondToReport.call(service, reportId, { responseDescription: responseText });

    expect(service.mailerService.sendReportResponseEmail).toHaveBeenCalledWith('u@example.com', 'User', responseText);
  });

  it('UT-106-04: Flow still returns success even when report has no account relation.', async () => {
    const report = { _id: reportId, isResponse: false, account: null };
    const service = {
      reportRepository: {
        findReportById: jest.fn().mockResolvedValue(report),
        saveReport: jest.fn().mockImplementation(async (r: any) => r),
      },
      mailerService: { sendReportResponseEmail: jest.fn() },
    } as any;

    const result = await ReportService.prototype.respondToReport.call(service, reportId, { responseDescription: responseText });

    expect(result.isResponse).toBe(true);
    expect(service.mailerService.sendReportResponseEmail).not.toHaveBeenCalled();
  });

  it('UT-106-05: Missing JWT.', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, ReportController.prototype.respondToReport);

    expect(guards).toHaveLength(2);
  });

  it('UT-106-06: Non-admin role access denied.', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, ReportController.prototype.respondToReport);

    expect(roles).toEqual([AccountRole.ADMIN]);
  });

  it('UT-106-07: Empty/non-string responseDescription validation fail.', async () => {
    const emptyMessages = await collectMessages({ responseDescription: '' });
    const typeMessages = await collectMessages({ responseDescription: 123 as any });

    expect(emptyMessages.some((m) => m.includes('should not be empty'))).toBe(true);
    expect(typeMessages.some((m) => m.includes('must be a string'))).toBe(true);
  });

  it('UT-106-08: Report id not found.', async () => {
    const service = {
      reportRepository: {
        findReportById: jest.fn().mockResolvedValue(null),
      },
    } as any;

    await expect(ReportService.prototype.respondToReport.call(service, reportId, { responseDescription: responseText })).rejects.toThrow(NotFoundException);
  });

  it('UT-106-09: Report already responded.', async () => {
    const service = {
      reportRepository: {
        findReportById: jest.fn().mockResolvedValue({ _id: reportId, isResponse: true }),
      },
    } as any;

    await expect(ReportService.prototype.respondToReport.call(service, reportId, { responseDescription: responseText })).rejects.toThrow(BadRequestException);
  });

  it('UT-106-10: Mailer failure is caught and does not break response update.', async () => {
    const report = { _id: reportId, isResponse: false, account: { email: 'u@example.com', username: 'User' } };
    const service = {
      reportRepository: {
        findReportById: jest.fn().mockResolvedValue(report),
        saveReport: jest.fn().mockImplementation(async (r: any) => r),
      },
      mailerService: { sendReportResponseEmail: jest.fn().mockRejectedValue(new Error('mail down')) },
    } as any;

    const result = await ReportService.prototype.respondToReport.call(service, reportId, { responseDescription: responseText });

    expect(result.isResponse).toBe(true);
  });

  it('UT-106-11: Minimal non-empty responseDescription accepted.', async () => {
    const messages = await collectMessages({ responseDescription: 'a' });

    expect(messages).toEqual([]);
  });

  it('UT-106-12: Large valid responseDescription accepted.', async () => {
    const messages = await collectMessages({ responseDescription: 'x'.repeat(5000) });

    expect(messages).toEqual([]);
  });
});
