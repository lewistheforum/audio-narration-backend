import {
  ConflictException,
  ParseUUIDPipe,
  UnauthorizedException,
} from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { AccountsController } from '../../../../src/modules/accounts/accounts.controller';
import { AccountsService } from '../../../../src/modules/accounts/accounts.service';
import { UpdatePasswordDto } from '../../../../src/modules/accounts/dto/update-password.dto';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';
import { AccountRepository } from '../../../../src/modules/accounts/repositories/account.repository';
import { AddressRepository } from '../../../../src/modules/accounts/repositories/address.repository';
import { ClinicAdminInformationRepository } from '../../../../src/modules/accounts/repositories/clinic-admin-information.repository';
import { ClinicManagerInformationRepository } from '../../../../src/modules/accounts/repositories/clinic-manager-information.repository';
import { ClinicStaffInformationRepository } from '../../../../src/modules/accounts/repositories/clinic-staff-information.repository';
import { ClinicsLegalDocumentsRepository } from '../../../../src/modules/accounts/repositories/clinics-legal-documents.repository';
import { CodeVerificationRepository } from '../../../../src/modules/accounts/repositories/code-verification.repository';
import { DoctorInformationRepository } from '../../../../src/modules/accounts/repositories/doctor-information.repository';
import { GeneralAccountRepository } from '../../../../src/modules/accounts/repositories/general-account.repository';
import { GoogleIframeRepository } from '../../../../src/modules/accounts/repositories/google-iframe.repository';
import { ZaloWebhookService } from '../../../../src/modules/accounts/zalo-webhook.service';
import { JwtAuthGuard } from '../../../../src/modules/auth/jwt.strategy';
import { ContractPackageRepository } from '../../../../src/modules/contracts/repositories/contract-package.repository';
import { MailerService } from '../../../../src/modules/mailer/mailer.service';
import { ClinicSubscriptionHistoryRepository } from '../../../../src/modules/subscriptions/repositories/clinic-subscription-history.repository';
import { ClinicSubscriptionRepository } from '../../../../src/modules/subscriptions/repositories/clinic-subscription.repository';
import { SubscriptionServiceRepository } from '../../../../src/modules/subscriptions/repositories/subscription-service.repository';
import { TransactionRepository } from '../../../../src/modules/transactions/repositories/transaction.repository';
import { RolesGuard } from '../../../../src/common/guards/roles.guard';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

describe('UC-05 Change Password', () => {
  let controller: AccountsController;
  let service: AccountsService;
  let accountRepository: {
    findAccountById: jest.Mock;
    saveAccount: jest.Mock;
  };

  const mockedBcryptCompare = bcrypt.compare as jest.MockedFunction<
    typeof bcrypt.compare
  >;
  const mockedBcryptHash = bcrypt.hash as jest.MockedFunction<typeof bcrypt.hash>;

  const validId = '11111111-1111-4111-8111-111111111111';
  const missingId = '22222222-2222-4222-8222-222222222222';
  const validOldPassword = 'OldPass123';
  const validNewPassword = 'NewPass456';

  const createAccount = (overrides: Record<string, any> = {}) => ({
    _id: validId,
    password: '$2b$10$existing-hash',
    role: AccountRole.PATIENT,
    ...overrides,
  });

  const validateDto = async (payload: Record<string, any>) =>
    validate(plainToInstance(UpdatePasswordDto, payload));

  const expectValidationMessage = async (
    payload: Record<string, any>,
    message: string,
  ) => {
    const errors = await validateDto(payload);
    const messages = errors.flatMap((error) =>
      Object.values(error.constraints ?? {}),
    );

    expect(messages).toContain(message);
  };

  beforeEach(async () => {
    accountRepository = {
      findAccountById: jest.fn(),
      saveAccount: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AccountsController],
      providers: [
        AccountsService,
        { provide: AccountRepository, useValue: accountRepository },
        { provide: GeneralAccountRepository, useValue: {} },
        { provide: CodeVerificationRepository, useValue: {} },
        { provide: DataSource, useValue: {} },
        { provide: ClinicManagerInformationRepository, useValue: {} },
        { provide: ClinicStaffInformationRepository, useValue: {} },
        { provide: DoctorInformationRepository, useValue: {} },
        { provide: ClinicAdminInformationRepository, useValue: {} },
        { provide: AddressRepository, useValue: {} },
        { provide: GoogleIframeRepository, useValue: {} },
        { provide: ClinicSubscriptionRepository, useValue: {} },
        { provide: ClinicSubscriptionHistoryRepository, useValue: {} },
        { provide: SubscriptionServiceRepository, useValue: {} },
        { provide: MailerService, useValue: {} },
        { provide: ClinicsLegalDocumentsRepository, useValue: {} },
        { provide: TransactionRepository, useValue: {} },
        { provide: ZaloWebhookService, useValue: {} },
        { provide: ContractPackageRepository, useValue: {} },
      ],
    }).compile();

    controller = module.get(AccountsController);
    service = module.get(AccountsService);
    mockedBcryptCompare.mockReset();
    mockedBcryptCompare.mockResolvedValue(true as never);
    mockedBcryptHash.mockReset();
    mockedBcryptHash.mockResolvedValue('new-hash' as never);
  });

  it('UT-05-01: Change password successfully.', async () => {
    accountRepository.findAccountById.mockResolvedValue(createAccount());

    const result = await controller.updatePassword(validId, {
      oldPassword: validOldPassword,
      newPassword: validNewPassword,
    });

    expect(result).toBeUndefined();
    expect(accountRepository.saveAccount).toHaveBeenCalledWith(
      expect.objectContaining({ password: 'new-hash' }),
    );
  });

  it('UT-05-02: Reject unauthenticated or invalid JWT access.', () => {
    const guards =
      Reflect.getMetadata(GUARDS_METADATA, AccountsController.prototype.updatePassword) ?? [];
    const roles =
      Reflect.getMetadata(ROLES_KEY, AccountsController.prototype.updatePassword) ?? [];

    expect(guards).toEqual(expect.arrayContaining([JwtAuthGuard, RolesGuard]));
    expect(roles).toEqual(
      expect.arrayContaining([
        AccountRole.ADMIN,
        AccountRole.PATIENT,
        AccountRole.DOCTOR,
        AccountRole.CLINIC_STAFF,
        AccountRole.CLINIC_ADMIN,
        AccountRole.CLINIC_MANAGER,
      ]),
    );
  });

  it('UT-05-03: Reject invalid UUID path parameter.', async () => {
    const pipe = new ParseUUIDPipe();

    await expect(
      pipe.transform('not-a-uuid', {
        type: 'param',
        metatype: String,
        data: 'id',
      }),
    ).rejects.toThrow('Validation failed (uuid is expected)');
  });

  it('UT-05-04: Reject valid UUID for non-existent account.', async () => {
    accountRepository.findAccountById.mockResolvedValue(null);

    await expect(
      service.updatePassword(missingId, {
        oldPassword: validOldPassword,
        newPassword: validNewPassword,
      }),
    ).rejects.toThrow('User not found');
  });

  it('UT-05-05: Reject empty old password.', async () => {
    await expectValidationMessage(
      { oldPassword: '', newPassword: validNewPassword },
      'Old password is required',
    );
  });

  it('UT-05-06: Reject non-string old password.', async () => {
    await expectValidationMessage(
      { oldPassword: 123456, newPassword: validNewPassword },
      'oldPassword must be a string',
    );
  });

  it('UT-05-07: Reject old password shorter than 6.', async () => {
    await expectValidationMessage(
      { oldPassword: 'Abc12', newPassword: validNewPassword },
      'Password must be at least 6 characters',
    );
  });

  it('UT-05-08: Reject old password longer than 50.', async () => {
    await expectValidationMessage(
      { oldPassword: 'A'.repeat(51), newPassword: validNewPassword },
      'Password must not exceed 50 characters',
    );
  });

  it('UT-05-09: Reject incorrect current password.', async () => {
    accountRepository.findAccountById.mockResolvedValue(createAccount());
    mockedBcryptCompare.mockResolvedValue(false as never);

    await expect(
      service.updatePassword(validId, {
        oldPassword: 'WrongPass123',
        newPassword: validNewPassword,
      }),
    ).rejects.toThrow(UnauthorizedException);
    await expect(
      service.updatePassword(validId, {
        oldPassword: 'WrongPass123',
        newPassword: validNewPassword,
      }),
    ).rejects.toThrow('Incorrect current password');
  });

  it('UT-05-10: Reject empty new password.', async () => {
    await expectValidationMessage(
      { oldPassword: validOldPassword, newPassword: '' },
      'New password is required',
    );
  });

  it('UT-05-11: Reject non-string new password.', async () => {
    await expectValidationMessage(
      { oldPassword: validOldPassword, newPassword: 123456 },
      'newPassword must be a string',
    );
  });

  it('UT-05-12: Reject new password shorter than 6.', async () => {
    await expectValidationMessage(
      { oldPassword: validOldPassword, newPassword: 'Abc12' },
      'New password must be at least 6 characters',
    );
  });

  it('UT-05-13: Reject new password longer than 50.', async () => {
    await expectValidationMessage(
      { oldPassword: validOldPassword, newPassword: 'A'.repeat(51) },
      'New password must not exceed 50 characters',
    );
  });

  it('UT-05-14: Reject new password without both letter and number.', async () => {
    await expectValidationMessage(
      { oldPassword: validOldPassword, newPassword: 'Onlyletters' },
      'New password must contain at least one letter and one number',
    );
  });

  it('UT-05-15: Reject new password equal to old password.', async () => {
    accountRepository.findAccountById.mockResolvedValue(createAccount());

    await expect(
      service.updatePassword(validId, {
        oldPassword: validOldPassword,
        newPassword: validOldPassword,
      }),
    ).rejects.toThrow(ConflictException);
    await expect(
      service.updatePassword(validId, {
        oldPassword: validOldPassword,
        newPassword: validOldPassword,
      }),
    ).rejects.toThrow('New password cannot be the same as the old password');
  });

  it('UT-05-16: Accept new password at length 6.', async () => {
    accountRepository.findAccountById.mockResolvedValue(createAccount());

    await service.updatePassword(validId, {
      oldPassword: validOldPassword,
      newPassword: 'Abc123',
    });

    expect(mockedBcryptHash).toHaveBeenCalledWith('Abc123', 10);
  });

  it('UT-05-17: Accept new password at length 50.', async () => {
    const fiftyCharacterPassword = 'Aa1'.repeat(16) + 'Aa';
    accountRepository.findAccountById.mockResolvedValue(createAccount());

    await service.updatePassword(validId, {
      oldPassword: validOldPassword,
      newPassword: fiftyCharacterPassword,
    });

    expect(mockedBcryptHash).toHaveBeenCalledWith(fiftyCharacterPassword, 10);
  });

  it('UT-05-18: Reject new password at length 5.', async () => {
    await expectValidationMessage(
      { oldPassword: validOldPassword, newPassword: 'Abc12' },
      'New password must be at least 6 characters',
    );
  });

  it('UT-05-19: Reject new password at length 51.', async () => {
    await expectValidationMessage(
      { oldPassword: validOldPassword, newPassword: 'A'.repeat(51) },
      'New password must not exceed 50 characters',
    );
  });
});
