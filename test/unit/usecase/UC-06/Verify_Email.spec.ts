import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DataSource } from 'typeorm';

import { AuthController } from '../../../../src/modules/auth/auth.controller';
import { AuthService } from '../../../../src/modules/auth/auth.service';
import { VerifyEmailDto } from '../../../../src/modules/auth/dto/verify-email.dto';
import { AccountsService } from '../../../../src/modules/accounts/accounts.service';
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
import { ContractPackageRepository } from '../../../../src/modules/contracts/repositories/contract-package.repository';
import { MailerService } from '../../../../src/modules/mailer/mailer.service';
import { SocketGatewayService } from '../../../../src/modules/socket-gateway/socket-gateway.service';
import { ClinicSubscriptionHistoryRepository } from '../../../../src/modules/subscriptions/repositories/clinic-subscription-history.repository';
import { ClinicSubscriptionRepository } from '../../../../src/modules/subscriptions/repositories/clinic-subscription.repository';
import { SubscriptionServiceRepository } from '../../../../src/modules/subscriptions/repositories/subscription-service.repository';
import { TransactionRepository } from '../../../../src/modules/transactions/repositories/transaction.repository';
import { JwtService } from '@nestjs/jwt';

describe('UC-06 Verify Email', () => {
  let controller: AuthController;
  let service: AccountsService;
  let accountRepository: {
    createQueryBuilder: jest.Mock;
    saveAccount: jest.Mock;
  };
  let codeVerificationRepository: {
    findValidByUserIdAndCode: jest.Mock;
    markAsUsed: jest.Mock;
  };
  let mailerService: {
    sendWelcomeEmail: jest.Mock;
  };
  let queryBuilder: {
    leftJoinAndSelect: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    getMany: jest.Mock;
  };

  const createAccount = (overrides: Record<string, any> = {}) => ({
    _id: 'account-1',
    email: 'unverified@example.com',
    username: 'verify-user',
    role: AccountRole.PATIENT,
    isEmailVerified: false,
    status: AccountStatus.UNVERIFIED,
    generalAccount: {
      fullName: 'Jane Doe',
    },
    ...overrides,
  });

  const validateDto = async (payload: Record<string, any>) =>
    validate(plainToInstance(VerifyEmailDto, payload));

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
    queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    };

    accountRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      saveAccount: jest.fn().mockResolvedValue(undefined),
    };

    codeVerificationRepository = {
      findValidByUserIdAndCode: jest.fn(),
      markAsUsed: jest.fn().mockResolvedValue(undefined),
    };

    mailerService = {
      sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AccountsService,
        { provide: AuthService, useValue: {} },
        { provide: ConfigService, useValue: {} },
        { provide: MailerService, useValue: mailerService },
        { provide: AccountRepository, useValue: accountRepository },
        { provide: GeneralAccountRepository, useValue: {} },
        { provide: CodeVerificationRepository, useValue: codeVerificationRepository },
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
        { provide: ClinicsLegalDocumentsRepository, useValue: {} },
        { provide: TransactionRepository, useValue: {} },
        { provide: ZaloWebhookService, useValue: {} },
        { provide: ContractPackageRepository, useValue: {} },
        { provide: JwtService, useValue: {} },
        { provide: SocketGatewayService, useValue: {} },
      ],
    }).compile();

    controller = module.get(AuthController);
    service = module.get(AccountsService);
  });

  it('UT-06-01: Verify one matching account successfully without role hint.', async () => {
    queryBuilder.getMany.mockResolvedValue([createAccount()]);
    codeVerificationRepository.findValidByUserIdAndCode.mockResolvedValue({
      _id: 'verification-1',
      expiredAt: new Date('2099-01-01T00:00:00.000Z'),
    });

    const result = await controller.verifyEmail({
      email: 'unverified@example.com',
      code: '123456',
    });

    expect(codeVerificationRepository.markAsUsed).toHaveBeenCalledWith('verification-1');
    expect(accountRepository.saveAccount).toHaveBeenCalledWith(
      expect.objectContaining({ isEmailVerified: true, status: AccountStatus.ACTIVE }),
    );
    expect(mailerService.sendWelcomeEmail).toHaveBeenCalledWith(
      'unverified@example.com',
      'Jane',
      'Doe',
    );
    expect(result).toEqual({
      message: 'Email verified successfully. Your account is now ACTIVE. Welcome to Medicare!',
    });
  });

  it('UT-06-02: Verify one account successfully from overlapping-email accounts by role hint.', async () => {
    queryBuilder.getMany.mockResolvedValue([
      createAccount({ _id: 'doctor-1', email: 'multi@example.com', role: AccountRole.DOCTOR }),
    ]);
    codeVerificationRepository.findValidByUserIdAndCode.mockResolvedValue({
      _id: 'verification-2',
      expiredAt: new Date('2099-01-01T00:00:00.000Z'),
    });

    const result = await controller.verifyEmail({
      email: 'multi@example.com',
      code: '123456',
      role: AccountRole.DOCTOR,
    });

    expect(queryBuilder.andWhere).toHaveBeenCalledWith('account.role = :role', {
      role: AccountRole.DOCTOR,
    });
    expect(result.message).toBe(
      'Email verified successfully. Your account is now ACTIVE. Welcome to Medicare!',
    );
  });

  it('UT-06-03: Reject invalid email payload.', async () => {
    await expectValidationMessage(
      { email: 'invalid-email', code: '123456', role: AccountRole.PATIENT },
      'Invalid email format',
    );
  });

  it('UT-06-04: Reject non-string verification code.', async () => {
    await expectValidationMessage(
      { email: 'unverified@example.com', code: 123456, role: AccountRole.PATIENT },
      'code must be a string',
    );
  });

  it('UT-06-05: Reject verification code shorter than 6.', async () => {
    await expectValidationMessage(
      { email: 'unverified@example.com', code: '12345', role: AccountRole.PATIENT },
      'Verification code must be 6 digits',
    );
  });

  it('UT-06-06: Reject verification code longer than 6.', async () => {
    await expectValidationMessage(
      { email: 'unverified@example.com', code: '1234567', role: AccountRole.PATIENT },
      'Verification code must be 6 digits',
    );
  });

  it('UT-06-07: Reject non-numeric verification code.', async () => {
    await expectValidationMessage(
      { email: 'unverified@example.com', code: 'abcdef', role: AccountRole.PATIENT },
      'Verification code must contain only numbers',
    );
  });

  it('UT-06-08: Reject invalid role hint.', async () => {
    await expectValidationMessage(
      { email: 'unverified@example.com', code: '123456', role: 'INVALID_ROLE' },
      'Invalid account role',
    );
  });

  it('UT-06-09: Reject email not found or soft-deleted.', async () => {
    queryBuilder.getMany.mockResolvedValue([]);

    await expect(
      service.verifyEmailCode('notfound@example.com', '123456', AccountRole.PATIENT),
    ).rejects.toThrow(NotFoundException);
    await expect(
      service.verifyEmailCode('notfound@example.com', '123456', AccountRole.PATIENT),
    ).rejects.toThrow('User not found');
  });

  it('UT-06-10: Reject wrong or already-used verification code.', async () => {
    queryBuilder.getMany.mockResolvedValue([createAccount()]);
    codeVerificationRepository.findValidByUserIdAndCode.mockResolvedValue(null);

    await expect(
      service.verifyEmailCode('unverified@example.com', '000000', AccountRole.PATIENT),
    ).rejects.toThrow(UnauthorizedException);
    await expect(
      service.verifyEmailCode('unverified@example.com', '000000', AccountRole.PATIENT),
    ).rejects.toThrow('Invalid verification code. Please check and try again.');
  });

  it('UT-06-11: Reject already-verified account.', async () => {
    queryBuilder.getMany.mockResolvedValue([
      createAccount({ email: 'verified@example.com', isEmailVerified: true }),
    ]);
    codeVerificationRepository.findValidByUserIdAndCode.mockResolvedValue({
      _id: 'verification-3',
      expiredAt: new Date('2099-01-01T00:00:00.000Z'),
    });

    await expect(
      service.verifyEmailCode('verified@example.com', '123456', AccountRole.PATIENT),
    ).rejects.toThrow(ConflictException);
    await expect(
      service.verifyEmailCode('verified@example.com', '123456', AccountRole.PATIENT),
    ).rejects.toThrow('Email is already verified');
  });

  it('UT-06-12: Reject expired verification code branch.', async () => {
    queryBuilder.getMany.mockResolvedValue([createAccount()]);
    codeVerificationRepository.findValidByUserIdAndCode.mockResolvedValue({
      _id: 'verification-4',
      expiredAt: new Date('2000-01-01T00:00:00.000Z'),
    });

    await expect(
      service.verifyEmailCode('unverified@example.com', '123456', AccountRole.PATIENT),
    ).rejects.toThrow(UnauthorizedException);
    await expect(
      service.verifyEmailCode('unverified@example.com', '123456', AccountRole.PATIENT),
    ).rejects.toThrow(
      'Verification code has expired. Please request a new one via POST /mailer/send-verification-code',
    );
  });

  it('UT-06-13: Accept exact 6-digit numeric code.', async () => {
    const errors = await validateDto({
      email: 'unverified@example.com',
      code: '123456',
      role: AccountRole.PATIENT,
    });

    expect(errors).toHaveLength(0);
  });

  it('UT-06-14: Reject 5-digit code.', async () => {
    await expectValidationMessage(
      { email: 'unverified@example.com', code: '12345', role: AccountRole.PATIENT },
      'Verification code must be 6 digits',
    );
  });

  it('UT-06-15: Reject 7-digit code.', async () => {
    await expectValidationMessage(
      { email: 'unverified@example.com', code: '1234567', role: AccountRole.PATIENT },
      'Verification code must be 6 digits',
    );
  });
});
