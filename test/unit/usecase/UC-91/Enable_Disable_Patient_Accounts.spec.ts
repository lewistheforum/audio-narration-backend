import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, ParseUUIDPipe } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { MESSAGES } from '../../../../src/common/message';
import { AccountsController } from '../../../../src/modules/accounts/accounts.controller';
import { AccountsService } from '../../../../src/modules/accounts/accounts.service';
import { BanAccountDto } from '../../../../src/modules/accounts/dto/ban-account.dto';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';
import { AccountStatus } from '../../../../src/modules/accounts/enums/account-status.enum';

describe('UC-91 Enable Disable Patient Accounts', () => {
  const accountId = '123e4567-e89b-42d3-a456-426614174060';

  const collectMessages = async (value: object) => {
    const errors = await validate(plainToInstance(BanAccountDto, value));
    return errors.flatMap((error) => Object.values(error.constraints ?? {}));
  };

  const createServiceContext = (options?: {
    account?: any;
    saveReject?: string;
  }) => ({
    findAccountEntityById: jest.fn().mockImplementation(async () => {
      if (options && 'account' in options) {
        if (!options.account) throw new NotFoundException(MESSAGES.failMessage.accountNotFound);
        return options.account;
      }

      return {
        _id: accountId,
        role: AccountRole.PATIENT,
        status: AccountStatus.ACTIVE,
        banCounts: 0,
        banDescription: null,
      };
    }),
    accountRepository: {
      saveAccount: jest.fn().mockImplementation(async (payload: any) => {
        if (options?.saveReject) throw new Error(options.saveReject);
        return payload;
      }),
    },
    findGeneralAccountByUserId: jest.fn().mockResolvedValue({ fullName: 'Patient One' }),
  }) as any;

  it('UT-91-01: Ban active patient successfully', async () => {
    const serviceContext = createServiceContext();

    const result = await AccountsService.prototype.banAccount.call(
      serviceContext,
      accountId,
      { reason: 'Valid reason for ban' },
      'admin-1',
    );

    expect(result.status).toBe(AccountStatus.BAN);
  });

  it('UT-91-02: Unban banned patient successfully', async () => {
    const serviceContext = createServiceContext({
      account: {
        _id: accountId,
        role: AccountRole.PATIENT,
        status: AccountStatus.BAN,
        banCounts: 2,
      },
    });

    const result = await AccountsService.prototype.unbanAccount.call(serviceContext, accountId);

    expect(result.status).toBe(AccountStatus.ACTIVE);
  });

  it('UT-91-03: Ban writes metadata fields', async () => {
    const serviceContext = createServiceContext();

    const result = await AccountsService.prototype.banAccount.call(
      serviceContext,
      accountId,
      { reason: 'Valid reason for ban' },
      'admin-1',
    );

    expect(result.banCounts).toBe(1);
    expect(result.banDescription).toBe('Valid reason for ban');
  });

  it('UT-91-04: Unban restores ACTIVE status', async () => {
    const serviceContext = createServiceContext({
      account: {
        _id: accountId,
        role: AccountRole.PATIENT,
        status: AccountStatus.BAN,
        banCounts: 4,
      },
    });

    const result = await AccountsService.prototype.unbanAccount.call(serviceContext, accountId);

    expect(result.status).toBe(AccountStatus.ACTIVE);
  });

  it('UT-91-05: Reject missing JWT', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, AccountsController.prototype.banAccount);

    expect(guards).toHaveLength(2);
  });

  it('UT-91-06: Reject non-admin role', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, AccountsController.prototype.banAccount);

    expect(roles).toEqual([AccountRole.ADMIN]);
  });

  it('UT-91-07: Reject invalid UUID', async () => {
    const pipe = new ParseUUIDPipe();

    await expect(pipe.transform('invalid_uuid', {} as any)).rejects.toThrow('Validation failed (uuid is expected)');
  });

  it('UT-91-08: Reject invalid reason payload', async () => {
    const messages = await collectMessages({ reason: 123 });
    const missingMessages = await collectMessages({});

    expect(messages).toContain('reason must be a string');
    expect(missingMessages).toContain('Ban reason is required');
  });

  it('UT-91-09: Reject ban target admin or self', async () => {
    const adminTargetContext = createServiceContext({
      account: { _id: accountId, role: AccountRole.ADMIN, status: AccountStatus.ACTIVE },
    });
    const selfTargetContext = createServiceContext({
      account: { _id: accountId, role: AccountRole.PATIENT, status: AccountStatus.ACTIVE },
    });

    await expect(
      AccountsService.prototype.banAccount.call(adminTargetContext, accountId, { reason: 'Valid reason for ban' }, 'admin-1'),
    ).rejects.toThrow(new ForbiddenException(MESSAGES.failMessage.cannotBanAdmin));

    await expect(
      AccountsService.prototype.banAccount.call(selfTargetContext, accountId, { reason: 'Valid reason for ban' }, accountId),
    ).rejects.toThrow(new ForbiddenException(MESSAGES.failMessage.cannotBanSelf));
  });

  it('UT-91-10: Reject invalid state or missing account', async () => {
    const missingContext = createServiceContext({ account: null });
    const activeContext = createServiceContext({
      account: { _id: accountId, role: AccountRole.PATIENT, status: AccountStatus.ACTIVE, banCounts: 0 },
    });
    const alreadyBannedContext = createServiceContext({
      account: { _id: accountId, role: AccountRole.PATIENT, status: AccountStatus.BAN, banCounts: 1 },
    });

    await expect(AccountsService.prototype.unbanAccount.call(missingContext, accountId)).rejects.toThrow(
      new NotFoundException(MESSAGES.failMessage.accountNotFound),
    );
    await expect(AccountsService.prototype.unbanAccount.call(activeContext, accountId)).rejects.toThrow(
      new BadRequestException(MESSAGES.failMessage.userNotBanned),
    );
    await expect(
      AccountsService.prototype.banAccount.call(alreadyBannedContext, accountId, { reason: 'Valid reason for ban' }, 'admin-1'),
    ).rejects.toThrow(new ConflictException(MESSAGES.failMessage.userAlreadyBanned));
  });

  it('UT-91-11: Reason min length boundary accepted', async () => {
    const messages = await collectMessages({ reason: '1234567890' });

    expect(messages).toEqual([]);
  });

  it('UT-91-12: Reason max length boundary accepted', async () => {
    const messages = await collectMessages({ reason: 'A'.repeat(500) });

    expect(messages).toEqual([]);
  });
});
