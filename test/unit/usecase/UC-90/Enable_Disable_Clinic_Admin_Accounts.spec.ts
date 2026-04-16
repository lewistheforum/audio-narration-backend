import { NotFoundException, ParseUUIDPipe } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { BanClinicAdminDto } from '../../../../src/modules/accounts/api-admin-clinic-admin/dto/ban-clinic-admin.dto';
import { ClinicAdminsController } from '../../../../src/modules/accounts/api-admin-clinic-admin/clinic-admins.controller';
import { ClinicAdminsService } from '../../../../src/modules/accounts/api-admin-clinic-admin/clinic-admins.service';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';
import { AccountStatus } from '../../../../src/modules/accounts/enums/account-status.enum';

describe('UC-90 Enable Disable Clinic Admin Accounts', () => {
  const clinicAdminId = '123e4567-e89b-42d3-a456-426614174050';

  const collectMessages = async (value: object) => {
    const errors = await validate(plainToInstance(BanClinicAdminDto, value));
    return errors.flatMap((error) => Object.values(error.constraints ?? {}));
  };

  const createServiceContext = (options?: {
    account?: any;
    managerIds?: string[];
    gcIds?: string[];
    saveReject?: string;
  }) => {
    const account =
      options && 'account' in options
        ? options.account
        : {
            _id: clinicAdminId,
            role: AccountRole.CLINIC_ADMIN,
            email: 'admin@clinic.com',
            username: 'clinicadmin',
            status: AccountStatus.ACTIVE,
            banCounts: 1,
            banDescription: null,
            clinicAdminInformation: { clinicName: 'Clinic A' },
          };

    const queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        findOne: jest.fn().mockResolvedValue(account),
        find: jest
          .fn()
          .mockResolvedValue((options?.managerIds ?? ['m1']).map((_id) => ({ _id }))),
        save: jest.fn().mockImplementation(async (_entity: any, payload: any) => {
          if (options?.saveReject) throw new Error(options.saveReject);
          return payload;
        }),
        createQueryBuilder: jest
          .fn()
          .mockImplementation(() => ({
            select: jest.fn().mockReturnThis(),
            from: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            update: jest.fn().mockReturnThis(),
            set: jest.fn().mockReturnThis(),
            execute: jest.fn().mockResolvedValue({ affected: 2 }),
            getRawMany: jest
              .fn()
              .mockResolvedValue((options?.gcIds ?? ['d1', 's1']).map((_id) => ({ _id }))),
          })),
      },
    } as any;

    return {
      dataSource: { createQueryRunner: jest.fn().mockReturnValue(queryRunner) },
      banHistoryRepository: {
        create: jest.fn().mockImplementation((payload) => payload),
        save: jest.fn().mockResolvedValue(undefined),
      },
      mailerService: {
        sendClinicAdminWarningEmail: jest.fn().mockResolvedValue(undefined),
        sendClinicAdminBannedEmail: jest.fn().mockResolvedValue(undefined),
        sendClinicAdminUnbannedEmail: jest.fn().mockResolvedValue(undefined),
      },
    } as any;
  };

  it('UT-90-01: Ban warning path (`banCounts < 3`)', async () => {
    const serviceContext = createServiceContext({
      account: {
        _id: clinicAdminId,
        role: AccountRole.CLINIC_ADMIN,
        email: 'admin@clinic.com',
        username: 'clinicadmin',
        status: AccountStatus.ACTIVE,
        banCounts: 1,
        banDescription: null,
        clinicAdminInformation: { clinicName: 'Clinic A' },
      },
    });

    const result = await ClinicAdminsService.prototype.banClinicAdmin.call(serviceContext, clinicAdminId, 'Violation');

    expect(result.banCounts).toBe(2);
    expect(result.status).toBe(AccountStatus.ACTIVE);
  });

  it('UT-90-02: Ban threshold path (`banCounts >= 3`)', async () => {
    const serviceContext = createServiceContext({
      account: {
        _id: clinicAdminId,
        role: AccountRole.CLINIC_ADMIN,
        email: 'admin@clinic.com',
        username: 'clinicadmin',
        status: AccountStatus.ACTIVE,
        banCounts: 2,
        banDescription: null,
        clinicAdminInformation: { clinicName: 'Clinic A' },
      },
    });

    const result = await ClinicAdminsService.prototype.banClinicAdmin.call(serviceContext, clinicAdminId, 'Violation');

    expect(result.banCounts).toBe(3);
    expect(result.status).toBe(AccountStatus.BAN);
  });

  it('UT-90-03: Unban from BAN status', async () => {
    const serviceContext = createServiceContext({
      account: {
        _id: clinicAdminId,
        role: AccountRole.CLINIC_ADMIN,
        email: 'admin@clinic.com',
        username: 'clinicadmin',
        status: AccountStatus.BAN,
        banCounts: 3,
        banDescription: 'Violation',
        clinicAdminInformation: { clinicName: 'Clinic A' },
      },
    });

    const result = await ClinicAdminsService.prototype.unbanClinicAdmin.call(serviceContext, clinicAdminId);

    expect(result.status).toBe(AccountStatus.ACTIVE);
    expect(result.banCounts).toBe(0);
  });

  it('UT-90-04: Ban with no linked accounts', async () => {
    const serviceContext = createServiceContext({ managerIds: [], gcIds: [] });

    const result = await ClinicAdminsService.prototype.banClinicAdmin.call(serviceContext, clinicAdminId, 'Violation');

    expect(result).toBeDefined();
  });

  it('UT-90-05: Unban while account is ACTIVE', async () => {
    const serviceContext = createServiceContext({
      account: {
        _id: clinicAdminId,
        role: AccountRole.CLINIC_ADMIN,
        email: 'admin@clinic.com',
        username: 'clinicadmin',
        status: AccountStatus.ACTIVE,
        banCounts: 1,
        banDescription: 'warn',
        clinicAdminInformation: { clinicName: 'Clinic A' },
      },
    });

    const result = await ClinicAdminsService.prototype.unbanClinicAdmin.call(serviceContext, clinicAdminId);

    expect(result.status).toBe(AccountStatus.ACTIVE);
  });

  it('UT-90-06: Reject missing JWT', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, ClinicAdminsController);

    expect(guards).toHaveLength(2);
  });

  it('UT-90-07: Reject invalid UUID', async () => {
    const pipe = new ParseUUIDPipe();

    await expect(pipe.transform('invalid_uuid', {} as any)).rejects.toThrow('Validation failed (uuid is expected)');
  });

  it('UT-90-08: Reject invalid description type', async () => {
    const messages = await collectMessages({ description: 123 });

    expect(messages).toContain('description must be a string');
  });

  it('UT-90-09: Ban non-existing clinic admin', async () => {
    const serviceContext = createServiceContext({ account: null });

    await expect(ClinicAdminsService.prototype.banClinicAdmin.call(serviceContext, clinicAdminId, 'Violation')).rejects.toThrow(
      new NotFoundException(`Clinic admin with ID ${clinicAdminId} not found.`),
    );
  });

  it('UT-90-10: Unban non-existing clinic admin', async () => {
    const serviceContext = createServiceContext({ account: null });

    await expect(ClinicAdminsService.prototype.unbanClinicAdmin.call(serviceContext, clinicAdminId)).rejects.toThrow(
      new NotFoundException(`Clinic admin with ID ${clinicAdminId} not found.`),
    );
  });

  it('UT-90-11: Handle runtime transaction/repository error', async () => {
    const serviceContext = createServiceContext({ saveReject: 'db failed' });

    await expect(ClinicAdminsService.prototype.banClinicAdmin.call(serviceContext, clinicAdminId, 'Violation')).rejects.toThrow('db failed');
  });

  it('UT-90-12: Strike boundary at count 2 -> 3', async () => {
    const serviceContext = createServiceContext({
      account: {
        _id: clinicAdminId,
        role: AccountRole.CLINIC_ADMIN,
        email: 'admin@clinic.com',
        username: 'clinicadmin',
        status: AccountStatus.ACTIVE,
        banCounts: 2,
        banDescription: null,
        clinicAdminInformation: { clinicName: 'Clinic A' },
      },
    });

    const result = await ClinicAdminsService.prototype.banClinicAdmin.call(serviceContext, clinicAdminId, 'Violation');

    expect(result.banCounts).toBe(3);
    expect(result.status).toBe(AccountStatus.BAN);
  });

  it('UT-90-13: Optional description omitted on ban', async () => {
    const serviceContext = createServiceContext();

    const result = await ClinicAdminsService.prototype.banClinicAdmin.call(serviceContext, clinicAdminId, undefined);

    expect(result).toBeDefined();
  });

  it('UT-90-14: Minimal unban payload with valid UUID', async () => {
    const serviceContext = createServiceContext({
      account: {
        _id: clinicAdminId,
        role: AccountRole.CLINIC_ADMIN,
        email: 'admin@clinic.com',
        username: 'clinicadmin',
        status: AccountStatus.BAN,
        banCounts: 3,
        banDescription: 'Violation',
        clinicAdminInformation: { clinicName: 'Clinic A' },
      },
      managerIds: [],
      gcIds: [],
    });

    const result = await ClinicAdminsService.prototype.unbanClinicAdmin.call(serviceContext, clinicAdminId);

    expect(result.status).toBe(AccountStatus.ACTIVE);
  });
});
