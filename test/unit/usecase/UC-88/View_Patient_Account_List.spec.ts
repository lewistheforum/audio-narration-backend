import { BadRequestException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';
import { AccountsController } from '../../../../src/modules/accounts/accounts.controller';
import { AccountsService } from '../../../../src/modules/accounts/accounts.service';
import { SearchPatientQueryDto } from '../../../../src/modules/accounts/dto/search-patient-query.dto';

describe('UC-88 View Patient Account List', () => {
  const collectMessages = async (value: object) => {
    const errors = await validate(plainToInstance(SearchPatientQueryDto, value));
    return errors.flatMap((error) => Object.values(error.constraints ?? {}));
  };

  const createController = (data?: any) =>
    ({
      accountsService: {
        searchPatientByPhone: jest.fn().mockResolvedValue(data ?? { found: true, patient: { accountId: 'patient-1' } }),
      },
    }) as any;

  const createServiceContext = (options?: {
    account?: any;
    accountRole?: AccountRole;
    generalAccount?: any;
    address?: any;
    throwOnFind?: string;
  }) => ({
    accountRepository: {
      findByPhone: jest.fn().mockImplementation(async () => {
        if (options?.throwOnFind) throw new Error(options.throwOnFind);
        return options && 'account' in options
          ? options.account
          : {
              _id: 'patient-1',
              role: options?.accountRole ?? AccountRole.PATIENT,
              email: 'patient@example.com',
              phone: '0912345678',
              createdAt: new Date('2026-01-01T00:00:00.000Z'),
            };
      }),
      findByEmail: jest.fn().mockResolvedValue(options?.account ?? null),
      findAccountById: jest.fn().mockResolvedValue(options?.account ?? null),
    },
    generalAccountRepository: {
      findByFullNameFuzzy: jest.fn().mockResolvedValue({ accountId: 'patient-1' }),
      findByAccountId: jest.fn().mockResolvedValue(
        options?.generalAccount ?? {
          fullName: 'Patient One',
          dob: new Date('2000-01-01T00:00:00.000Z'),
          gender: 'MALE',
        },
      ),
    },
    addressRepository: {
      findByAccountId: jest.fn().mockResolvedValue(
        options?.address ?? {
          address: '123 Street',
          wardName: 'Ward',
          districtName: 'District',
          provinceName: 'Province',
        },
      ),
    },
  }) as any;

  it('UT-88-01: Search patient by phone', async () => {
    const controller = createController();

    const result = await AccountsController.prototype.searchPatient.call(controller, { phone: '0912345678' });

    expect(result.message).toBe('Patient search completed');
  });

  it('UT-88-02: Search patient by email', async () => {
    const controller = createController();

    const result = await AccountsController.prototype.searchPatient.call(controller, { email: 'patient@example.com' });

    expect(result.message).toBe('Patient search completed');
  });

  it('UT-88-03: Search patient by full name', async () => {
    const controller = createController();

    const result = await AccountsController.prototype.searchPatient.call(controller, { fullName: 'Patient One' });

    expect(result.message).toBe('Patient search completed');
  });

  it('UT-88-04: Search no-match returns empty list', async () => {
    const controller = createController({ found: false, message: 'Patient not found with the provided information', suggestedAction: 'CREATE_NEW_ACCOUNT' });

    const result = await AccountsController.prototype.searchPatient.call(controller, { phone: '0912345678' });

    expect(result.data.found).toBe(false);
  });

  it('UT-88-05: Reject missing JWT', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, AccountsController.prototype.searchPatient);

    expect(guards).toHaveLength(2);
  });

  it('UT-88-06: Reject non-staff role', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, AccountsController.prototype.searchPatient);

    expect(roles).toEqual([AccountRole.CLINIC_STAFF]);
  });

  it('UT-88-07: Reject invalid phone format', async () => {
    const messages = await collectMessages({ phone: '12345' });

    expect(messages).toContain('Phone must be exactly 10 digits and start with 0');
  });

  it('UT-88-08: Reject invalid fullName constraints', async () => {
    const messages = await collectMessages({ fullName: 'A' });

    expect(messages).toContain('Full name must be between 2 and 100 characters');
  });

  it('UT-88-09: Handle runtime search error', async () => {
    const serviceContext = createServiceContext({ throwOnFind: 'db failed' });

    await expect(AccountsService.prototype.searchPatientByPhone.call(serviceContext, { phone: '0912345678' })).rejects.toThrow('db failed');
  });

  it('UT-88-10: Boundary fullName length min 2', async () => {
    const messages = await collectMessages({ fullName: 'Ab' });

    expect(messages).toEqual([]);
  });

  it('UT-88-11: Boundary fullName length max 100', async () => {
    const messages = await collectMessages({ fullName: 'A'.repeat(100) });

    expect(messages).toEqual([]);
  });
});
