import { ConflictException, ParseUUIDPipe } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DataSource } from 'typeorm';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { RolesGuard } from '../../../../src/common/guards/roles.guard';
import { AccountsController } from '../../../../src/modules/accounts/accounts.controller';
import { AccountsService } from '../../../../src/modules/accounts/accounts.service';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';
import { AccountStatus } from '../../../../src/modules/accounts/enums/account-status.enum';
import { ClinicRole } from '../../../../src/modules/accounts/enums/clinic-role.enum';
import { UpdateAccountDto } from '../../../../src/modules/accounts/dto/update-account.dto';
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

describe('UC-08 Update Profile', () => {
  let controller: AccountsController;
  let service: AccountsService;
  let accountRepository: {
    findAccountById: jest.Mock;
    saveAccount: jest.Mock;
  };
  let addressRepository: {
    findByAccountId: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let googleIframeRepository: {
    findByAddressId: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let zaloWebhookService: {
    sendFriendRequest: jest.Mock;
  };

  const validId = '11111111-1111-4111-8111-111111111111';
  const createAccount = (overrides: Record<string, any> = {}) => ({
    _id: validId,
    email: 'user@example.com',
    username: 'current-user',
    phone: '0912345678',
    role: AccountRole.PATIENT,
    status: AccountStatus.ACTIVE,
    isEmailVerified: true,
    ...overrides,
  });

  const validateDto = async (payload: Record<string, any>) =>
    validate(plainToInstance(UpdateAccountDto, payload));

  const validateDtoWithoutTransform = async (payload: Record<string, any>) =>
    validate(Object.assign(new UpdateAccountDto(), payload));

  const expectValidationMessages = async (
    payload: Record<string, any>,
    expectedMessages: string[],
    useRawInstance = false,
  ) => {
    const errors = useRawInstance
      ? await validateDtoWithoutTransform(payload)
      : await validateDto(payload);
    const messages = errors.flatMap((error) =>
      Object.values(error.constraints ?? {}),
    );

    for (const message of expectedMessages) {
      expect(messages).toContain(message);
    }
  };

  beforeEach(async () => {
    accountRepository = {
      findAccountById: jest.fn(),
      saveAccount: jest.fn(async (account) => account),
    };
    addressRepository = {
      findByAccountId: jest.fn(),
      create: jest.fn((payload) => ({ _id: 'address-1', ...payload })),
      save: jest.fn(async (address) => address),
    };
    googleIframeRepository = {
      findByAddressId: jest.fn(),
      create: jest.fn((payload) => payload),
      save: jest.fn(async (iframe) => iframe),
    };
    zaloWebhookService = {
      sendFriendRequest: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsService,
        { provide: AccountRepository, useValue: accountRepository },
        {
          provide: GeneralAccountRepository,
          useValue: { findByAccountId: jest.fn(), createGeneralAccount: jest.fn(), saveGeneralAccount: jest.fn() },
        },
        { provide: CodeVerificationRepository, useValue: {} },
        { provide: DataSource, useValue: {} },
        {
          provide: ClinicManagerInformationRepository,
          useValue: { findByAccountId: jest.fn(), create: jest.fn(), save: jest.fn() },
        },
        {
          provide: ClinicStaffInformationRepository,
          useValue: { findByAccountId: jest.fn(), create: jest.fn(), save: jest.fn() },
        },
        {
          provide: DoctorInformationRepository,
          useValue: { findByAccountId: jest.fn(), create: jest.fn(), save: jest.fn() },
        },
        {
          provide: ClinicAdminInformationRepository,
          useValue: { findByAccountId: jest.fn(), create: jest.fn(), save: jest.fn() },
        },
        { provide: AddressRepository, useValue: addressRepository },
        { provide: GoogleIframeRepository, useValue: googleIframeRepository },
        { provide: ClinicSubscriptionRepository, useValue: {} },
        { provide: ClinicSubscriptionHistoryRepository, useValue: {} },
        { provide: SubscriptionServiceRepository, useValue: {} },
        { provide: MailerService, useValue: {} },
        { provide: ClinicsLegalDocumentsRepository, useValue: {} },
        { provide: TransactionRepository, useValue: {} },
        { provide: ZaloWebhookService, useValue: zaloWebhookService },
        { provide: ContractPackageRepository, useValue: {} },
      ],
    }).compile();

    service = module.get(AccountsService);
    controller = new AccountsController(service);
  });

  it('UT-08-01: Update basic profile successfully without email change.', async () => {
    jest.spyOn(service, 'update').mockResolvedValue({
      user: { id: validId, username: 'johndoe' } as any,
      emailChanged: false,
    });

    const result = await controller.update(validId, { username: 'johndoe' });

    expect(result).toEqual({
      data: { id: validId, username: 'johndoe' },
      message: 'User updated successfully',
    });
  });

  it('UT-08-02: Update profile successfully with email change.', async () => {
    jest.spyOn(service, 'update').mockResolvedValue({
      user: { id: validId, email: 'newemail@example.com' } as any,
      emailChanged: true,
    });

    const result = await controller.update(validId, {
      email: 'newemail@example.com',
    });

    expect(result).toEqual({
      data: { id: validId, email: 'newemail@example.com' },
      message:
        'Email updated successfully. Your account status is now PENDING. Please request verification code via POST /mailer/send-verification-code to verify your new email.',
    });
  });

  it('UT-08-03: Update DOCTOR-specific profile fields successfully.', async () => {
    accountRepository.findAccountById.mockResolvedValue(createAccount({ role: AccountRole.DOCTOR }));
    const updateDoctorInformation = jest
      .spyOn(service, 'updateDoctorInformation')
      .mockResolvedValue({} as any);
    jest.spyOn(service as any, 'updateAddressAndGoogleIframe').mockResolvedValue(undefined);
    jest.spyOn(service, 'getAccountInformationByRole').mockResolvedValue({
      id: validId,
      academicDegree: 'MD',
      position: 'Chief Cardiologist',
    } as any);

    const result = await service.update(validId, {
      academicDegree: 'MD',
      position: 'Chief Cardiologist',
      experience: '10 years',
    });

    expect(updateDoctorInformation).toHaveBeenCalledWith(
      validId,
      expect.objectContaining({ academicDegree: 'MD', position: 'Chief Cardiologist' }),
    );
    expect(result.user.academicDegree).toBe('MD');
  });

  it('UT-08-04: Create address and google iframe successfully when records do not exist.', async () => {
    accountRepository.findAccountById.mockResolvedValue(createAccount());
    jest.spyOn(service, 'updateGeneralAccount').mockResolvedValue({} as any);
    jest.spyOn(service, 'getAccountInformationByRole').mockResolvedValue({ id: validId } as any);
    addressRepository.findByAccountId.mockResolvedValue(null);
    googleIframeRepository.findByAddressId.mockResolvedValue(null);

    await service.update(validId, {
      fullName: 'John Doe',
      address: '123 Nguyen Hue',
      province: '79',
      location: '(10.0,106.0)',
      googleMapIframe: '<iframe />',
    });

    expect(addressRepository.create).toHaveBeenCalled();
    expect(googleIframeRepository.create).toHaveBeenCalled();
  });

  it('UT-08-05: Reject missing or invalid JWT.', () => {
    const guards =
      Reflect.getMetadata(GUARDS_METADATA, AccountsController.prototype.update) ?? [];
    const roles = Reflect.getMetadata(ROLES_KEY, AccountsController.prototype.update) ?? [];

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

  it('UT-08-06: Reject invalid UUID path parameter.', async () => {
    const pipe = new ParseUUIDPipe();

    await expect(
      pipe.transform('not-a-uuid', { type: 'param', metatype: String, data: 'id' }),
    ).rejects.toThrow('Validation failed (uuid is expected)');
  });

  it('UT-08-07: Reject non-existent account id.', async () => {
    accountRepository.findAccountById.mockResolvedValue(null);

    await expect(service.update(validId, {})).rejects.toThrow('User not found');
  });

  it('UT-08-08: Reject conflicting new email.', async () => {
    accountRepository.findAccountById.mockResolvedValue(createAccount());
    jest
      .spyOn(service as any, 'validateSharedEmailPolicyForAccountUpdate')
      .mockRejectedValue(new ConflictException('Email already exists'));

    await expect(
      service.update(validId, { email: 'existing@example.com' }),
    ).rejects.toThrow(ConflictException);
  });

  it('UT-08-09: Reject invalid basic account fields.', async () => {
    await expectValidationMessages(
      {
        username: 123,
        email: 'invalid-email',
        phone: '1912345678',
        dob: 'not-a-date',
        profilePicture: 123,
        role: 'INVALID_ROLE',
      },
      [
        'Username must be a string',
        'Invalid email format',
        'Phone must be exactly 10 digits and start with 0',
        'Date of birth must be a valid date string (YYYY-MM-DD)',
        'Profile picture must be a string',
        'Invalid account role',
      ],
      true,
    );
  });

  it('UT-08-10: Reject invalid general profile fields.', async () => {
    await expectValidationMessages(
      {
        fullName: 123,
        gender: 'INVALID',
      },
      ['Full name must be a string', 'Gender must be one of: MALE, FEMALE, OTHER'],
      true,
    );
  });

  it('UT-08-11: Reject invalid doctor professional fields.', async () => {
    await expectValidationMessages(
      {
        academicDegree: 123,
        experience: 123,
        position: 123,
        introduction1: 123,
        workProcess2: 'text',
        studyProcess3: 'text',
        members4: 'text',
        scientificWork5: 'text',
        papers6: 'text',
        introductionImage: 123,
      },
      [
        'Academic degree must be a string',
        'Experience must be a string',
        'Position must be a string',
        'Introduction must be a string',
        'Work process must be an object',
        'Study process must be an object',
        'Members must be an object',
        'Scientific work must be an object',
        'Papers must be an object',
        'Introduction image must be a string',
      ],
    );
  });

  it('UT-08-12: Reject invalid doctor identity or banking fields.', async () => {
    await expectValidationMessages(
      {
        professionalLicense: 'text',
        certificatePracticalTraining: 'text',
        medicalLicense: 'text',
        identityNumber: 123,
        placeIdentityCard: 123,
        identityDate: 'not-a-date',
        bankName: 123,
        bankNumber: 123,
        bankBranch: 123,
      },
      [
        'Professional license must be an object',
        'Certificate of practical training must be an object',
        'Medical license must be an object',
        'Identity number must be a string',
        'Place identity card must be a string',
        'Identity date must be a valid date string (YYYY-MM-DD)',
        'Bank name must be a string',
        'Bank number must be a string',
        'Bank branch must be a string',
      ],
    );
  });

  it('UT-08-13: Reject invalid clinic admin fields.', async () => {
    await expectValidationMessages(
      {
        clinicName: 123,
        description: 123,
        specializedIn: 'text',
        pros: 'text',
        paraclinical: 'text',
        sepayVa: 123,
      },
      [
        'Clinic name must be a string',
        'Description must be a string',
        'Specialized in must be an array',
        'Pros must be an array',
        'Paraclinical must be an array',
        'SePay VA must be a string',
      ],
    );
  });

  it('UT-08-14: Reject invalid clinic manager or staff fields.', async () => {
    await expectValidationMessages(
      {
        clinicBranchName: 123,
        clinicRole: 'INVALID',
      },
      ['Clinic branch name must be a string', 'Invalid clinic role'],
    );
  });

  it('UT-08-15: Reject invalid address fields.', async () => {
    await expectValidationMessages(
      {
        address: 123,
        ward: 123,
        district: 123,
        province: 123,
        provinceName: 123,
        districtName: 123,
        wardName: 123,
      },
      [
        'Address must be a string',
        'Ward must be a string',
        'District must be a string',
        'Province must be a string',
        'Province name must be a string',
        'District name must be a string',
        'Ward name must be a string',
      ],
    );
  });

  it('UT-08-16: Reject invalid google iframe fields.', async () => {
    await expectValidationMessages(
      {
        location: 123,
        mapStyle: 123,
        zoomLevel: '15',
        mapHeight: '400',
        mapWidth: '600',
        googleMapIframe: 123,
      },
      [
        'Location must be a string',
        'Map style must be a string',
        'Zoom level must be a number',
        'Map height must be a number',
        'Map width must be a number',
        'Google Map iframe must be a string',
      ],
    );
  });

  it('UT-08-17: Bubble repository save failure as internal server error.', async () => {
    accountRepository.findAccountById.mockResolvedValue(createAccount());
    accountRepository.saveAccount.mockRejectedValue(new Error('db failed'));

    await expect(service.update(validId, { username: 'johndoe' })).rejects.toThrow(
      'db failed',
    );
  });

  it('UT-08-18: Accept username at length 3.', async () => {
    const errors = await validateDto({ username: 'abc' });

    expect(errors).toHaveLength(0);
  });

  it('UT-08-19: Accept username at length 100.', async () => {
    const errors = await validateDto({ username: 'A'.repeat(100) });

    expect(errors).toHaveLength(0);
  });

  it('UT-08-20: Accept fullName at length 255.', async () => {
    const errors = await validateDto({ fullName: 'A'.repeat(255) });

    expect(errors).toHaveLength(0);
  });

  it('UT-08-21: Accept clinicName at length 255.', async () => {
    const errors = await validateDto({ clinicName: 'A'.repeat(255) });

    expect(errors).toHaveLength(0);
  });

  it('UT-08-22: Accept clinicBranchName at length 255.', async () => {
    const errors = await validateDto({ clinicBranchName: 'A'.repeat(255) });

    expect(errors).toHaveLength(0);
  });
});
