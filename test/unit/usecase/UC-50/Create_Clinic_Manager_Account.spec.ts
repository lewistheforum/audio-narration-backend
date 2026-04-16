import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import * as bcrypt from 'bcrypt';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { AccountsService } from '../../../../src/modules/accounts/accounts.service';
import { CreateClinicManagerForRegistrationDto } from '../../../../src/modules/accounts/dto/create-clinic-manager-for-registration.dto';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';
import { AccountStatus } from '../../../../src/modules/accounts/enums/account-status.enum';
import { Gender } from '../../../../src/modules/accounts/enums/gender.enum';
import { LegalDocumentVerificationStatus } from '../../../../src/modules/accounts/enums/legal-document-verification-status.enum';
import { AuthController } from '../../../../src/modules/auth/auth.controller';
import { RegistrationStatus } from '../../../../src/modules/subscriptions/enums/subscription-status.enum';
import * as utilModule from '../../../../src/common/utils/util';

describe('UC-50 Create Clinic Manager Account', () => {
  const baseDto = {
    username: 'manager_john',
    email: 'manager@clinic.com',
    password: 'ManagerPass123',
    phone: '0899798602',
    clinicBranchName: 'Main Branch',
    fullName: 'John Smith',
    gender: Gender.MALE,
    profilePicture: 'https://example.com/avatar.jpg',
    dob: '1985-05-15',
    addressDetail: '123 Nguyen Hue Street',
    wardCode: '00001',
    wardName: 'Ben Nghe Ward',
    districtCode: '001',
    districtName: 'District 1',
    provinceCode: '01',
    provinceName: 'Ho Chi Minh City',
    idCardNumber: '123456789012',
    idCardFrontUrl: 'https://example.com/id-front.jpg',
    idCardBackUrl: 'https://example.com/id-back.jpg',
  };

  const createServiceContext = () => {
    const queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        save: jest.fn().mockImplementation(async (value: any) => {
          if (value.role === AccountRole.CLINIC_MANAGER) {
            return { _id: 'manager-1', ...value };
          }

          return value;
        }),
        create: jest.fn().mockImplementation((_entity: any, value: any) => value),
        getRepository: jest.fn().mockReturnValue({
          createQueryBuilder: jest.fn().mockReturnValue({
            addSelect: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            getOne: jest.fn().mockResolvedValue({
              _id: 'admin-1',
              password: bcrypt.hashSync('AdminPass123', 1),
            }),
          }),
        }),
      },
    };

    return {
      queryRunner,
      serviceContext: {
        BCRYPT_SALT_ROUNDS: 1,
        dataSource: {
          createQueryRunner: jest.fn().mockReturnValue(queryRunner),
        },
        getClinicAdminRegistrationState: jest.fn().mockResolvedValue({
          clinicAdminRole: AccountRole.CLINIC_ADMIN,
          subscriptionId: 'subscription-1',
          subscriptionStatus: RegistrationStatus.PENDING_MANAGER_SETUP,
          managerCount: 0,
          clinicName: 'Clinic A',
        }),
        findRegistrationAccountsByEmail: jest.fn().mockResolvedValue([]),
        accountRepository: {
          createAccount: jest.fn().mockImplementation((value: any) => value),
        },
        clinicManagerInfoRepository: {
          create: jest.fn().mockImplementation((value: any) => value),
        },
        addressRepository: {
          create: jest.fn().mockImplementation((value: any) => value),
        },
        clinicLegalDocsRepository: {
          create: jest.fn().mockImplementation((value: any) => value),
        },
        mailerService: {
          sendManagerCredentialsEmail: jest.fn().mockResolvedValue(undefined),
        },
      } as any,
    };
  };

  const collectMessages = async (dto: object) => {
    const errors = await validate(plainToInstance(CreateClinicManagerForRegistrationDto, dto));
    return errors.flatMap((error) => Object.values(error.constraints ?? {}));
  };

  beforeEach(() => {
    jest.spyOn(utilModule, 'generateRSAKeyPair').mockReturnValue({
      publicKey: 'public-key',
      privateKey: 'encrypted-private-key',
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('UT-50-01: Create clinic manager successfully with full valid payload.', async () => {
    const { serviceContext } = createServiceContext();

    const result = await AccountsService.prototype.createClinicManagerForRegistration.call(
      serviceContext,
      'admin-1',
      baseDto,
    );

    expect(result).toMatchObject({
      email: 'manager@clinic.com',
      username: 'manager_john',
      role: AccountRole.CLINIC_MANAGER,
      status: AccountStatus.PENDING_APPROVAL,
    });
    expect(serviceContext.mailerService.sendManagerCredentialsEmail).toHaveBeenCalledWith(
      'manager@clinic.com',
      'manager_john',
      'ManagerPass123',
      'Clinic A',
    );
  });

  it('UT-50-02: Create clinic manager successfully without optional profilePicture.', async () => {
    const { serviceContext } = createServiceContext();

    await AccountsService.prototype.createClinicManagerForRegistration.call(serviceContext, 'admin-1', {
      ...baseDto,
      profilePicture: undefined,
    });

    expect(serviceContext.clinicManagerInfoRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ profilePicture: undefined }),
    );
  });

  it('UT-50-03: Reject request without JWT.', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      AuthController.prototype.createClinicManagerForRegistration,
    );

    expect(guards).toHaveLength(2);
  });

  it('UT-50-04: Non-admin role rejected.', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      AuthController.prototype.createClinicManagerForRegistration,
    );

    expect(roles).toEqual([AccountRole.CLINIC_ADMIN]);
  });

  it('UT-50-05: DTO validation rejects missing or invalid required fields.', async () => {
    const messages = await collectMessages({
      email: 'manager_at_clinic.com',
      phone: '19999',
      gender: 1,
    });
    const missingMessages = await collectMessages({});

    expect(missingMessages).toContain('Username is required');
    expect(messages).toContain('Invalid email format');
    expect(missingMessages).toContain('Password is required');
    expect(messages).toContain('Phone number must be exactly 10 digits and start with 0');
    expect(missingMessages).toContain('Clinic branch name is required');
    expect(missingMessages).toContain('Full name is required');
    expect(messages).toContain('Gender must be a string');
    expect(missingMessages).toContain('Date of birth is required');
  });

  it('UT-50-06: Reject when role check inside service fails.', async () => {
    const { serviceContext } = createServiceContext();
    serviceContext.getClinicAdminRegistrationState.mockResolvedValue({
      clinicAdminRole: AccountRole.CLINIC_MANAGER,
      subscriptionId: 'subscription-1',
      subscriptionStatus: RegistrationStatus.PENDING_MANAGER_SETUP,
      managerCount: 0,
    });

    await expect(
      AccountsService.prototype.createClinicManagerForRegistration.call(serviceContext, 'admin-1', baseDto),
    ).rejects.toThrow(
      new ForbiddenException('Only clinic admins can create clinic managers during registration'),
    );
  });

  it('UT-50-07: Reject when clinic subscription does not exist.', async () => {
    const { serviceContext } = createServiceContext();
    serviceContext.getClinicAdminRegistrationState.mockResolvedValue({
      clinicAdminRole: AccountRole.CLINIC_ADMIN,
      subscriptionId: null,
      subscriptionStatus: RegistrationStatus.PENDING_MANAGER_SETUP,
      managerCount: 0,
    });

    await expect(
      AccountsService.prototype.createClinicManagerForRegistration.call(serviceContext, 'admin-1', baseDto),
    ).rejects.toThrow(new NotFoundException('Clinic subscription not found'));
  });

  it('UT-50-08: Reject when subscription status is not PENDING_MANAGER_SETUP.', async () => {
    const { serviceContext } = createServiceContext();
    serviceContext.getClinicAdminRegistrationState.mockResolvedValue({
      clinicAdminRole: AccountRole.CLINIC_ADMIN,
      subscriptionId: 'subscription-1',
      subscriptionStatus: RegistrationStatus.ACTIVE,
      managerCount: 0,
    });

    await expect(
      AccountsService.prototype.createClinicManagerForRegistration.call(serviceContext, 'admin-1', baseDto),
    ).rejects.toThrow(
      new ForbiddenException(
        `Cannot create clinic manager. Current status: ${RegistrationStatus.ACTIVE}. Expected: ${RegistrationStatus.PENDING_MANAGER_SETUP}`,
      ),
    );
  });

  it('UT-50-09: Reject when manager already exists for admin.', async () => {
    const { serviceContext } = createServiceContext();
    serviceContext.getClinicAdminRegistrationState.mockResolvedValue({
      clinicAdminRole: AccountRole.CLINIC_ADMIN,
      subscriptionId: 'subscription-1',
      subscriptionStatus: RegistrationStatus.PENDING_MANAGER_SETUP,
      managerCount: 1,
    });

    await expect(
      AccountsService.prototype.createClinicManagerForRegistration.call(serviceContext, 'admin-1', baseDto),
    ).rejects.toThrow(new ConflictException('Only one clinic manager is allowed per clinic admin'));
  });

  it('UT-50-10: Reject email conflict with existing accounts.', async () => {
    const { serviceContext } = createServiceContext();
    serviceContext.findRegistrationAccountsByEmail.mockResolvedValue([
      { _id: 'patient-1', role: AccountRole.PATIENT },
    ]);

    await expect(
      AccountsService.prototype.createClinicManagerForRegistration.call(serviceContext, 'admin-1', {
        ...baseDto,
        email: 'existing@system.com',
      }),
    ).rejects.toThrow(
      new ConflictException(
        'This email is already registered in the system and cannot be used for this role.',
      ),
    );
  });

  it('UT-50-11: Reject when clinic admin account with password cannot be loaded.', async () => {
    const { serviceContext, queryRunner } = createServiceContext();
    queryRunner.manager.getRepository.mockReturnValue({
      createQueryBuilder: jest.fn().mockReturnValue({
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      }),
    });

    await expect(
      AccountsService.prototype.createClinicManagerForRegistration.call(serviceContext, 'admin-1', baseDto),
    ).rejects.toThrow(new NotFoundException('Clinic admin account not found'));
  });

  it('UT-50-12: Reject when manager password equals clinic admin password.', async () => {
    const { serviceContext } = createServiceContext();

    await expect(
      AccountsService.prototype.createClinicManagerForRegistration.call(serviceContext, 'admin-1', {
        ...baseDto,
        password: 'AdminPass123',
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'Mật khẩu của Quản lý không được trùng với mật khẩu của Chủ phòng khám (Clinic Admin)',
      ),
    );
  });

  it('UT-50-13: Reject phone regex violation.', async () => {
    const messages = await collectMessages({
      ...baseDto,
      phone: '19999',
    });

    expect(messages).toContain('Phone number must be exactly 10 digits and start with 0');
  });

  it('UT-50-14: Reject DTO boundary overflows and underflows.', async () => {
    const messages = await collectMessages({
      ...baseDto,
      username: 'a'.repeat(101),
      password: 'A'.repeat(51),
      clinicBranchName: 'A'.repeat(256),
      fullName: 'A',
      addressDetail: 'A'.repeat(501),
      wardName: 'A'.repeat(256),
      districtName: 'A'.repeat(256),
      provinceName: 'A'.repeat(256),
      idCardNumber: '1234567890123',
    });

    expect(messages).toContain('Username must not exceed 100 characters');
    expect(messages).toContain('Password must not exceed 50 characters');
    expect(messages).toContain('Clinic branch name must not exceed 255 characters');
    expect(messages).toContain('Full name must be at least 2 characters');
    expect(messages).toContain('Street address must not exceed 500 characters');
    expect(messages).toContain('Ward name must not exceed 255 characters');
    expect(messages).toContain('District name must not exceed 255 characters');
    expect(messages).toContain('Province name must not exceed 255 characters');
    expect(messages).toContain('ID card number must not exceed 12 characters');
  });

  it('UT-50-15: Reject invalid ISO date in dob.', async () => {
    const messages = await collectMessages({
      ...baseDto,
      dob: '1985-15-99',
    });

    expect(messages).toContain('Date of birth must be a valid date string');
  });

  it('UT-50-16: Roll back transaction when persistence fails.', async () => {
    const { serviceContext, queryRunner } = createServiceContext();
    queryRunner.manager.save.mockRejectedValueOnce(new Error('db failed'));

    await expect(
      AccountsService.prototype.createClinicManagerForRegistration.call(serviceContext, 'admin-1', baseDto),
    ).rejects.toThrow('db failed');
    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
  });

  it('UT-50-17: Accept maximum valid boundary values.', async () => {
    const messages = await collectMessages({
      ...baseDto,
      username: 'a'.repeat(100),
      password: 'A'.repeat(50),
      clinicBranchName: 'A'.repeat(255),
      fullName: 'A'.repeat(255),
      addressDetail: 'A'.repeat(500),
      wardName: 'A'.repeat(255),
      districtName: 'A'.repeat(255),
      provinceName: 'A'.repeat(255),
      idCardNumber: '123456789012',
    });

    expect(messages).toEqual([]);
  });

  it('UT-50-18: Accept minimum valid boundary values.', async () => {
    const { serviceContext } = createServiceContext();

    const result = await AccountsService.prototype.createClinicManagerForRegistration.call(
      serviceContext,
      'admin-1',
      {
        ...baseDto,
        username: 'abc',
        password: 'abc123',
        fullName: 'Ab',
        idCardNumber: '123456789',
      },
    );

    expect(result.username).toBe('abc');
  });
});
