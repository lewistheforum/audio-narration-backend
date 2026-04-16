import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';
import { CreateReportDto } from '../../../../src/modules/reports/dto/create-report.dto';
import { ReportType } from '../../../../src/modules/reports/enums/report-type.enum';
import { ReportController } from '../../../../src/modules/reports/report.controller';
import { ReportService } from '../../../../src/modules/reports/report.service';

describe('UC-107 Report To Admin', () => {
  const userId = '123e4567-e89b-42d3-a456-426614174401';

  const collectMessages = async (dto: object) => {
    const errors = await validate(plainToInstance(CreateReportDto, dto));
    return errors.flatMap((error) => Object.values(error.constraints ?? {}));
  };

  const createService = () =>
    ({
      reportRepository: {
        createReport: jest.fn().mockImplementation((d: any) => d),
        saveReport: jest.fn().mockImplementation(async (d: any) => ({ _id: 'r1', ...d })),
      },
    }) as any;

  it('UT-107-01: PATIENT creates report successfully.', async () => {
    const service = createService();

    const result = await ReportService.prototype.createReport.call(service, userId, {
      reportType: ReportType.BUG,
      description: 'Issue found',
      reportImages: ['https://example.com/img.png'],
    });

    expect(result.accountId).toBe(userId);
    expect(result.reportType).toBe(ReportType.BUG);
  });

  it('UT-107-02: CLINIC_STAFF creates report successfully.', async () => {
    const controller = {
      reportService: {
        createReport: jest.fn().mockResolvedValue({ _id: 'r2' }),
      },
    } as any;

    const result = await ReportController.prototype.createReport.call(
      controller,
      { _id: userId, role: AccountRole.CLINIC_STAFF },
      { reportType: ReportType.ABUSE, description: 'Abuse report', reportImages: [] },
    );

    expect(controller.reportService.createReport).toHaveBeenCalledWith(userId, expect.any(Object));
    expect(result._id).toBe('r2');
  });

  it('UT-107-03: DOCTOR creates report with empty reportImages defaults to empty array.', async () => {
    const service = createService();

    const result = await ReportService.prototype.createReport.call(service, userId, {
      reportType: ReportType.BUG,
      description: 'No image',
    });

    expect(result.reportImages).toEqual([]);
  });

  it('UT-107-04: Service stores isResponse=false, responseDescription=null.', async () => {
    const service = createService();

    const result = await ReportService.prototype.createReport.call(service, userId, {
      reportType: ReportType.OTHER,
      description: 'Test',
      reportImages: ['https://example.com/1.png'],
    });

    expect(result.isResponse).toBe(false);
    expect(result.responseDescription).toBeNull();
  });

  it('UT-107-05: Missing JWT.', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, ReportController.prototype.createReport);

    expect(guards).toHaveLength(2);
  });

  it('UT-107-06: ADMIN role forbidden by roles guard.', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, ReportController.prototype.createReport);

    expect(roles).toEqual([
      AccountRole.PATIENT,
      AccountRole.CLINIC_STAFF,
      AccountRole.CLINIC_ADMIN,
      AccountRole.CLINIC_MANAGER,
      AccountRole.DOCTOR,
    ]);
    expect(roles).not.toContain(AccountRole.ADMIN);
  });

  it('UT-107-07: reportType missing/invalid enum.', async () => {
    const missingMessages = await collectMessages({ description: 'ok', reportImages: [] });
    const invalidMessages = await collectMessages({ reportType: 'INVALID', description: 'ok', reportImages: [] } as any);

    expect(missingMessages).toContain('report_type is required');
    expect(invalidMessages).toContain('report_type must be a valid ReportType enum value');
  });

  it('UT-107-08: description missing/non-string.', async () => {
    const missingMessages = await collectMessages({ reportType: ReportType.BUG, reportImages: [] });
    const typeMessages = await collectMessages({ reportType: ReportType.BUG, description: 123, reportImages: [] } as any);

    expect(missingMessages).toContain('description is required');
    expect(typeMessages).toContain('description must be a string');
  });

  it('UT-107-09: reportImages non-array.', async () => {
    const messages = await collectMessages({ reportType: ReportType.BUG, description: 'ok', reportImages: 'x' as any });

    expect(messages).toContain('report_images must be an array');
  });

  it('UT-107-10: reportImages contains non-string item.', async () => {
    const messages = await collectMessages({ reportType: ReportType.BUG, description: 'ok', reportImages: ['ok', 1] as any });

    expect(messages).toContain('Each report_image must be a string');
  });

  it('UT-107-11: Repository save throws runtime error.', async () => {
    const service = {
      reportRepository: {
        createReport: jest.fn().mockImplementation((d: any) => d),
        saveReport: jest.fn().mockRejectedValue(new Error('db crash')),
      },
    } as any;

    await expect(
      ReportService.prototype.createReport.call(service, userId, {
        reportType: ReportType.BUG,
        description: 'boom',
        reportImages: [],
      }),
    ).rejects.toThrow('db crash');
  });

  it('UT-107-12: reportImages omitted accepted.', async () => {
    const messages = await collectMessages({ reportType: ReportType.BUG, description: 'ok' });

    expect(messages).toEqual([]);
  });

  it('UT-107-13: reportImages with single valid URL string item accepted.', async () => {
    const messages = await collectMessages({ reportType: ReportType.ABUSE, description: 'ok', reportImages: ['https://example.com/a.png'] });

    expect(messages).toEqual([]);
  });
});
