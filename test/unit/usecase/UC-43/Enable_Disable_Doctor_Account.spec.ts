import { ForbiddenException, NotFoundException, ParseUUIDPipe } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { BanManagedAccountDto } from '../../../../src/modules/accounts/api-clinic-manager/dto/ban-managed-account.dto';
import { ManagedAccountsController } from '../../../../src/modules/accounts/api-clinic-manager/managed-accounts.controller';
import { ManagedAccountsService } from '../../../../src/modules/accounts/api-clinic-manager/managed-accounts.service';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';
import { AccountStatus } from '../../../../src/modules/accounts/enums/account-status.enum';
import { BanType } from '../../../../src/modules/accounts/enums/ban-type.enum';

describe('UC-43 Enable / Disable Doctor Account', () => {
  const createAccount = (overrides: Record<string, any> = {}) => ({
    _id: 'doctor-1',
    email: 'doctor@example.com',
    username: 'doctor.one',
    parentId: 'manager-1',
    banCounts: 0,
    banDescription: null,
    status: AccountStatus.ACTIVE,
    generalAccount: { fullName: 'Dr. John Smith' },
    ...overrides,
  });

  const createContext = (account: any) => ({
    findAndVerifyAccount: jest.fn().mockResolvedValue(account),
    accountRepository: {
      save: jest.fn().mockImplementation(async (value) => value),
      findOne: jest.fn().mockResolvedValue(account),
    },
    banHistoryRepository: {
      create: jest.fn().mockImplementation((value) => value),
      save: jest.fn().mockImplementation(async (value) => value),
    },
    mailerService: {
      sendAccountWarningEmail: jest.fn(),
      sendAccountBannedEmail: jest.fn(),
      sendAccountUnbannedEmail: jest.fn(),
    },
  } as any);

  it('UT-43-01: Issue warning successfully when strikes remain below ban threshold.', async () => {
    const serviceContext = createContext(createAccount({ banCounts: 1 }));

    const result = await ManagedAccountsService.prototype.banAccount.call(
      serviceContext,
      'manager-1',
      'doctor-1',
      'Violation of clinic policies',
    );

    expect(result).toEqual({
      message: 'Warning issued to account',
      accountId: 'doctor-1',
      banCounts: 2,
      status: AccountStatus.ACTIVE,
    });
  });

  it('UT-43-02: Ban account successfully on third strike.', async () => {
    const serviceContext = createContext(createAccount({ banCounts: 2 }));

    const result = await ManagedAccountsService.prototype.banAccount.call(
      serviceContext,
      'manager-1',
      'doctor-1',
      'Violation of clinic policies',
    );

    expect(result).toEqual({
      message: 'Account banned',
      accountId: 'doctor-1',
      banCounts: 3,
      status: AccountStatus.BAN,
    });
    expect(serviceContext.banHistoryRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: BanType.BANNED }),
    );
  });

  it('UT-43-03: Unban banned account successfully.', async () => {
    const serviceContext = createContext(
      createAccount({ banCounts: 3, status: AccountStatus.BAN, banDescription: 'Violation' }),
    );

    const result = await ManagedAccountsService.prototype.unbanAccount.call(
      serviceContext,
      'manager-1',
      'doctor-1',
    );

    expect(result).toEqual({
      message: 'Account unbanned successfully',
      accountId: 'doctor-1',
      status: AccountStatus.ACTIVE,
    });
  });

  it('UT-43-04: Reject missing or invalid JWT.', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, ManagedAccountsController);

    expect(guards).toHaveLength(2);
  });

  it('UT-43-05: Reject authenticated non-manager role.', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, ManagedAccountsController);

    expect(roles).toEqual([AccountRole.CLINIC_MANAGER]);
  });

  it('UT-43-06: Reject missing managed account or foreign ownership.', async () => {
    const missingContext = {
      accountRepository: {
        findOne: jest.fn().mockResolvedValue(null),
      },
    } as any;
    const foreignContext = {
      accountRepository: {
        findOne: jest.fn().mockResolvedValue(createAccount({ parentId: 'manager-2' })),
      },
    } as any;

    await expect(
      (ManagedAccountsService.prototype as any).findAndVerifyAccount.call(
        missingContext,
        'manager-1',
        'non_existent_id',
      ),
    ).rejects.toThrow(new NotFoundException('Managed account with ID non_existent_id not found.'));
    await expect(
      (ManagedAccountsService.prototype as any).findAndVerifyAccount.call(
        foreignContext,
        'manager-1',
        'doctor_id_from_different_branch',
      ),
    ).rejects.toThrow(
      new ForbiddenException('You do not have permission to manage this account.'),
    );
  });

  it('UT-43-07: Unban already active account returns success without status change.', async () => {
    const serviceContext = createContext(createAccount({ status: AccountStatus.ACTIVE, banCounts: 1 }));

    const result = await ManagedAccountsService.prototype.unbanAccount.call(
      serviceContext,
      'manager-1',
      'doctor-1',
    );

    expect(result).toEqual({
      message: 'Account unbanned successfully',
      accountId: 'doctor-1',
      status: AccountStatus.ACTIVE,
    });
    expect(serviceContext.mailerService.sendAccountUnbannedEmail).not.toHaveBeenCalled();
  });

  it('UT-43-08: Reject invalid UUID or description type.', async () => {
    const dtoErrors = await validate(plainToInstance(BanManagedAccountDto, { description: 123 }));
    const messages = dtoErrors.flatMap((error) => Object.values(error.constraints ?? {}));
    const pipe = new ParseUUIDPipe();

    expect(messages).toContain('description must be a string');
    await expect(pipe.transform('invalid_format_id', {} as any)).rejects.toThrow(
      'Validation failed (uuid is expected)',
    );
  });
});
