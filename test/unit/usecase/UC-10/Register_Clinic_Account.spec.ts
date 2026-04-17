import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';

import { AuthController } from '../../../../src/modules/auth/auth.controller';
import { AccountsService } from '../../../../src/modules/accounts/accounts.service';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';
import { AccountStatus } from '../../../../src/modules/accounts/enums/account-status.enum';
import { RegisterClinicAdminDto } from '../../../../src/modules/accounts/dto/register-clinic-admin.dto';
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
import { ContractPackageRepository } from '../../../../src/modules/contracts/repositories/contract-package.repository';
import { MailerService } from '../../../../src/modules/mailer/mailer.service';
import { ClinicSubscriptionHistoryRepository } from '../../../../src/modules/subscriptions/repositories/clinic-subscription-history.repository';
import { ClinicSubscriptionRepository } from '../../../../src/modules/subscriptions/repositories/clinic-subscription.repository';
import { SubscriptionServiceRepository } from '../../../../src/modules/subscriptions/repositories/subscription-service.repository';
import { TransactionRepository } from '../../../../src/modules/transactions/repositories/transaction.repository';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
}));

describe('UC-10 Register Clinic Account', () => {
  let controller: AuthController;
  let service: AccountsService;
  let accountRepository: {
    createAccount: jest.Mock;
  };
  let clinicAdminInfoRepository: {
    create: jest.Mock;
  };
  let clinicSubscriptionRepository: {
    create: jest.Mock;
  };
  let mailerService: {
    sendClinicAdminWelcomeEmail: jest.Mock;
  };
  let queryRunner: any;
  let sepayQueryBuilder: any;

  const mockedBcryptHash = bcrypt.hash as jest.MockedFunction<typeof bcrypt.hash>;
  const validPayload = {
    username: 'clinicadmin',
    email: 'clinic@example.com',
    password: 'ValidPass1!',
    clinicName: 'General Health Clinic',
    serviceId: '550e8400-e29b-41d4-a716-446655440000',
    bankName: 'Vietcombank',
    bankNumber: '1234567890',
    bankBranch: 'Ho Chi Minh City Branch',
    sepayVa: '1900123456',
    sepayKey: 'sepay_test_key_1234567890',
  };

  const createDto = (overrides: Record<string, any> = {}) =>
    plainToInstance(RegisterClinicAdminDto, { ...validPayload, ...overrides });

  const validateDto = async (payload: Record<string, any>, raw = false) =>
    raw
      ? validate(Object.assign(new RegisterClinicAdminDto(), { ...validPayload, ...payload }))
      : validate(createDto(payload));

  const expectValidationMessages = async (
    payload: Record<string, any>,
    expectedMessages: string[],
    raw = false,
  ) => {
    const errors = await validateDto(payload, raw);
    const messages = errors.flatMap((error) =>
      Object.values(error.constraints ?? {}),
    );

    for (const message of expectedMessages) {
      expect(messages).toContain(message);
    }
  };

  beforeEach(async () => {
    sepayQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    };

    queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        getRepository: jest.fn().mockReturnValue({
          createQueryBuilder: jest.fn().mockReturnValue(sepayQueryBuilder),
        }),
        save: jest.fn(),
      },
    };

    accountRepository = {
      createAccount: jest.fn((payload: Record<string, any>) => payload),
    };

    clinicAdminInfoRepository = {
      create: jest.fn((payload: Record<string, any>) => payload),
    };

    clinicSubscriptionRepository = {
      create: jest.fn((payload: Record<string, any>) => payload),
    };

    mailerService = {
      sendClinicAdminWelcomeEmail: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsService,
        { provide: AccountRepository, useValue: accountRepository },
        { provide: GeneralAccountRepository, useValue: {} },
        { provide: CodeVerificationRepository, useValue: {} },
        { provide: DataSource, useValue: { createQueryRunner: jest.fn().mockReturnValue(queryRunner) } },
        { provide: ClinicManagerInformationRepository, useValue: {} },
        { provide: ClinicStaffInformationRepository, useValue: {} },
        { provide: DoctorInformationRepository, useValue: {} },
        { provide: ClinicAdminInformationRepository, useValue: clinicAdminInfoRepository },
        { provide: AddressRepository, useValue: {} },
        { provide: GoogleIframeRepository, useValue: {} },
        { provide: ClinicSubscriptionRepository, useValue: clinicSubscriptionRepository },
        { provide: ClinicSubscriptionHistoryRepository, useValue: {} },
        { provide: SubscriptionServiceRepository, useValue: {} },
        { provide: MailerService, useValue: mailerService },
        { provide: ClinicsLegalDocumentsRepository, useValue: {} },
        { provide: TransactionRepository, useValue: {} },
        { provide: ZaloWebhookService, useValue: {} },
        { provide: ContractPackageRepository, useValue: {} },
      ],
    }).compile();

    service = module.get(AccountsService);
    controller = new AuthController({} as any, service, mailerService as any, {} as any);
    mockedBcryptHash.mockReset();
    mockedBcryptHash.mockResolvedValue('hashed-password' as never);
  });

  it('UT-10-01: Register clinic admin successfully with minimal valid payload.', async () => {
    const savedAccount = {
      _id: 'clinic-admin-1',
      username: validPayload.username,
      email: validPayload.email,
      role: AccountRole.CLINIC_ADMIN,
      status: AccountStatus.ACTIVE,
      isEmailVerified: false,
      isOAuthUser: false,
    };

    jest.spyOn(service as any, 'findRegistrationAccountsByEmail').mockResolvedValue([]);
    queryRunner.manager.save
      .mockResolvedValueOnce(savedAccount)
      .mockResolvedValueOnce({ accountId: 'clinic-admin-1', clinicName: validPayload.clinicName })
      .mockResolvedValueOnce({ clinicId: 'clinic-admin-1', serviceId: validPayload.serviceId });

    const result = await controller.registerClinicAdmin(createDto());

    expect(queryRunner.commitTransaction).toHaveBeenCalled();
    expect(mailerService.sendClinicAdminWelcomeEmail).toHaveBeenCalledWith(
      validPayload.email,
      validPayload.clinicName,
    );
    expect(result.message).toBe(
      'Clinic admin registered successfully. Please create a clinic manager account to continue.',
    );
  });

  it('UT-10-02: Register clinic admin successfully with normalized and optional payload values.', async () => {
    const dto = createDto({
      username: '  clinicadmin  ',
      email: ' Clinic@Example.COM ',
      clinicName: '  General Health Clinic  ',
      phone: '0899798602',
      description: 'A modern clinic',
      specializedIn: ['Cardiology'],
      pros: ['24/7 Care'],
      paraclinical: ['X-Ray'],
      dob: '1980-01-15',
      profilePicture: 'https://example.com/avatar.jpg',
      subscriptionDurationMonths: 3,
    });

    const serviceMock = {
      registerClinicAdmin: jest.fn().mockResolvedValue({ id: 'clinic-admin-2' }),
    };
    const authController = new AuthController(
      {} as any,
      serviceMock as any,
      {} as any,
      {} as any,
    );

    const result = await authController.registerClinicAdmin(dto);

    expect(serviceMock.registerClinicAdmin).toHaveBeenCalledWith(
      expect.objectContaining({
        username: 'clinicadmin',
        email: 'clinic@example.com',
        clinicName: 'General Health Clinic',
        subscriptionDurationMonths: 3,
      }),
    );
    expect(result.message).toBe(
      'Clinic admin registered successfully. Please create a clinic manager account to continue.',
    );
  });

  it('UT-10-03: Reject duplicate email by sharing policy.', async () => {
    jest.spyOn(service as any, 'findRegistrationAccountsByEmail').mockResolvedValue([
      { role: AccountRole.PATIENT },
    ]);

    await expect(service.registerClinicAdmin(createDto())).rejects.toThrow(ConflictException);
    await expect(service.registerClinicAdmin(createDto())).rejects.toThrow(
      'This email is already registered in the system and cannot be used for this role.',
    );
  });

  it('UT-10-04: Reject duplicate SePay VA.', async () => {
    jest.spyOn(service as any, 'findRegistrationAccountsByEmail').mockResolvedValue([]);
    sepayQueryBuilder.getOne.mockResolvedValue({ _id: 'existing-sepay' });

    await expect(service.registerClinicAdmin(createDto())).rejects.toThrow(ConflictException);
    await expect(service.registerClinicAdmin(createDto())).rejects.toThrow(
      'This SePay virtual account number is already linked to another clinic.',
    );
  });

  it('UT-10-05: Reject invalid username.', async () => {
    await expectValidationMessages(
      { username: null },
      ['Username is required'],
      true,
    );
    await expectValidationMessages(
      { username: 123 },
      ['Username must be a string'],
      true,
    );
    await expectValidationMessages(
      { username: 'ab' },
      ['Username must be at least 3 characters'],
    );
    await expectValidationMessages(
      { username: 'A'.repeat(101) },
      ['Username must not exceed 100 characters'],
    );
  });

  it('UT-10-06: Reject invalid email.', async () => {
    await expectValidationMessages({ email: null }, ['Email is required'], true);
    await expectValidationMessages({ email: 'invalid-email' }, ['Invalid email format']);
  });

  it('UT-10-07: Reject invalid phone.', async () => {
    await expectValidationMessages({ phone: 899798602 }, ['Phone must be a string'], true);
    await expectValidationMessages(
      { phone: '1899798602' },
      ['Phone must be exactly 10 digits and start with 0'],
    );
  });

  it('UT-10-08: Reject invalid password.', async () => {
    await expectValidationMessages({ password: null }, ['Password is required'], true);
    await expectValidationMessages({ password: 'Abc12' }, ['Password must be at least 6 characters']);
    await expectValidationMessages({ password: 'A'.repeat(51) }, ['Password must not exceed 50 characters']);
    await expectValidationMessages(
      { password: 'allletters' },
      ['Password must contain at least one letter and one number'],
    );
  });

  it('UT-10-09: Reject invalid clinic name.', async () => {
    await expectValidationMessages({ clinicName: null }, ['Clinic name is required'], true);
    await expectValidationMessages(
      { clinicName: 'A'.repeat(501) },
      ['Clinic name must not exceed 500 characters'],
    );
  });

  it('UT-10-10: Reject invalid description and optional arrays.', async () => {
    await expectValidationMessages(
      {
        description: 123,
        specializedIn: 'Cardiology',
        pros: '24/7 Care',
        paraclinical: 'X-Ray',
      },
      [
        'Description must be a string',
        'SpecializedIn must be an array',
        'Pros must be an array',
        'Paraclinical must be an array',
      ],
      true,
    );
  });

  it('UT-10-11: Reject invalid dob or profile picture.', async () => {
    await expectValidationMessages(
      { dob: 'not-a-date', profilePicture: 123 },
      [
        'Date of birth must be a valid ISO 8601 date string',
        'Profile picture must be a string',
      ],
      true,
    );
  });

  it('UT-10-12: Reject invalid service id.', async () => {
    await expectValidationMessages({ serviceId: null }, ['Service ID is required'], true);
    await expectValidationMessages(
      { serviceId: 'invalid-uuid' },
      ['Service ID must be a valid UUID'],
    );
  });

  it('UT-10-13: Reject invalid subscription duration.', async () => {
    await expectValidationMessages(
      { subscriptionDurationMonths: 2 },
      ['Subscription duration must be one of: 1, 3, 6, 12 months'],
    );
    await expectValidationMessages(
      { subscriptionDurationMonths: 'not-a-number' },
      ['Subscription duration must be an integer'],
    );
  });

  it('UT-10-14: Reject invalid bankName.', async () => {
    await expectValidationMessages({ bankName: null }, ['Bank name is required'], true);
    await expectValidationMessages(
      { bankName: 'A'.repeat(256) },
      ['Bank name must not exceed 255 characters'],
    );
  });

  it('UT-10-15: Reject invalid bankNumber, bankBranch, sepayVa, or sepayKey.', async () => {
    await expectValidationMessages(
      {
        bankNumber: null,
        bankBranch: null,
        sepayVa: null,
        sepayKey: null,
      },
      [
        'Bank number is required',
        'Bank branch is required',
        'SePay VA is required',
        'SePay key is required',
      ],
      true,
    );
    await expectValidationMessages(
      {
        bankNumber: 'A'.repeat(51),
        bankBranch: 'A'.repeat(256),
        sepayVa: 'A'.repeat(51),
        sepayKey: 'A'.repeat(256),
      },
      [
        'Bank number must not exceed 50 characters',
        'Bank branch must not exceed 255 characters',
        'SePay VA must not exceed 50 characters',
        'SePay key must not exceed 255 characters',
      ],
    );
  });

  it('UT-10-16: Bubble transaction or FK failure as internal server error.', async () => {
    jest.spyOn(service as any, 'findRegistrationAccountsByEmail').mockResolvedValue([]);
    queryRunner.manager.save.mockResolvedValueOnce({
      _id: 'clinic-admin-1',
      email: validPayload.email,
    });
    queryRunner.manager.save.mockResolvedValueOnce({ accountId: 'clinic-admin-1' });
    queryRunner.manager.save.mockRejectedValueOnce(new Error('Internal Server Error'));

    await expect(service.registerClinicAdmin(createDto())).rejects.toThrow(
      'Internal Server Error',
    );
    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
  });

  it('UT-10-17: Accept password at length 6.', async () => {
    const errors = await validateDto({ password: 'Abc123' });

    expect(errors).toHaveLength(0);
  });

  it('UT-10-18: Accept username at length 3.', async () => {
    const errors = await validateDto({ username: 'abc' });

    expect(errors).toHaveLength(0);
  });

  it('UT-10-19: Accept clinic name at length 500.', async () => {
    const errors = await validateDto({ clinicName: 'A'.repeat(500) });

    expect(errors).toHaveLength(0);
  });

  it('UT-10-20: Accept password at length 50.', async () => {
    const fiftyCharPassword = 'Aa1'.repeat(16) + 'Aa';
    const errors = await validateDto({ password: fiftyCharPassword });

    expect(errors).toHaveLength(0);
  });
});
