import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';

import { AuthController } from '../../../../src/modules/auth/auth.controller';
import { AuthService } from '../../../../src/modules/auth/auth.service';
import { AccountsService } from '../../../../src/modules/accounts/accounts.service';
import { CreateAccountDto } from '../../../../src/modules/accounts/dto/create-account.dto';
import { Gender } from '../../../../src/modules/accounts/enums/gender.enum';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';
import { AccountStatus } from '../../../../src/modules/accounts/enums/account-status.enum';
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
import { MailerService } from '../../../../src/modules/mailer/mailer.service';
import { ClinicSubscriptionHistoryRepository } from '../../../../src/modules/subscriptions/repositories/clinic-subscription-history.repository';
import { ClinicSubscriptionRepository } from '../../../../src/modules/subscriptions/repositories/clinic-subscription.repository';
import { SubscriptionServiceRepository } from '../../../../src/modules/subscriptions/repositories/subscription-service.repository';
import { ContractPackageRepository } from '../../../../src/modules/contracts/repositories/contract-package.repository';
import { TransactionRepository } from '../../../../src/modules/transactions/repositories/transaction.repository';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
}));

describe('UC-02 Register Guest', () => {
  let controller: AuthController;
  let service: AccountsService;
  let accountRepository: any;
  let generalAccountRepository: any;
  let codeVerificationRepository: any;
  let mailerService: any;
  let zaloWebhookService: any;
  let queryRunner: any;

  const mockedBcryptHash = bcrypt.hash as jest.MockedFunction<typeof bcrypt.hash>;

  const validPayload = {
    username: 'johndoe',
    email: 'newguest@example.com',
    phone: '0912345678',
    password: 'Pass123',
    fullName: 'John Doe',
    gender: Gender.MALE,
    dob: '1990-01-15',
    profilePicture: 'https://example.com/avatar.jpg',
  };

  const createDto = (overrides: Record<string, any> = {}) =>
    plainToInstance(CreateAccountDto, { ...validPayload, ...overrides });

  const validateDto = async (overrides: Record<string, any> = {}) =>
    validate(createDto(overrides));

  const validateDtoWithoutTransform = async (overrides: Record<string, any> = {}) =>
    validate(Object.assign(new CreateAccountDto(), { ...validPayload, ...overrides }));

  const expectValidationMessage = async (
    overrides: Record<string, any>,
    message: string,
  ) => {
    const errors = await validateDto(overrides);
    const messages = errors.flatMap((error) =>
      Object.values(error.constraints ?? {}),
    );

    expect(messages).toContain(message);
  };

  const queueSuccessfulPersistence = (dto: CreateAccountDto) => {
    queryRunner.manager.save
      .mockResolvedValueOnce({
        _id: 'patient-1',
        email: dto.email,
        username: dto.username,
        phone: dto.phone,
        role: AccountRole.PATIENT,
        status: AccountStatus.ACTIVE,
        isEmailVerified: false,
        isOAuthUser: false,
      })
      .mockResolvedValueOnce({
        accountId: 'patient-1',
        fullName: dto.fullName,
        gender: dto.gender,
        dob: dto.dob ? new Date(dto.dob) : undefined,
        profilePicture: dto.profilePicture,
      });
  };

  const expectRegisterSuccess = async (
    testDto: CreateAccountDto,
    expectedUsername: string,
    expectedEmail: string,
  ) => {
    accountRepository.findByEmail.mockResolvedValue(null);
    accountRepository.findAccountByEmail.mockResolvedValue(null);
    queueSuccessfulPersistence(testDto);

    const result = await controller.register(testDto);

    expect(accountRepository.createAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        username: expectedUsername,
        email: expectedEmail,
        role: AccountRole.PATIENT,
        status: AccountStatus.ACTIVE,
      }),
    );
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
    expect(codeVerificationRepository.save).toHaveBeenCalled();
    expect(mailerService.sendVerificationCode).toHaveBeenCalled();
    expect(zaloWebhookService.sendFriendRequest).toHaveBeenCalled();
    expect(result.message).toBe(
      'Account created successfully. Please request verification code via POST /mailer/send-verification-code to activate your account.',
    );
  };

  beforeEach(async () => {
    queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        save: jest.fn(),
      },
    };

    accountRepository = {
      findByEmail: jest.fn(),
      findAccountByEmail: jest.fn(),
      createAccount: jest.fn((payload: Record<string, any>) => payload),
    };

    generalAccountRepository = {
      createGeneralAccount: jest.fn((payload: Record<string, any>) => payload),
    };

    codeVerificationRepository = {
      create: jest.fn((payload: Record<string, any>) => payload),
      save: jest.fn().mockResolvedValue(undefined),
    };

    mailerService = {
      sendVerificationCode: jest.fn().mockResolvedValue(undefined),
    };

    zaloWebhookService = {
      sendFriendRequest: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AccountsService,
        { provide: AuthService, useValue: {} },
        { provide: ConfigService, useValue: {} },
        { provide: MailerService, useValue: mailerService },
        { provide: AccountRepository, useValue: accountRepository },
        { provide: GeneralAccountRepository, useValue: generalAccountRepository },
        { provide: CodeVerificationRepository, useValue: codeVerificationRepository },
        { provide: DataSource, useValue: { createQueryRunner: jest.fn().mockReturnValue(queryRunner) } },
        { provide: ClinicManagerInformationRepository, useValue: {} },
        { provide: ClinicStaffInformationRepository, useValue: {} },
        { provide: DoctorInformationRepository, useValue: {} },
        { provide: ClinicAdminInformationRepository, useValue: {} },
        { provide: AddressRepository, useValue: {} },
        { provide: GoogleIframeRepository, useValue: {} },
        { provide: ClinicSubscriptionRepository, useValue: {} },
        { provide: ClinicSubscriptionHistoryRepository, useValue: {} },
        { provide: SubscriptionServiceRepository, useValue: {} },
        { provide: ClinicsLegalDocumentsRepository, useValue: {} },
        { provide: TransactionRepository, useValue: {} },
        { provide: ZaloWebhookService, useValue: zaloWebhookService },
        { provide: ContractPackageRepository, useValue: {} },
      ],
    }).compile();

    controller = module.get(AuthController);
    service = module.get(AccountsService);
    mockedBcryptHash.mockReset();
    mockedBcryptHash.mockResolvedValue('hashed-password' as never);
  });

  it('UT-02-01: Register successfully with normalized and optional valid inputs.', async () => {
    const dto = createDto({
      username: '  johndoe  ',
      email: '  NewGuest@Example.COM  ',
      fullName: '  John Doe  ',
    });
    const validationErrors = await validate(dto);

    expect(validationErrors).toHaveLength(0);
    await expectRegisterSuccess(dto, 'johndoe', 'newguest@example.com');
    expect(generalAccountRepository.createGeneralAccount).toHaveBeenCalledWith(
      expect.objectContaining({ fullName: 'John Doe' }),
    );
  });

  it('UT-02-02: Reject duplicate email.', async () => {
    const dto = createDto({ email: 'existing@example.com' });
    accountRepository.findByEmail.mockResolvedValue({ _id: 'existing-account' });
    accountRepository.findAccountByEmail.mockResolvedValue({
      _id: 'existing-account',
    });

    await expect(controller.register(dto)).rejects.toThrow(ConflictException);
    await expect(controller.register(dto)).rejects.toThrow(
      'User with this email already exists',
    );
  });

  it('UT-02-03: Reject missing or whitespace-only username.', async () => {
    await expectValidationMessage({ username: null }, 'Username is required');
    await expectValidationMessage({ username: '   ' }, 'Username is required');
  });

  it('UT-02-04: Reject non-string username.', async () => {
    const errors = await validateDtoWithoutTransform({ username: 123456 });
    const messages = errors.flatMap((error) => Object.values(error.constraints ?? {}));

    expect(messages).toContain('Username must be a string');
  });

  it('UT-02-05: Reject username shorter than 3.', async () => {
    await expectValidationMessage({ username: 'ab' }, 'Username must be at least 3 characters');
  });

  it('UT-02-06: Reject username longer than 100.', async () => {
    await expectValidationMessage(
      { username: 'A'.repeat(101) },
      'Username must not exceed 100 characters',
    );
  });

  it('UT-02-07: Reject missing email.', async () => {
    await expectValidationMessage({ email: null }, 'Email is required');
  });

  it('UT-02-08: Reject invalid email format.', async () => {
    await expectValidationMessage({ email: 'invalid-email' }, 'Invalid email format');
  });

  it('UT-02-09: Reject non-string phone.', async () => {
    await expectValidationMessage({ phone: 912345678 }, 'Phone must be a string');
  });

  it('UT-02-10: Reject invalid phone format.', async () => {
    await expectValidationMessage(
      { phone: '1912345678' },
      'Phone must be exactly 10 digits and start with 0',
    );
  });

  it('UT-02-11: Reject invalid date of birth.', async () => {
    await expectValidationMessage(
      { dob: 'not-a-date' },
      'Date of birth must be a valid date string (YYYY-MM-DD)',
    );
  });

  it('UT-02-12: Reject missing password.', async () => {
    await expectValidationMessage({ password: null }, 'Password is required');
  });

  it('UT-02-13: Reject non-string password.', async () => {
    await expectValidationMessage({ password: 123456 }, 'password must be a string');
  });

  it('UT-02-14: Reject password shorter than 6.', async () => {
    await expectValidationMessage({ password: 'Abc12' }, 'Password must be at least 6 characters');
  });

  it('UT-02-15: Reject password longer than 50.', async () => {
    await expectValidationMessage(
      { password: 'A'.repeat(51) },
      'Password must not exceed 50 characters',
    );
  });

  it('UT-02-16: Reject password without letter or number.', async () => {
    await expectValidationMessage(
      { password: 'Onlyletters' },
      'Password must contain at least one letter and one number',
    );
    await expectValidationMessage(
      { password: '123456' },
      'Password must contain at least one letter and one number',
    );
  });

  it('UT-02-17: Reject non-string profile picture.', async () => {
    await expectValidationMessage(
      { profilePicture: 123 },
      'Profile picture must be a string',
    );
  });

  it('UT-02-18: Reject missing or whitespace-only full name.', async () => {
    await expectValidationMessage({ fullName: null }, 'Full name is required');
    await expectValidationMessage({ fullName: '   ' }, 'Full name is required');
  });

  it('UT-02-19: Reject non-string full name.', async () => {
    const errors = await validateDtoWithoutTransform({ fullName: 123 });
    const messages = errors.flatMap((error) => Object.values(error.constraints ?? {}));

    expect(messages).toContain('Full name must be a string');
  });

  it('UT-02-20: Reject full name longer than 255.', async () => {
    await expectValidationMessage(
      { fullName: 'A'.repeat(256) },
      'Full name must not exceed 255 characters',
    );
  });

  it('UT-02-21: Reject missing or invalid gender.', async () => {
    await expectValidationMessage({ gender: null }, 'Gender is required');
  });

  it('UT-02-22: Accept username at minimum length 3.', async () => {
    const dto = createDto({ username: 'abc', gender: Gender.OTHER, phone: undefined, dob: undefined, profilePicture: undefined });
    const validationErrors = await validate(dto);

    expect(validationErrors).toHaveLength(0);
    await expectRegisterSuccess(dto, 'abc', 'newguest@example.com');
  });

  it('UT-02-23: Accept username at maximum length 100.', async () => {
    const dto = createDto({ username: 'A'.repeat(100), gender: Gender.OTHER, phone: undefined, dob: undefined, profilePicture: undefined });
    const validationErrors = await validate(dto);

    expect(validationErrors).toHaveLength(0);
    await expectRegisterSuccess(dto, 'A'.repeat(100), 'newguest@example.com');
  });

  it('UT-02-24: Accept password at minimum length 6.', async () => {
    const dto = createDto({ password: 'Abc123', gender: Gender.OTHER, phone: undefined, dob: undefined, profilePicture: undefined });
    const validationErrors = await validate(dto);

    expect(validationErrors).toHaveLength(0);
    await expectRegisterSuccess(dto, 'johndoe', 'newguest@example.com');
  });

  it('UT-02-25: Accept password at maximum length 50.', async () => {
    const dto = createDto({
      password: 'Aa1Aa1Aa1Aa1Aa1Aa1Aa1Aa1Aa1Aa1Aa1Aa1Aa1Aa1Aa1Aa1Aa',
      gender: Gender.OTHER,
      phone: undefined,
      dob: undefined,
      profilePicture: undefined,
    });
    const validationErrors = await validate(dto);

    expect(validationErrors).toHaveLength(0);
    await expectRegisterSuccess(dto, 'johndoe', 'newguest@example.com');
  });

  it('UT-02-26: Accept full name at maximum length 255.', async () => {
    const dto = createDto({
      fullName: 'A'.repeat(255),
      gender: Gender.OTHER,
      phone: undefined,
      dob: undefined,
      profilePicture: undefined,
    });
    const validationErrors = await validate(dto);

    expect(validationErrors).toHaveLength(0);
    await expectRegisterSuccess(dto, 'johndoe', 'newguest@example.com');
  });
});
