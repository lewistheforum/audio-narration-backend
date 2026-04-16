import { ForbiddenException, NotFoundException, ParseUUIDPipe } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';
import { AccountStatus } from '../../../../src/modules/accounts/enums/account-status.enum';
import { ManagedAccountsController } from '../../../../src/modules/accounts/api-clinic-manager/managed-accounts.controller';
import { ManagedAccountsService } from '../../../../src/modules/accounts/api-clinic-manager/managed-accounts.service';
import { BanManagedAccountDto } from '../../../../src/modules/accounts/api-clinic-manager/dto/ban-managed-account.dto';

describe('UC-54 Enable Disable Staff Account', () => {
  const collectMessages = async (dto: object) => {
    const errors = await validate(plainToInstance(BanManagedAccountDto, dto));
    return errors.flatMap((error) => Object.values(error.constraints ?? {}));
  };

  const createServiceContext = ({
    status = AccountStatus.ACTIVE,
    banCounts = 0,
    parentId = 'manager-1',
    saveThrows = false,
  }: {
    status?: AccountStatus;
    banCounts?: number;
    parentId?: string;
    saveThrows?: boolean;
  } = {}) => {
    const account = {
      _id: 'staff-1',
      parentId,
      role: AccountRole.CLINIC_STAFF,
      status,
      banCounts,
      banDescription: null,
      email: 'staff@clinic.com',
      username: 'staff1',
      generalAccount: { fullName: 'Staff One' },
    } as any;

    const serviceContext = {
      findAndVerifyAccount: ManagedAccountsService.prototype['findAndVerifyAccount'],
      accountRepository: {
        findOne: jest.fn().mockResolvedValue(account),
        save: jest.fn().mockImplementation(async (entity) => {
          if (saveThrows) {
            throw new Error('db failed');
          }
          return entity;
        }),
      },
      banHistoryRepository: {
        create: jest.fn().mockImplementation((payload) => payload),
        save: jest.fn().mockImplementation(async (payload) => payload),
      },
      mailerService: {
        sendAccountWarningEmail: jest.fn().mockResolvedValue(undefined),
        sendAccountBannedEmail: jest.fn().mockResolvedValue(undefined),
        sendAccountUnbannedEmail: jest.fn().mockResolvedValue(undefined),
      },
    } as any;

    return { serviceContext, account };
  };

  it('UT-54-01: Ban staff with warning path.', async () => {
    const { serviceContext } = createServiceContext({ banCounts: 1 });

    const result = await ManagedAccountsService.prototype.banAccount.call(
      serviceContext,
      'manager-1',
      'staff-1',
      'Violation of clinic policies',
    );

    expect(result.message).toBe('Warning issued to account');
    expect(result.banCounts).toBe(2);
  });

  it('UT-54-02: Ban staff to BAN status when threshold is reached.', async () => {
    const { serviceContext } = createServiceContext({ banCounts: 2 });

    const result = await ManagedAccountsService.prototype.banAccount.call(
      serviceContext,
      'manager-1',
      'staff-1',
      'Violation of clinic policies',
    );

    expect(result.message).toBe('Account banned');
    expect(result.status).toBe(AccountStatus.BAN);
  });

  it('UT-54-03: Unban banned staff account.', async () => {
    const { serviceContext } = createServiceContext({ status: AccountStatus.BAN, banCounts: 3 });

    const result = await ManagedAccountsService.prototype.unbanAccount.call(
      serviceContext,
      'manager-1',
      'staff-1',
    );

    expect(result.message).toBe('Account unbanned successfully');
    expect(result.status).toBe(AccountStatus.ACTIVE);
  });

  it('UT-54-04: Unban endpoint on non-banned account.', async () => {
    const { serviceContext } = createServiceContext({ status: AccountStatus.ACTIVE, banCounts: 1 });

    const result = await ManagedAccountsService.prototype.unbanAccount.call(
      serviceContext,
      'manager-1',
      'staff-1',
    );

    expect(result.message).toBe('Account unbanned successfully');
    expect(result.status).toBe(AccountStatus.ACTIVE);
  });

  it('UT-54-05: Reject request without JWT.', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, ManagedAccountsController);

    expect(guards).toHaveLength(2);
  });

  it('UT-54-06: Reject non-manager role.', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, ManagedAccountsController);

    expect(roles).toEqual([AccountRole.CLINIC_MANAGER]);
  });

  it('UT-54-07: Reject invalid UUID path param.', async () => {
    const pipe = new ParseUUIDPipe();

    await expect(pipe.transform('invalid_uuid', {} as any)).rejects.toThrow(
      'Validation failed (uuid is expected)',
    );
  });

  it('UT-54-08: Reject invalid ban description type.', async () => {
    const messages = await collectMessages({ description: 123 });

    expect(messages).toContain('description must be a string');
  });

  it('UT-54-09: Reject when target staff not found.', async () => {
    const { serviceContext } = createServiceContext();
    serviceContext.accountRepository.findOne.mockResolvedValue(null);

    await expect(
      ManagedAccountsService.prototype.banAccount.call(
        serviceContext,
        'manager-1',
        'non-existing-id',
        'Violation of clinic policies',
      ),
    ).rejects.toThrow(new NotFoundException('Managed account with ID non-existing-id not found.'));
  });

  it('UT-54-10: Reject when manager does not own target staff.', async () => {
    const { serviceContext } = createServiceContext({ parentId: 'another-manager' });

    await expect(
      ManagedAccountsService.prototype.banAccount.call(
        serviceContext,
        'manager-1',
        'staff-1',
        'Violation of clinic policies',
      ),
    ).rejects.toThrow(new ForbiddenException('You do not have permission to manage this account.'));
  });

  it('UT-54-11: Return 500 when repository save fails.', async () => {
    const { serviceContext } = createServiceContext({ saveThrows: true });

    await expect(
      ManagedAccountsService.prototype.banAccount.call(
        serviceContext,
        'manager-1',
        'staff-1',
        'Violation of clinic policies',
      ),
    ).rejects.toThrow('db failed');
  });

  it('UT-54-12: Boundary at exactly 3 warnings transitions to BAN.', async () => {
    const { serviceContext } = createServiceContext({ banCounts: 2 });

    const result = await ManagedAccountsService.prototype.banAccount.call(
      serviceContext,
      'manager-1',
      'staff-1',
      'Violation of clinic policies',
    );

    expect(result.banCounts).toBe(3);
    expect(result.message).toBe('Account banned');
  });

  it('UT-54-13: Boundary optional description omitted in ban flow.', async () => {
    const { serviceContext } = createServiceContext({ banCounts: 1 });

    const result = await ManagedAccountsService.prototype.banAccount.call(
      serviceContext,
      'manager-1',
      'staff-1',
      undefined,
    );

    expect(result.message).toBe('Warning issued to account');
    expect(serviceContext.mailerService.sendAccountWarningEmail).toHaveBeenCalledWith(
      'staff@clinic.com',
      'Staff One',
      'Violation of clinic policies.',
      2,
    );
  });
});
