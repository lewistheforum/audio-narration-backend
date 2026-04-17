import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import * as bcrypt from 'bcrypt';

import { AuthController } from '../../../../src/modules/auth/auth.controller';
import { AuthService } from '../../../../src/modules/auth/auth.service';
import {
  ForgotPasswordDto,
  VerifyResetPasswordDto,
} from '../../../../src/modules/auth/dto/forgot-password.dto';
import { ResetPasswordDto } from '../../../../src/modules/auth/dto/reset-password.dto';
import { AccountsService } from '../../../../src/modules/accounts/accounts.service';
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
import { MailerController } from '../../../../src/modules/mailer/mailer.controller';
import { MailerService } from '../../../../src/modules/mailer/mailer.service';
import { SocketGatewayService } from '../../../../src/modules/socket-gateway/socket-gateway.service';
import { ClinicSubscriptionHistoryRepository } from '../../../../src/modules/subscriptions/repositories/clinic-subscription-history.repository';
import { ClinicSubscriptionRepository } from '../../../../src/modules/subscriptions/repositories/clinic-subscription.repository';
import { SubscriptionServiceRepository } from '../../../../src/modules/subscriptions/repositories/subscription-service.repository';
import { ContractPackageRepository } from '../../../../src/modules/contracts/repositories/contract-package.repository';
import { TransactionRepository } from '../../../../src/modules/transactions/repositories/transaction.repository';
import { ZaloWebhookService } from '../../../../src/modules/accounts/zalo-webhook.service';
import { DataSource } from 'typeorm';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
}));

describe('UC-04 Forgot Password', () => {
  let mailerController: MailerController;
  let authController: AuthController;
  let authService: AuthService;
  let accountsService: AccountsService;
  let mailerService: {
    sendPasswordResetCode: jest.Mock;
  };
  let codeVerificationRepository: {
    create: jest.Mock;
    save: jest.Mock;
    invalidateAllUserCodes: jest.Mock;
    findValidByUserIdAndCode: jest.Mock;
    markAsUsed: jest.Mock;
  };
  let accountRepository: {
    findAccountByEmail: jest.Mock;
    saveAccount: jest.Mock;
  };

  const mockedBcryptHash = bcrypt.hash as jest.MockedFunction<typeof bcrypt.hash>;

  const validEmail = 'registered@example.com';
  const validRole = AccountRole.PATIENT;
  const validCode = '123456';
  const strongPassword = 'NewPwd@123';

  const createAccount = (overrides: Record<string, any> = {}) => ({
    _id: 'account-1',
    email: validEmail,
    username: 'registered-user',
    role: validRole,
    password: '$2b$10$existing-hash',
    isOAuthUser: false,
    ...overrides,
  });

  const validateDto = async (dtoClass: new () => object, payload: Record<string, any>) =>
    validate(plainToInstance(dtoClass, payload));

  const extractMessages = (errors: any[]) =>
    errors.flatMap((error) => Object.values(error.constraints ?? {}));

  const expectValidationMessage = async (
    dtoClass: new () => object,
    payload: Record<string, any>,
    message: string,
  ) => {
    const errors = await validateDto(dtoClass, payload);
    expect(extractMessages(errors)).toContain(message);
  };

  beforeEach(async () => {
    mailerService = {
      sendPasswordResetCode: jest.fn().mockResolvedValue(undefined),
    };

    codeVerificationRepository = {
      create: jest.fn((payload: Record<string, any>) => ({ _id: 'verification-1', ...payload })),
      save: jest.fn().mockResolvedValue(undefined),
      invalidateAllUserCodes: jest.fn().mockResolvedValue(undefined),
      findValidByUserIdAndCode: jest.fn(),
      markAsUsed: jest.fn().mockResolvedValue(undefined),
    };

    accountRepository = {
      findAccountByEmail: jest.fn(),
      saveAccount: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MailerController, AuthController],
      providers: [
        AccountsService,
        AuthService,
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
        { provide: ConfigService, useValue: {} },
        { provide: SocketGatewayService, useValue: {} },
      ],
    }).compile();

    mailerController = module.get(MailerController);
    authController = module.get(AuthController);
    authService = module.get(AuthService);
    accountsService = module.get(AccountsService);
    mockedBcryptHash.mockReset();
    mockedBcryptHash.mockResolvedValue('new-hash' as never);
  });

  it('UT-04-01: Request password reset code successfully.', async () => {
    accountRepository.findAccountByEmail.mockResolvedValue(createAccount());

    const result = await mailerController.forgotPassword({
      email: validEmail,
      role: validRole,
    });

    expect(codeVerificationRepository.invalidateAllUserCodes).toHaveBeenCalledWith(
      'account-1',
      'RESET',
    );
    expect(mailerService.sendPasswordResetCode).toHaveBeenCalledWith(
      validEmail,
      expect.stringMatching(/^\d{6}$/),
      'registered-user',
      validRole,
    );
    expect(result).toEqual({
      message:
        'Password reset code sent to your email. Code expires in 15 minutes. Please check your inbox.',
    });
  });

  it('UT-04-02: Verify RESET code successfully.', async () => {
    accountRepository.findAccountByEmail.mockResolvedValue(createAccount());
    codeVerificationRepository.findValidByUserIdAndCode.mockResolvedValue({
      _id: 'verification-1',
      expiredAt: new Date('2099-01-01T00:00:00.000Z'),
    });

    const result = await authController.verifyResetCode({
      email: validEmail,
      role: validRole,
      code: validCode,
    });

    expect(result).toEqual({
      message:
        'Verification code validated successfully. You can now set a new password.',
    });
  });

  it('UT-04-03: Reset password successfully.', async () => {
    accountRepository.findAccountByEmail.mockResolvedValue(createAccount());
    codeVerificationRepository.findValidByUserIdAndCode.mockResolvedValue({
      _id: 'verification-1',
      expiredAt: new Date('2099-01-01T00:00:00.000Z'),
    });

    const result = await authController.resetPassword({
      email: validEmail,
      role: validRole,
      code: validCode,
      newPassword: strongPassword,
      confirmPassword: strongPassword,
    });

    expect(codeVerificationRepository.markAsUsed).toHaveBeenCalledWith('verification-1');
    expect(accountRepository.saveAccount).toHaveBeenCalledWith(
      expect.objectContaining({ password: 'new-hash' }),
    );
    expect(result).toEqual({
      message: 'Password reset successfully. You can now login with your new password.',
    });
  });

  it('UT-04-04: Reject forgot-password invalid email.', async () => {
    await expectValidationMessage(
      ForgotPasswordDto,
      { email: 'invalid-email', role: validRole },
      'email must be an email',
    );
  });

  it('UT-04-05: Reject forgot-password role not string.', async () => {
    await expectValidationMessage(
      ForgotPasswordDto,
      { email: validEmail, role: 123 },
      'role must be a string',
    );
  });

  it('UT-04-06: Reject forgot-password account not found in role.', async () => {
    accountRepository.findAccountByEmail.mockResolvedValue(null);

    await expect(
      accountsService.initiatePasswordReset(validEmail, validRole),
    ).rejects.toThrow(NotFoundException);
    await expect(
      accountsService.initiatePasswordReset(validEmail, validRole),
    ).rejects.toThrow('Account not found or cannot reset password in this role.');
  });

  it('UT-04-07: Reject forgot-password for pure OAuth account.', async () => {
    accountRepository.findAccountByEmail.mockResolvedValue(
      createAccount({ isOAuthUser: true, password: null }),
    );

    await expect(
      accountsService.initiatePasswordReset(validEmail, validRole),
    ).rejects.toThrow(BadRequestException);
    await expect(
      accountsService.initiatePasswordReset(validEmail, validRole),
    ).rejects.toThrow(
      'OAuth users cannot reset password. Please login with your OAuth provider (Google, etc.)',
    );
  });

  it('UT-04-08: Reject verify-reset invalid email.', async () => {
    await expectValidationMessage(
      VerifyResetPasswordDto,
      { email: 'invalid-email', role: validRole, code: validCode },
      'email must be an email',
    );
  });

  it('UT-04-09: Reject verify-reset role not string.', async () => {
    await expectValidationMessage(
      VerifyResetPasswordDto,
      { email: validEmail, role: 123, code: validCode },
      'role must be a string',
    );
  });

  it('UT-04-10: Reject verify-reset code not string.', async () => {
    await expectValidationMessage(
      VerifyResetPasswordDto,
      { email: validEmail, role: validRole, code: 123456 },
      'code must be a string',
    );
  });

  it('UT-04-11: Reject verify-reset code wrong length.', async () => {
    await expectValidationMessage(
      VerifyResetPasswordDto,
      { email: validEmail, role: validRole, code: '12345' },
      'code must be longer than or equal to 6 characters',
    );
  });

  it('UT-04-12: Reject verify-reset account not found.', async () => {
    accountRepository.findAccountByEmail.mockResolvedValue(null);

    await expect(
      authService.verifyResetPasswordCode({
        email: validEmail,
        role: validRole,
        code: validCode,
      }),
    ).rejects.toThrow(NotFoundException);
    await expect(
      authService.verifyResetPasswordCode({
        email: validEmail,
        role: validRole,
        code: validCode,
      }),
    ).rejects.toThrow('Account not found or cannot reset password in this role.');
  });

  it('UT-04-13: Reject verify-reset OAuth-only account.', async () => {
    accountRepository.findAccountByEmail.mockResolvedValue(
      createAccount({ isOAuthUser: true, password: null }),
    );

    await expect(
      authService.verifyResetPasswordCode({
        email: validEmail,
        role: validRole,
        code: validCode,
      }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      authService.verifyResetPasswordCode({
        email: validEmail,
        role: validRole,
        code: validCode,
      }),
    ).rejects.toThrow(
      'OAuth users cannot reset password. Please login with your OAuth provider (Google, etc.)',
    );
  });

  it('UT-04-14: Reject verify-reset wrong or used code.', async () => {
    accountRepository.findAccountByEmail.mockResolvedValue(createAccount());
    codeVerificationRepository.findValidByUserIdAndCode.mockResolvedValue(null);

    await expect(
      authService.verifyResetPasswordCode({
        email: validEmail,
        role: validRole,
        code: '000000',
      }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      authService.verifyResetPasswordCode({
        email: validEmail,
        role: validRole,
        code: '000000',
      }),
    ).rejects.toThrow('Invalid verification code');
  });

  it('UT-04-15: Reject verify-reset expired code.', async () => {
    accountRepository.findAccountByEmail.mockResolvedValue(createAccount());
    codeVerificationRepository.findValidByUserIdAndCode.mockResolvedValue({
      _id: 'verification-1',
      expiredAt: new Date('2000-01-01T00:00:00.000Z'),
    });

    await expect(
      authService.verifyResetPasswordCode({
        email: validEmail,
        role: validRole,
        code: validCode,
      }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      authService.verifyResetPasswordCode({
        email: validEmail,
        role: validRole,
        code: validCode,
      }),
    ).rejects.toThrow('Verification code has expired');
  });

  it('UT-04-16: Reject reset-password invalid email.', async () => {
    await expectValidationMessage(
      ResetPasswordDto,
      {
        email: 'invalid-email',
        role: validRole,
        code: validCode,
        newPassword: strongPassword,
        confirmPassword: strongPassword,
      },
      'Invalid email format',
    );
  });

  it('UT-04-17: Reject reset-password role required.', async () => {
    await expectValidationMessage(
      ResetPasswordDto,
      {
        email: validEmail,
        role: '',
        code: validCode,
        newPassword: strongPassword,
        confirmPassword: strongPassword,
      },
      'Role is required',
    );
  });

  it('UT-04-18: Reject reset-password role not string.', async () => {
    await expectValidationMessage(
      ResetPasswordDto,
      {
        email: validEmail,
        role: 123,
        code: validCode,
        newPassword: strongPassword,
        confirmPassword: strongPassword,
      },
      'role must be a string',
    );
  });

  it('UT-04-19: Reject reset-password code required.', async () => {
    await expectValidationMessage(
      ResetPasswordDto,
      {
        email: validEmail,
        role: validRole,
        code: '',
        newPassword: strongPassword,
        confirmPassword: strongPassword,
      },
      'Reset code is required',
    );
  });

  it('UT-04-20: Reject reset-password code shorter than 6.', async () => {
    await expectValidationMessage(
      ResetPasswordDto,
      {
        email: validEmail,
        role: validRole,
        code: '12345',
        newPassword: strongPassword,
        confirmPassword: strongPassword,
      },
      'Reset code must be 6 digits',
    );
  });

  it('UT-04-21: Reject reset-password new password required.', async () => {
    await expectValidationMessage(
      ResetPasswordDto,
      {
        email: validEmail,
        role: validRole,
        code: validCode,
        newPassword: '',
        confirmPassword: '',
      },
      'New password is required',
    );
  });

  it('UT-04-22: Reject reset-password weak new password.', async () => {
    await expectValidationMessage(
      ResetPasswordDto,
      {
        email: validEmail,
        role: validRole,
        code: validCode,
        newPassword: 'NoSpecial123',
        confirmPassword: 'NoSpecial123',
      },
      'Password must be at least 8 characters and contain uppercase, lowercase, number, and special character',
    );
  });

  it('UT-04-23: Reject reset-password confirm password required.', async () => {
    await expectValidationMessage(
      ResetPasswordDto,
      {
        email: validEmail,
        role: validRole,
        code: validCode,
        newPassword: strongPassword,
        confirmPassword: '',
      },
      'Password confirmation is required',
    );
  });

  it('UT-04-24: Reject reset-password confirm mismatch.', async () => {
    await expectValidationMessage(
      ResetPasswordDto,
      {
        email: validEmail,
        role: validRole,
        code: validCode,
        newPassword: strongPassword,
        confirmPassword: 'DiffPwd@123',
      },
      'Passwords do not match',
    );
  });

  it('UT-04-25: Reject reset-password wrong or used reset code.', async () => {
    accountRepository.findAccountByEmail.mockResolvedValue(createAccount());
    codeVerificationRepository.findValidByUserIdAndCode.mockResolvedValue(null);

    await expect(
      accountsService.resetPasswordWithCode(
        validEmail,
        validRole,
        '000000',
        strongPassword,
      ),
    ).rejects.toThrow(UnauthorizedException);
    await expect(
      accountsService.resetPasswordWithCode(
        validEmail,
        validRole,
        '000000',
        strongPassword,
      ),
    ).rejects.toThrow('Invalid reset code. Please check and try again.');
  });

  it('UT-04-26: Reject reset-password expired reset code.', async () => {
    accountRepository.findAccountByEmail.mockResolvedValue(createAccount());
    codeVerificationRepository.findValidByUserIdAndCode.mockResolvedValue({
      _id: 'verification-1',
      expiredAt: new Date('2000-01-01T00:00:00.000Z'),
    });

    await expect(
      accountsService.resetPasswordWithCode(
        validEmail,
        validRole,
        validCode,
        strongPassword,
      ),
    ).rejects.toThrow(UnauthorizedException);
    await expect(
      accountsService.resetPasswordWithCode(
        validEmail,
        validRole,
        validCode,
        strongPassword,
      ),
    ).rejects.toThrow(
      'Reset code has expired (15 minutes). Please request password reset again.',
    );
  });

  it('UT-04-27: Accept strong password at exact length 8.', async () => {
    accountRepository.findAccountByEmail.mockResolvedValue(createAccount());
    codeVerificationRepository.findValidByUserIdAndCode.mockResolvedValue({
      _id: 'verification-1',
      expiredAt: new Date('2099-01-01T00:00:00.000Z'),
    });

    await authController.resetPassword({
      email: validEmail,
      role: validRole,
      code: validCode,
      newPassword: 'Aa1@bcde',
      confirmPassword: 'Aa1@bcde',
    });

    expect(mockedBcryptHash).toHaveBeenCalledWith('Aa1@bcde', 10);
  });

  it('UT-04-28: Reject strong-password rule at length 7.', async () => {
    await expectValidationMessage(
      ResetPasswordDto,
      {
        email: validEmail,
        role: validRole,
        code: validCode,
        newPassword: 'Aa1@bcd',
        confirmPassword: 'Aa1@bcd',
      },
      'Password must be at least 8 characters and contain uppercase, lowercase, number, and special character',
    );
  });
});
