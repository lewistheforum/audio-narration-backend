import { NotFoundException, ParseUUIDPipe } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';

import { ClinicAdminsController } from '../../../../src/modules/accounts/api-admin-clinic-admin/clinic-admins.controller';
import { ClinicAdminsService } from '../../../../src/modules/accounts/api-admin-clinic-admin/clinic-admins.service';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';
import { BanType } from '../../../../src/modules/accounts/enums/ban-type.enum';

describe('UC-99 View Ban Unban History', () => {
  const adminId = '123e4567-e89b-42d3-a456-426614174008';

  const createServiceContext = (opts?: { account?: any; histories?: any[]; reject?: string }) => ({
    accountRepository: {
      findOne: jest.fn().mockResolvedValue(
        opts && 'account' in opts ? opts.account : { _id: adminId, role: AccountRole.CLINIC_ADMIN },
      ),
    },
    banHistoryRepository: {
      find: jest.fn().mockImplementation(async () => {
        if (opts?.reject) {
          throw new Error(opts.reject);
        }
        return opts?.histories ?? [
          { _id: 'h2', accountId: adminId, type: BanType.UNBANNED, createdAt: new Date('2026-02-01') },
          { _id: 'h1', accountId: adminId, type: BanType.WARNING, createdAt: new Date('2026-01-01') },
        ];
      }),
    },
  }) as any;

  it('UT-99-01: Fetch ban/unban history with records.', async () => {
    const context = createServiceContext();

    const result = await ClinicAdminsService.prototype.getBanHistory.call(context, adminId);

    expect(result).toHaveLength(2);
  });

  it('UT-99-02: Fetch history sorted by createdAt DESC.', async () => {
    const context = createServiceContext();

    await ClinicAdminsService.prototype.getBanHistory.call(context, adminId);

    expect(context.banHistoryRepository.find).toHaveBeenCalledWith({
      where: { accountId: adminId },
      order: { createdAt: 'DESC' },
    });
  });

  it('UT-99-03: Fetch history when no records returns empty list.', async () => {
    const context = createServiceContext({ histories: [] });

    const result = await ClinicAdminsService.prototype.getBanHistory.call(context, adminId);

    expect(result).toEqual([]);
  });

  it('UT-99-04: Missing JWT.', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, ClinicAdminsController);

    expect(guards).toHaveLength(2);
  });

  it('UT-99-05: Invalid UUID format.', async () => {
    const pipe = new ParseUUIDPipe();

    await expect(pipe.transform('invalid_uuid', {} as any)).rejects.toThrow('Validation failed (uuid is expected)');
  });

  it('UT-99-06: Clinic admin not found.', async () => {
    const context = createServiceContext({ account: null });

    await expect(ClinicAdminsService.prototype.getBanHistory.call(context, adminId)).rejects.toThrow(
      new NotFoundException(`Clinic admin with ID ${adminId} not found.`),
    );
  });

  it('UT-99-07: Runtime repository failure.', async () => {
    const context = createServiceContext({ reject: 'db failed' });

    await expect(ClinicAdminsService.prototype.getBanHistory.call(context, adminId)).rejects.toThrow('db failed');
  });

  it('UT-99-08: Valid UUID minimal edge accepted.', async () => {
    const pipe = new ParseUUIDPipe();

    await expect(pipe.transform('123e4567-e89b-42d3-a456-426614174000', {} as any)).resolves.toBe(
      '123e4567-e89b-42d3-a456-426614174000',
    );
  });

  it('UT-99-09: Large history dataset still returns 200.', async () => {
    const histories = Array.from({ length: 300 }, (_, i) => ({ _id: `h-${i}`, accountId: adminId, type: BanType.WARNING }));
    const context = createServiceContext({ histories });

    const result = await ClinicAdminsService.prototype.getBanHistory.call(context, adminId);

    expect(result).toHaveLength(300);
  });
});
