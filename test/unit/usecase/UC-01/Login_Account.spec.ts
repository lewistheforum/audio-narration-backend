import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import * as bcrypt from 'bcrypt';

import { CodeVerificationRepository } from '../../../../src/modules/accounts/repositories/code-verification.repository';
import { AccountsService } from '../../../../src/modules/accounts/accounts.service';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';
import { AccountStatus } from '../../../../src/modules/accounts/enums/account-status.enum';
import { LegalDocumentVerificationStatus } from '../../../../src/modules/accounts/enums/legal-document-verification-status.enum';
import { AuthService } from '../../../../src/modules/auth/auth.service';
import { LoginDto } from '../../../../src/modules/auth/dto/login.dto';
import { SocketGatewayService } from '../../../../src/modules/socket-gateway/socket-gateway.service';
import { RegistrationStatus } from '../../../../src/modules/subscriptions/enums/subscription-status.enum';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
}));

describe('UC-01 Login Account', () => {
  let service: AuthService;
  let accountsService: {
    findLoginCandidatesByEmail: jest.Mock;
    validateAccountAccess: jest.Mock;
    getLoginOnboardingState: jest.Mock;
    getSubscriptionPayloadForAccount: jest.Mock;
  };
  let jwtService: { sign: jest.Mock };
  let socketGatewayService: { markUserOnline: jest.Mock };

  const mockedBcryptCompare = bcrypt.compare as jest.MockedFunction<
    typeof bcrypt.compare
  >;

  const createSubscription = (overrides: Record<string, any> = {}) => ({
    subscriptionStatus: RegistrationStatus.ACTIVE,
    expirationDate: new Date('2099-12-31T23:59:59.999Z'),
    ...overrides,
  });

  const createUser = (overrides: Record<string, any> = {}) => ({
    _id: 'user-1',
    email: 'patient@example.com',
    username: 'patient',
    password: '$2b$10$hash',
    role: AccountRole.PATIENT,
    status: AccountStatus.ACTIVE,
    isEmailVerified: true,
    isOAuthUser: false,
    parentId: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    generalAccount: {
      fullName: 'Test User',
      profilePicture: null,
    },
    subscription: undefined,
    parent: undefined,
    legalDocuments: undefined,
    ...overrides,
  });

  const createManagerUser = (overrides: Record<string, any> = {}) =>
    createUser({
      _id: 'manager-1',
      email: 'clinicmanager@example.com',
      role: AccountRole.CLINIC_MANAGER,
      parentId: 'admin-1',
      legalDocuments: {
        verificationStatus: LegalDocumentVerificationStatus.APPROVED,
      },
      parent: createUser({
        _id: 'admin-1',
        role: AccountRole.CLINIC_ADMIN,
        email: 'clinicadmin@example.com',
        subscription: createSubscription(),
      }),
      ...overrides,
    });

  const createStaffOrDoctorUser = (
    role: AccountRole.CLINIC_STAFF | AccountRole.DOCTOR,
    overrides: Record<string, any> = {},
  ) =>
    createUser({
      _id: role === AccountRole.DOCTOR ? 'doctor-1' : 'staff-1',
      email:
        role === AccountRole.DOCTOR
          ? 'doctor@example.com'
          : 'clinicstaff@example.com',
      role,
      parentId: 'manager-1',
      parent: createManagerUser({
        _id: 'manager-1',
        parent: createUser({
          _id: 'admin-1',
          role: AccountRole.CLINIC_ADMIN,
          email: 'clinicadmin@example.com',
          subscription: createSubscription(),
        }),
        legalDocuments: {
          verificationStatus: LegalDocumentVerificationStatus.APPROVED,
        },
      }),
      ...overrides,
    });

  const validateLoginDto = async (payload: Record<string, any>) =>
    validate(plainToInstance(LoginDto, payload));

  const expectValidationMessage = async (
    payload: Record<string, any>,
    message: string,
  ) => {
    const errors = await validateLoginDto(payload);
    const messages = errors.flatMap((error) =>
      Object.values(error.constraints ?? {}),
    );

    expect(messages).toContain(message);
  };

  const expectLoginFailure = async (
    dto: LoginDto,
    expectedError: new (...args: any[]) => Error,
    expectedMessage: string,
  ) => {
    await expect(service.login(dto)).rejects.toThrow(expectedError);
    await expect(service.login(dto)).rejects.toThrow(expectedMessage);
  };

  beforeEach(async () => {
    accountsService = {
      findLoginCandidatesByEmail: jest.fn(),
      validateAccountAccess: jest.fn(),
      getLoginOnboardingState: jest.fn().mockResolvedValue({
        canAccessDashboard: true,
      }),
      getSubscriptionPayloadForAccount: jest.fn().mockResolvedValue({}),
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('jwt-token'),
    };

    socketGatewayService = {
      markUserOnline: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AccountsService, useValue: accountsService },
        { provide: JwtService, useValue: jwtService },
        { provide: SocketGatewayService, useValue: socketGatewayService },
        { provide: CodeVerificationRepository, useValue: {} },
      ],
    }).compile();

    service = module.get(AuthService);
    mockedBcryptCompare.mockReset();
    mockedBcryptCompare.mockResolvedValue(true as never);
  });

  it('UT-01-01: Successful login - PATIENT/ADMIN with ACTIVE status, valid email/password', async () => {
    const user = createUser({
      _id: 'patient-1',
      email: 'patient@example.com',
      role: AccountRole.PATIENT,
    });

    accountsService.findLoginCandidatesByEmail.mockResolvedValue([user]);

    const result = await service.login({
      email: 'patient@example.com',
      password: 'ValidPass1!',
      role: AccountRole.PATIENT,
    });

    expect(result.message).toBe('User logged in successfully');
    expect(result.data.accessToken).toBe('jwt-token');
    expect(result.data.userId).toBe('patient-1');
    expect(socketGatewayService.markUserOnline).toHaveBeenCalledWith('patient-1');
  });

  it('UT-01-02: Successful login - CLINIC_ADMIN with ACTIVE status + ACTIVE subscription', async () => {
    const user = createUser({
      _id: 'admin-1',
      email: 'clinicadmin@example.com',
      role: AccountRole.CLINIC_ADMIN,
      subscription: createSubscription(),
    });

    accountsService.findLoginCandidatesByEmail.mockResolvedValue([user]);

    const result = await service.login({
      email: 'clinicadmin@example.com',
      password: 'ValidPass1!',
      role: AccountRole.CLINIC_ADMIN,
    });

    expect(result.message).toBe('User logged in successfully');
    expect(result.data.accessToken).toBe('jwt-token');
  });

  it('UT-01-03: Successful login - CLINIC_MANAGER with ACTIVE status + parent admin ACTIVE + legal docs APPROVED', async () => {
    const user = createManagerUser();

    accountsService.findLoginCandidatesByEmail.mockResolvedValue([user]);

    const result = await service.login({
      email: 'clinicmanager@example.com',
      password: 'ValidPass1!',
      role: AccountRole.CLINIC_MANAGER,
    });

    expect(result.message).toBe('User logged in successfully');
    expect(result.data.accessToken).toBe('jwt-token');
  });

  it('UT-01-04: Successful login - CLINIC_STAFF/DOCTOR with ACTIVE status + parent manager ACTIVE + root admin ACTIVE', async () => {
    const user = createStaffOrDoctorUser(AccountRole.CLINIC_STAFF);

    accountsService.findLoginCandidatesByEmail.mockResolvedValue([user]);

    const result = await service.login({
      email: 'clinicstaff@example.com',
      password: 'ValidPass1!',
      role: AccountRole.CLINIC_STAFF,
    });

    expect(result.message).toBe('User logged in successfully');
    expect(result.data.accessToken).toBe('jwt-token');
  });

  it('UT-01-05: Login with UNVERIFIED status - allowed with warning message', async () => {
    const user = createUser({
      _id: 'patient-2',
      email: 'patient@example.com',
      role: AccountRole.PATIENT,
      status: AccountStatus.UNVERIFIED,
    });

    accountsService.findLoginCandidatesByEmail.mockResolvedValue([user]);

    const result = await service.login({
      email: 'patient@example.com',
      password: 'ValidPass1!',
      role: AccountRole.PATIENT,
    });

    expect(result.message).toBe(
      'Login successful. Please verify your email address to access full features.',
    );
  });

  it('UT-01-06: Missing email (null) - 400 "Email is required"', async () => {
    await expectValidationMessage(
      { email: null, role: AccountRole.PATIENT, password: 'ValidPass1!' },
      'Email is required',
    );
  });

  it('UT-01-07: Invalid email format "invalid-email-format" - 400 "Invalid email format"', async () => {
    await expectValidationMessage(
      {
        email: 'invalid-email-format',
        role: AccountRole.PATIENT,
        password: 'ValidPass1!',
      },
      'Invalid email format',
    );
  });

  it('UT-01-08: Missing role (null) - 400 "Role is required"', async () => {
    await expectValidationMessage(
      { email: 'patient@example.com', role: null, password: 'ValidPass1!' },
      'Role is required',
    );
  });

  it('UT-01-09: Missing password (null) - 400 "Password is required"', async () => {
    await expectValidationMessage(
      { email: 'patient@example.com', role: AccountRole.PATIENT, password: null },
      'Password is required',
    );
  });

  it('UT-01-10: Password too short "abc" (3 chars) / "abcde" (5 chars) - 400 "Password must be at least 6 characters"', async () => {
    await expectValidationMessage(
      { email: 'patient@example.com', role: AccountRole.PATIENT, password: 'abc' },
      'Password must be at least 6 characters',
    );

    await expectValidationMessage(
      {
        email: 'patient@example.com',
        role: AccountRole.PATIENT,
        password: 'abcde',
      },
      'Password must be at least 6 characters',
    );
  });

  it('UT-01-11: Password too long (51 chars) - 400 "Password must not exceed 50 characters"', async () => {
    await expectValidationMessage(
      {
        email: 'patient@example.com',
        role: AccountRole.PATIENT,
        password: 'A'.repeat(51),
      },
      'Password must not exceed 50 characters',
    );
  });

  it('UT-01-12: Wrong password "WrongPass1!" / Empty password "" - 401 "Invalid email or password"', async () => {
    const user = createUser();
    accountsService.findLoginCandidatesByEmail.mockResolvedValue([user]);
    mockedBcryptCompare.mockResolvedValue(false as never);

    await expectLoginFailure(
      {
        email: 'patient@example.com',
        password: 'WrongPass1!',
        role: AccountRole.PATIENT,
      },
      UnauthorizedException,
      'Invalid email or password',
    );

    await expectLoginFailure(
      {
        email: 'patient@example.com',
        password: '',
        role: AccountRole.PATIENT,
      },
      UnauthorizedException,
      'Invalid email or password',
    );
  });

  it('UT-01-13: No account belonging to requested role - 401 "No account belonging to this role was found."', async () => {
    accountsService.findLoginCandidatesByEmail.mockResolvedValue([]);

    await expectLoginFailure(
      {
        email: 'patient@example.com',
        password: 'ValidPass1!',
        role: AccountRole.PATIENT,
      },
      UnauthorizedException,
      'No account belonging to this role was found.',
    );
  });

  it('UT-01-14: Role mismatch (resolved account role differs from requested) - 401 "This Account have not permission to login."', async () => {
    const user = createUser({ role: AccountRole.ADMIN, email: 'admin@example.com' });
    accountsService.findLoginCandidatesByEmail.mockResolvedValue([user]);

    await expectLoginFailure(
      {
        email: 'admin@example.com',
        password: 'ValidPass1!',
        role: AccountRole.PATIENT,
      },
      UnauthorizedException,
      'This Account have not permission to login.',
    );
  });

  it('UT-01-15: Banned account (status = BAN) - 403 "Your account has been banned."', async () => {
    const user = createUser({ status: AccountStatus.BAN });
    accountsService.findLoginCandidatesByEmail.mockResolvedValue([user]);
    accountsService.validateAccountAccess.mockImplementation(() => {
      throw new ForbiddenException('Your account has been banned.');
    });

    await expectLoginFailure(
      { email: 'patient@example.com', password: 'ValidPass1!', role: AccountRole.PATIENT },
      ForbiddenException,
      'Your account has been banned.',
    );
  });

  it('UT-01-16: Deleted account (status = DELETED) - 401 "Your account has been deleted. Please contact support for assistance."', async () => {
    const user = createUser({ status: AccountStatus.DELETED });
    accountsService.findLoginCandidatesByEmail.mockResolvedValue([user]);
    accountsService.validateAccountAccess.mockImplementation(() => {
      throw new UnauthorizedException(
        'Your account has been deleted. Please contact support for assistance.',
      );
    });

    await expectLoginFailure(
      { email: 'patient@example.com', password: 'ValidPass1!', role: AccountRole.PATIENT },
      UnauthorizedException,
      'Your account has been deleted. Please contact support for assistance.',
    );
  });

  it('UT-01-17: CLINIC_ADMIN with inactive subscription - 403 "Clinic subscription is not active. Please renew or complete the registration flow."', async () => {
    const user = createUser({
      role: AccountRole.CLINIC_ADMIN,
      email: 'clinicadmin@example.com',
      subscription: createSubscription({ subscriptionStatus: RegistrationStatus.PENDING_PAYMENT }),
    });
    accountsService.findLoginCandidatesByEmail.mockResolvedValue([user]);

    await expectLoginFailure(
      {
        email: 'clinicadmin@example.com',
        password: 'ValidPass1!',
        role: AccountRole.CLINIC_ADMIN,
      },
      ForbiddenException,
      'Clinic subscription is not active. Please renew or complete the registration flow.',
    );
  });

  it('UT-01-18: CLINIC_MANAGER with MANAGER_DISABLED - 403 "Your clinic branch has been temporarily disabled. Please contact your clinic administrator."', async () => {
    const user = createManagerUser({ status: AccountStatus.MANAGER_DISABLED });
    accountsService.findLoginCandidatesByEmail.mockResolvedValue([user]);

    await expectLoginFailure(
      {
        email: 'clinicmanager@example.com',
        password: 'ValidPass1!',
        role: AccountRole.CLINIC_MANAGER,
      },
      ForbiddenException,
      'Your clinic branch has been temporarily disabled. Please contact your clinic administrator.',
    );
  });

  it('UT-01-19: CLINIC_MANAGER with parent admin BAN - 403 "The clinic network has been suspended. Please contact support for assistance."', async () => {
    const user = createManagerUser({
      parent: createUser({ role: AccountRole.CLINIC_ADMIN, status: AccountStatus.BAN }),
    });
    accountsService.findLoginCandidatesByEmail.mockResolvedValue([user]);

    await expectLoginFailure(
      {
        email: 'clinicmanager@example.com',
        password: 'ValidPass1!',
        role: AccountRole.CLINIC_MANAGER,
      },
      ForbiddenException,
      'The clinic network has been suspended. Please contact support for assistance.',
    );
  });

  it('UT-01-20: CLINIC_MANAGER with parent admin DELETED - 403 "The clinic network has been deleted. Please contact support."', async () => {
    const user = createManagerUser({
      parent: createUser({ role: AccountRole.CLINIC_ADMIN, status: AccountStatus.DELETED }),
    });
    accountsService.findLoginCandidatesByEmail.mockResolvedValue([user]);

    await expectLoginFailure(
      {
        email: 'clinicmanager@example.com',
        password: 'ValidPass1!',
        role: AccountRole.CLINIC_MANAGER,
      },
      ForbiddenException,
      'The clinic network has been deleted. Please contact support.',
    );
  });

  it('UT-01-21: CLINIC_MANAGER with parent subscription inactive - 403 "The parent clinic subscription is not active. Please contact the clinic administrator."', async () => {
    const user = createManagerUser({
      parent: createUser({
        role: AccountRole.CLINIC_ADMIN,
        subscription: createSubscription({ subscriptionStatus: RegistrationStatus.EXPIRED }),
      }),
    });
    accountsService.findLoginCandidatesByEmail.mockResolvedValue([user]);

    await expectLoginFailure(
      {
        email: 'clinicmanager@example.com',
        password: 'ValidPass1!',
        role: AccountRole.CLINIC_MANAGER,
      },
      ForbiddenException,
      'The parent clinic subscription is not active. Please contact the clinic administrator.',
    );
  });

  it('UT-01-22: CLINIC_MANAGER with unapproved legal docs - 403 "Manager legal documents are not approved yet. Dashboard access is blocked."', async () => {
    const user = createManagerUser({
      legalDocuments: {
        verificationStatus: LegalDocumentVerificationStatus.PENDING_REVIEW,
      },
    });
    accountsService.findLoginCandidatesByEmail.mockResolvedValue([user]);

    await expectLoginFailure(
      {
        email: 'clinicmanager@example.com',
        password: 'ValidPass1!',
        role: AccountRole.CLINIC_MANAGER,
      },
      ForbiddenException,
      'Manager legal documents are not approved yet. Dashboard access is blocked.',
    );
  });

  it('UT-01-23: CLINIC_STAFF/DOCTOR with parent manager BAN - 403 "Your clinic branch has been suspended. Please contact support."', async () => {
    const user = createStaffOrDoctorUser(AccountRole.CLINIC_STAFF, {
      parent: createManagerUser({ status: AccountStatus.BAN }),
    });
    accountsService.findLoginCandidatesByEmail.mockResolvedValue([user]);

    await expectLoginFailure(
      {
        email: 'clinicstaff@example.com',
        password: 'ValidPass1!',
        role: AccountRole.CLINIC_STAFF,
      },
      ForbiddenException,
      'Your clinic branch has been suspended. Please contact support.',
    );
  });

  it('UT-01-24: CLINIC_STAFF/DOCTOR with parent manager MANAGER_DISABLED - 403 "Your clinic branch has been temporarily disabled. Please contact your clinic administrator."', async () => {
    const user = createStaffOrDoctorUser(AccountRole.DOCTOR, {
      email: 'doctor@example.com',
      parent: createManagerUser({ status: AccountStatus.MANAGER_DISABLED }),
    });
    accountsService.findLoginCandidatesByEmail.mockResolvedValue([user]);

    await expectLoginFailure(
      {
        email: 'doctor@example.com',
        password: 'ValidPass1!',
        role: AccountRole.DOCTOR,
      },
      ForbiddenException,
      'Your clinic branch has been temporarily disabled. Please contact your clinic administrator.',
    );
  });

  it('UT-01-25: CLINIC_STAFF/DOCTOR with root admin BAN - 403 "The clinic network has been suspended. Please contact support for assistance."', async () => {
    const user = createStaffOrDoctorUser(AccountRole.CLINIC_STAFF, {
      parent: createManagerUser({
        parent: createUser({ role: AccountRole.CLINIC_ADMIN, status: AccountStatus.BAN }),
      }),
    });
    accountsService.findLoginCandidatesByEmail.mockResolvedValue([user]);

    await expectLoginFailure(
      {
        email: 'clinicstaff@example.com',
        password: 'ValidPass1!',
        role: AccountRole.CLINIC_STAFF,
      },
      ForbiddenException,
      'The clinic network has been suspended. Please contact support for assistance.',
    );
  });

  it('UT-01-26: CLINIC_STAFF/DOCTOR with root subscription inactive - 403 "The root clinic subscription is not active. Please contact the clinic administrator."', async () => {
    const user = createStaffOrDoctorUser(AccountRole.DOCTOR, {
      email: 'doctor@example.com',
      parent: createManagerUser({
        parent: createUser({
          role: AccountRole.CLINIC_ADMIN,
          subscription: createSubscription({ subscriptionStatus: RegistrationStatus.EXPIRED }),
        }),
      }),
    });
    accountsService.findLoginCandidatesByEmail.mockResolvedValue([user]);

    await expectLoginFailure(
      {
        email: 'doctor@example.com',
        password: 'ValidPass1!',
        role: AccountRole.DOCTOR,
      },
      ForbiddenException,
      'The root clinic subscription is not active. Please contact the clinic administrator.',
    );
  });

  it('UT-01-27: DOCTOR with parent manager unapproved legal docs - 403 "Parent manager legal documents are not approved yet. Dashboard access is blocked."', async () => {
    const user = createStaffOrDoctorUser(AccountRole.DOCTOR, {
      email: 'doctor@example.com',
      parent: createManagerUser({
        legalDocuments: {
          verificationStatus: LegalDocumentVerificationStatus.PENDING_REVIEW,
        },
      }),
    });
    accountsService.findLoginCandidatesByEmail.mockResolvedValue([user]);

    await expectLoginFailure(
      {
        email: 'doctor@example.com',
        password: 'ValidPass1!',
        role: AccountRole.DOCTOR,
      },
      ForbiddenException,
      'Parent manager legal documents are not approved yet. Dashboard access is blocked.',
    );
  });

  it('UT-01-28: CLINIC_STAFF/DOCTOR with root admin missing - 403 "Account hierarchy error. No root clinic admin found."', async () => {
    const user = createStaffOrDoctorUser(AccountRole.CLINIC_STAFF, {
      parent: createManagerUser({ parent: null }),
    });
    accountsService.findLoginCandidatesByEmail.mockResolvedValue([user]);

    await expectLoginFailure(
      {
        email: 'clinicstaff@example.com',
        password: 'ValidPass1!',
        role: AccountRole.CLINIC_STAFF,
      },
      ForbiddenException,
      'Account hierarchy error. No root clinic admin found.',
    );
  });

  it('UT-01-29: Multiple accounts matched (same email/password, no CLINIC_ADMIN) - 401 "Multiple accounts matched this email and password. Please contact support."', async () => {
    accountsService.findLoginCandidatesByEmail.mockResolvedValue([
      createUser({ _id: 'patient-1', role: AccountRole.PATIENT }),
      createUser({ _id: 'doctor-1', role: AccountRole.DOCTOR }),
    ]);

    await expectLoginFailure(
      { email: 'patient@example.com', password: 'ValidPass1!', role: AccountRole.PATIENT },
      UnauthorizedException,
      'Multiple accounts matched this email and password. Please contact support.',
    );
  });

  it('UT-01-30: Password exactly 6 characters "Abc123" (minimum boundary) - 200 Success', async () => {
    const user = createUser();
    accountsService.findLoginCandidatesByEmail.mockResolvedValue([user]);

    const validationErrors = await validateLoginDto({
      email: 'patient@example.com',
      role: AccountRole.PATIENT,
      password: 'Abc123',
    });
    const result = await service.login({
      email: 'patient@example.com',
      role: AccountRole.PATIENT,
      password: 'Abc123',
    });

    expect(validationErrors).toHaveLength(0);
    expect(result.message).toBe('User logged in successfully');
  });

  it('UT-01-31: Password exactly 50 characters (maximum boundary) - 200 Success', async () => {
    const user = createUser();
    const password = 'A'.repeat(50);
    accountsService.findLoginCandidatesByEmail.mockResolvedValue([user]);

    const validationErrors = await validateLoginDto({
      email: 'patient@example.com',
      role: AccountRole.PATIENT,
      password,
    });
    const result = await service.login({
      email: 'patient@example.com',
      role: AccountRole.PATIENT,
      password,
    });

    expect(validationErrors).toHaveLength(0);
    expect(result.message).toBe('User logged in successfully');
  });

  it('UT-01-32: Email with mixed case " Patient@Example.COM " - auto-lowercased/trimmed, 200 Success', async () => {
    const instance = plainToInstance(LoginDto, {
      email: ' Patient@Example.COM ',
      role: AccountRole.PATIENT,
      password: 'ValidPass1!',
    });
    const user = createUser({ email: 'patient@example.com' });
    accountsService.findLoginCandidatesByEmail.mockResolvedValue([user]);

    const result = await service.login(instance);

    expect(instance.email).toBe('patient@example.com');
    expect(accountsService.findLoginCandidatesByEmail).toHaveBeenCalledWith(
      'patient@example.com',
      AccountRole.PATIENT,
    );
    expect(result.message).toBe('User logged in successfully');
  });

  it('UT-01-33: CLINIC_ADMIN with NON_RENEWING subscription - 200 Success (allowed to access)', async () => {
    const user = createUser({
      role: AccountRole.CLINIC_ADMIN,
      email: 'clinicadmin@example.com',
      subscription: createSubscription({ subscriptionStatus: RegistrationStatus.NON_RENEWING }),
    });
    accountsService.findLoginCandidatesByEmail.mockResolvedValue([user]);

    const result = await service.login({
      email: 'clinicadmin@example.com',
      password: 'ValidPass1!',
      role: AccountRole.CLINIC_ADMIN,
    });

    expect(result.message).toBe('User logged in successfully');
  });

  it('UT-01-34: CLINIC_ADMIN with EXPIRED subscription - 200 Success (allowed for renewal access)', async () => {
    const user = createUser({
      role: AccountRole.CLINIC_ADMIN,
      email: 'clinicadmin@example.com',
      subscription: createSubscription({ subscriptionStatus: RegistrationStatus.EXPIRED }),
    });
    accountsService.findLoginCandidatesByEmail.mockResolvedValue([user]);
    accountsService.getLoginOnboardingState.mockResolvedValue({
      onboardingStatus: RegistrationStatus.PENDING_PAYMENT,
      canAccessDashboard: false,
    });

    const result = await service.login({
      email: 'clinicadmin@example.com',
      password: 'ValidPass1!',
      role: AccountRole.CLINIC_ADMIN,
    });

    expect(result.message).toBe('User logged in successfully');
    expect(result.data.canAccessDashboard).toBe(false);
  });

  it('UT-01-35: Password exactly 51 characters (just above maximum) - 400 "Password must not exceed 50 characters"', async () => {
    await expectValidationMessage(
      {
        email: 'patient@example.com',
        role: AccountRole.PATIENT,
        password: 'A'.repeat(51),
      },
      'Password must not exceed 50 characters',
    );
  });
});
