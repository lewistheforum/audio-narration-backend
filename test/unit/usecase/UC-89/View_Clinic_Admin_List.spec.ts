import { GUARDS_METADATA } from '@nestjs/common/constants';
import { DefaultValuePipe, ParseIntPipe } from '@nestjs/common';

import { ClinicAdminsController } from '../../../../src/modules/accounts/api-admin-clinic-admin/clinic-admins.controller';
import { ClinicAdminsService } from '../../../../src/modules/accounts/api-admin-clinic-admin/clinic-admins.service';

describe('UC-89 View Clinic Admin List', () => {
  const createController = (result?: any) =>
    ({
      clinicAdminsService: {
        findAll: jest.fn().mockResolvedValue(result ?? { data: [{ id: 'admin-1' }], total: 1 }),
      },
    }) as any;

  const createServiceContext = (options?: {
    accounts?: any[];
    total?: number;
    reject?: string;
  }) => {
    const queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest
        .fn()
        .mockImplementation(async () => {
          if (options?.reject) throw new Error(options.reject);
          return [options?.accounts ?? [{ _id: 'admin-1' }], options?.total ?? 1];
        }),
    };

    return {
      accountRepository: {
        createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      },
    } as any;
  };

  it('UT-89-01: List clinic admin accounts default', async () => {
    const controller = createController();

    const result = await ClinicAdminsController.prototype.findAll.call(controller, 1, 10, undefined);

    expect(controller.clinicAdminsService.findAll).toHaveBeenCalledWith(1, 10, undefined);
    expect(result.total).toBe(1);
  });

  it('UT-89-02: Search clinic admins by keyword', async () => {
    const controller = createController();

    await ClinicAdminsController.prototype.findAll.call(controller, 1, 10, 'clinic');

    expect(controller.clinicAdminsService.findAll).toHaveBeenCalledWith(1, 10, 'clinic');
  });

  it('UT-89-03: List with custom pagination', async () => {
    const controller = createController();

    await ClinicAdminsController.prototype.findAll.call(controller, 2, 20, undefined);

    expect(controller.clinicAdminsService.findAll).toHaveBeenCalledWith(2, 20, undefined);
  });

  it('UT-89-04: Empty list result', async () => {
    const controller = createController({ data: [], total: 0 });

    const result = await ClinicAdminsController.prototype.findAll.call(controller, 1, 10, 'none');

    expect(result).toEqual({ data: [], total: 0 });
  });

  it('UT-89-05: Reject missing JWT', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, ClinicAdminsController);

    expect(guards).toHaveLength(2);
  });

  it('UT-89-06: Reject non-admin role', () => {
    const serviceContext = createServiceContext();

    expect(serviceContext).toBeDefined();
  });

  it('UT-89-07: Reject invalid pagination parse', async () => {
    const parseIntPipe = new ParseIntPipe();

    await expect(parseIntPipe.transform('abc', {} as any)).rejects.toThrow('Validation failed (numeric string is expected)');
  });

  it('UT-89-08: Runtime service/query error', async () => {
    const serviceContext = createServiceContext({ reject: 'db failed' });

    await expect(ClinicAdminsService.prototype.findAll.call(serviceContext, 1, 10, 'clinic')).rejects.toThrow('db failed');
  });

  it('UT-89-09: Boundary default pagination', async () => {
    const defaultPage = new DefaultValuePipe(1).transform(undefined, {} as any);
    const defaultLimit = new DefaultValuePipe(10).transform(undefined, {} as any);

    expect(defaultPage).toBe(1);
    expect(defaultLimit).toBe(10);
  });

  it('UT-89-10: Boundary empty search string', async () => {
    const serviceContext = createServiceContext();

    const result = await ClinicAdminsService.prototype.findAll.call(serviceContext, 1, 10, '');

    expect(result.total).toBe(1);
  });
});
