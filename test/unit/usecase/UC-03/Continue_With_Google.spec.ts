import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { validate } from 'class-validator';
import * as bcrypt from 'bcrypt';

import { AccountsService } from '../../../../src/modules/accounts/accounts.service';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';
import { AccountStatus } from '../../../../src/modules/accounts/enums/account-status.enum';
import { AuthController } from '../../../../src/modules/auth/auth.controller';
import { SetInitialPasswordDto } from '../../../../src/modules/auth/dto/set-initial-password.dto';
import { AuthService } from '../../../../src/modules/auth/auth.service';
import { MailerService } from '../../../../src/modules/mailer/mailer.service';
import { SocketGatewayService } from '../../../../src/modules/socket-gateway/socket-gateway.service';
import { CodeVerificationRepository } from '../../../../src/modules/accounts/repositories/code-verification.repository';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
}));

describe('UC-03 Continue with Google', () => {
  let controller: AuthController;
  let service: AuthService;
  let accountsService: any;
  let jwtService: any;
  let socketGatewayService: any;
  let authServiceForController: any;
  let configService: any;

  const mockedBcryptHash = bcrypt.hash as jest.MockedFunction<typeof bcrypt.hash>;

  const createUser = (overrides: Record<string, any> = {}) => ({
    _id: 'patient-1',
    email: 'user@gmail.com',
    username: 'user',
    password: 'hashed-password',
    role: AccountRole.PATIENT,
    status: AccountStatus.ACTIVE,
    isEmailVerified: true,
    isOAuthUser: true,
    generalAccount: {
      fullName: 'John Doe',
      profilePicture: 'https://example.com/picture.jpg',
    },
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  });

  const validateSetInitialPasswordDto = async (payload: Record<string, any>) =>
    validate(Object.assign(new SetInitialPasswordDto(), payload));

  const expectDtoMessage = async (payload: Record<string, any>, message: string) => {
    const errors = await validateSetInitialPasswordDto(payload);
    const messages = errors.flatMap((error) => Object.values(error.constraints ?? {}));

    expect(messages).toContain(message);
  };

  beforeEach(async () => {
    accountsService = {
      findAccountWithGeneralByEmail: jest.fn(),
      createPatientViaOAuth: jest.fn(),
      saveAccount: jest.fn().mockResolvedValue(undefined),
      updateGeneralAccountEntity: jest.fn().mockResolvedValue(undefined),
      validateAccountAccess: jest.fn(),
      getSubscriptionPayloadForAccount: jest.fn().mockResolvedValue({}),
      findAccountWithGeneralById: jest.fn(),
      updateAccountEntity: jest.fn().mockResolvedValue(undefined),
      validateClinicSubscription: jest.fn().mockResolvedValue(undefined),
      getLoginOnboardingState: jest.fn().mockResolvedValue({ canAccessDashboard: true }),
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('signed-token'),
      verify: jest.fn(),
    };

    socketGatewayService = {
      markUserOnline: jest.fn(),
    };

    authServiceForController = {
      googleLogin: jest.fn(),
      setInitialPasswordForOAuthUser: jest.fn(),
    };

    configService = {
      get: jest.fn().mockReturnValue('https://frontend.example.com'),
    };

    const serviceModule: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AccountsService, useValue: accountsService },
        { provide: JwtService, useValue: jwtService },
        { provide: SocketGatewayService, useValue: socketGatewayService },
        { provide: CodeVerificationRepository, useValue: {} },
      ],
    }).compile();

    service = serviceModule.get(AuthService);

    const controllerModule: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authServiceForController },
        { provide: AccountsService, useValue: {} },
        { provide: MailerService, useValue: {} },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    controller = controllerModule.get(AuthController);
    mockedBcryptHash.mockReset();
    mockedBcryptHash.mockResolvedValue('new-hash' as never);
  });

  it('UT-03-01: Redirect existing PATIENT to frontend with access token.', async () => {
    authServiceForController.googleLogin.mockResolvedValue({
      accessToken: 'access-token',
      userId: 'patient-1',
    });
    const res = { redirect: jest.fn() };

    await controller.googleAuthRedirect({ user: { email: 'user@gmail.com' } }, res);

    expect(res.redirect).toHaveBeenCalledWith(
      'https://frontend.example.com/?token=access-token&userId=patient-1',
    );
  });

  it('UT-03-02: Redirect newly created OAuth PATIENT to frontend with setup token.', async () => {
    authServiceForController.googleLogin.mockResolvedValue({
      requirePasswordSetup: true,
      setupToken: 'setup-token',
      userId: 'patient-2',
    });
    const res = { redirect: jest.fn() };

    await controller.googleAuthRedirect({ user: { email: 'newuser@gmail.com' } }, res);

    expect(res.redirect).toHaveBeenCalledWith(
      'https://frontend.example.com/?requirePasswordSetup=true&setupToken=setup-token&userId=patient-2',
    );
  });

  it('UT-03-03: Set initial password successfully for OAuth account.', async () => {
    const user = createUser({ _id: 'oauth-user', password: null });
    jwtService.verify.mockReturnValue({ userId: 'oauth-user', type: 'INITIAL_PWD_SETUP' });
    accountsService.findAccountWithGeneralById.mockResolvedValue(user);

    const result = await service.setInitialPasswordForOAuthUser({
      token: 'valid-token',
      password: 'SecureP@ss123',
    });

    expect(accountsService.updateAccountEntity).toHaveBeenCalled();
    expect(socketGatewayService.markUserOnline).toHaveBeenCalledWith('oauth-user');
    expect(result.message).toBe(
      'Password set successfully. You can now login with email/password or Google.',
    );
  });

  it('UT-03-04: Reject missing callback payload.', async () => {
    await expect(service.googleLogin(null)).rejects.toThrow(UnauthorizedException);
    await expect(service.googleLogin(null)).rejects.toThrow('Invalid email or password');
  });

  it('UT-03-05: Reject Google payload without email.', async () => {
    await expect(
      service.googleLogin({ firstName: 'John', lastName: 'Doe', isEmailVerified: true }),
    ).rejects.toThrow('Google account does not provide an email address');
  });

  it('UT-03-06: Reject non-PATIENT Google login.', async () => {
    accountsService.findAccountWithGeneralByEmail.mockResolvedValue(
      createUser({ role: AccountRole.CLINIC_STAFF, email: 'staff@gmail.com' }),
    );

    await expect(
      service.googleLogin({
        email: 'staff@gmail.com',
        firstName: 'John',
        lastName: 'Doe',
        picture: 'https://lh3.googleusercontent.com/a1',
        isEmailVerified: true,
      }),
    ).rejects.toThrow(
      'Google login is only available for Patient accounts. Please log in using your registered email and password.',
    );
  });

  it('UT-03-07: Reject banned account.', async () => {
    accountsService.findAccountWithGeneralByEmail.mockResolvedValue(
      createUser({ status: AccountStatus.BAN, email: 'banned@gmail.com' }),
    );
    accountsService.validateAccountAccess.mockImplementation(() => {
      throw new ForbiddenException('Your account has been banned.');
    });

    await expect(
      service.googleLogin({ email: 'banned@gmail.com', isEmailVerified: true }),
    ).rejects.toThrow('Your account has been banned.');
  });

  it('UT-03-08: Reject deleted account.', async () => {
    accountsService.findAccountWithGeneralByEmail.mockResolvedValue(
      createUser({ status: AccountStatus.DELETED, email: 'deleted@gmail.com' }),
    );
    accountsService.validateAccountAccess.mockImplementation(() => {
      throw new UnauthorizedException(
        'Your account has been deleted. Please contact support for assistance.',
      );
    });

    await expect(
      service.googleLogin({ email: 'deleted@gmail.com', isEmailVerified: true }),
    ).rejects.toThrow(
      'Your account has been deleted. Please contact support for assistance.',
    );
  });

  it('UT-03-09: Reject malformed or expired setup token.', async () => {
    jwtService.verify.mockImplementation(() => {
      throw new Error('bad-token');
    });

    await expect(
      service.setInitialPasswordForOAuthUser({ token: 'bad-token', password: 'SecureP@ss123' }),
    ).rejects.toThrow('Invalid or expired setup token');
  });

  it('UT-03-10: Reject setup token with wrong type.', async () => {
    jwtService.verify.mockReturnValue({ userId: 'oauth-user', type: 'WRONG_TYPE' });

    await expect(
      service.setInitialPasswordForOAuthUser({ token: 'valid-token', password: 'SecureP@ss123' }),
    ).rejects.toThrow('Invalid token type');
  });

  it('UT-03-11: Reject setup token for missing user.', async () => {
    jwtService.verify.mockReturnValue({ userId: 'missing-user', type: 'INITIAL_PWD_SETUP' });
    accountsService.findAccountWithGeneralById.mockResolvedValue(null);

    await expect(
      service.setInitialPasswordForOAuthUser({ token: 'valid-token', password: 'SecureP@ss123' }),
    ).rejects.toThrow('User not found');
  });

  it('UT-03-12: Reject setup token for account that already has password.', async () => {
    jwtService.verify.mockReturnValue({ userId: 'oauth-user', type: 'INITIAL_PWD_SETUP' });
    accountsService.findAccountWithGeneralById.mockResolvedValue(createUser());

    await expect(
      service.setInitialPasswordForOAuthUser({ token: 'valid-token', password: 'SecureP@ss123' }),
    ).rejects.toThrow('This account already has a password set.');
  });

  it('UT-03-13: Reject setup token for non-OAuth account.', async () => {
    jwtService.verify.mockReturnValue({ userId: 'oauth-user', type: 'INITIAL_PWD_SETUP' });
    accountsService.findAccountWithGeneralById.mockResolvedValue(
      createUser({ password: null, isOAuthUser: false }),
    );

    await expect(
      service.setInitialPasswordForOAuthUser({ token: 'valid-token', password: 'SecureP@ss123' }),
    ).rejects.toThrow('This account does not require initial password setup');
  });

  it('UT-03-14: Reject clinic-role setup user without parent account.', async () => {
    jwtService.verify.mockReturnValue({ userId: 'manager-1', type: 'INITIAL_PWD_SETUP' });
    accountsService.findAccountWithGeneralById.mockResolvedValue(
      createUser({ password: null, role: AccountRole.CLINIC_MANAGER, parentId: null }),
    );
    accountsService.validateClinicSubscription.mockImplementation(() => {
      throw new ForbiddenException('Clinic subscription validation failed: No parent account found.');
    });

    await expect(
      service.setInitialPasswordForOAuthUser({ token: 'valid-token', password: 'SecureP@ss123' }),
    ).rejects.toThrow('Clinic subscription validation failed: No parent account found.');
  });

  it('UT-03-15: Reject clinic staff or doctor with invalid hierarchy.', async () => {
    jwtService.verify.mockReturnValue({ userId: 'doctor-1', type: 'INITIAL_PWD_SETUP' });
    accountsService.findAccountWithGeneralById.mockResolvedValue(
      createUser({ password: null, role: AccountRole.DOCTOR, parentId: 'manager-1' }),
    );
    accountsService.validateClinicSubscription.mockImplementation(() => {
      throw new ForbiddenException('Clinic subscription validation failed: Invalid account hierarchy.');
    });

    await expect(
      service.setInitialPasswordForOAuthUser({ token: 'valid-token', password: 'SecureP@ss123' }),
    ).rejects.toThrow('Clinic subscription validation failed: Invalid account hierarchy.');
  });

  it('UT-03-16: Reject missing clinic subscription.', async () => {
    jwtService.verify.mockReturnValue({ userId: 'admin-1', type: 'INITIAL_PWD_SETUP' });
    accountsService.findAccountWithGeneralById.mockResolvedValue(
      createUser({ password: null, role: AccountRole.CLINIC_ADMIN }),
    );
    accountsService.validateClinicSubscription.mockImplementation(() => {
      throw new ForbiddenException('Clinic subscription not found. Please contact support.');
    });

    await expect(
      service.setInitialPasswordForOAuthUser({ token: 'valid-token', password: 'SecureP@ss123' }),
    ).rejects.toThrow('Clinic subscription not found. Please contact support.');
  });

  it('UT-03-17: Reject clinic manager not ready.', async () => {
    jwtService.verify.mockReturnValue({ userId: 'manager-1', type: 'INITIAL_PWD_SETUP' });
    accountsService.findAccountWithGeneralById.mockResolvedValue(
      createUser({ password: null, role: AccountRole.CLINIC_MANAGER, parentId: 'admin-1' }),
    );
    accountsService.validateClinicSubscription.mockImplementation(() => {
      throw new ForbiddenException('Account is not ready or clinic is not active');
    });

    await expect(
      service.setInitialPasswordForOAuthUser({ token: 'valid-token', password: 'SecureP@ss123' }),
    ).rejects.toThrow('Account is not ready or clinic is not active');
  });

  it('UT-03-18: Reject clinic staff or doctor inactive subscription.', async () => {
    jwtService.verify.mockReturnValue({ userId: 'staff-1', type: 'INITIAL_PWD_SETUP' });
    accountsService.findAccountWithGeneralById.mockResolvedValue(
      createUser({ password: null, role: AccountRole.CLINIC_STAFF, parentId: 'manager-1' }),
    );
    accountsService.validateClinicSubscription.mockImplementation(() => {
      throw new ForbiddenException('Clinic subscription is not active or has expired.');
    });

    await expect(
      service.setInitialPasswordForOAuthUser({ token: 'valid-token', password: 'SecureP@ss123' }),
    ).rejects.toThrow('Clinic subscription is not active or has expired.');
  });

  it('UT-03-19: Reject empty setup token.', async () => {
    await expectDtoMessage(
      { token: '', password: 'SecureP@ss123' },
      'token should not be empty',
    );
  });

  it('UT-03-20: Reject non-string setup token.', async () => {
    await expectDtoMessage(
      { token: 123456, password: 'SecureP@ss123' },
      'token must be a string',
    );
  });

  it('UT-03-21: Reject empty initial password.', async () => {
    await expectDtoMessage({ token: 'valid-token', password: '' }, 'password should not be empty');
  });

  it('UT-03-22: Reject non-string initial password.', async () => {
    await expectDtoMessage(
      { token: 'valid-token', password: 12345678 },
      'password must be a string',
    );
  });

  it('UT-03-23: Reject initial password shorter than 8.', async () => {
    await expectDtoMessage(
      { token: 'valid-token', password: 'Abc1234' },
      'password must be longer than or equal to 8 characters',
    );
  });

  it('UT-03-24: Accept initial password at exact minimum length 8.', async () => {
    const user = createUser({ _id: 'oauth-user', password: null });
    jwtService.verify.mockReturnValue({ userId: 'oauth-user', type: 'INITIAL_PWD_SETUP' });
    accountsService.findAccountWithGeneralById.mockResolvedValue(user);

    const validationErrors = await validateSetInitialPasswordDto({
      token: 'valid-token',
      password: 'Abc12345',
    });
    const result = await service.setInitialPasswordForOAuthUser({
      token: 'valid-token',
      password: 'Abc12345',
    });

    expect(validationErrors).toHaveLength(0);
    expect(result.message).toBe(
      'Password set successfully. You can now login with email/password or Google.',
    );
  });
});
