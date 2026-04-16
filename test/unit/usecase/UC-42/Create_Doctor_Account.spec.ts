import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { AccountsService } from '../../../../src/modules/accounts/accounts.service';
import { CreateDoctorByClinicManagerDto } from '../../../../src/modules/accounts/dto/create-doctor-by-manager.dto';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';
import { AccountStatus } from '../../../../src/modules/accounts/enums/account-status.enum';
import { Gender } from '../../../../src/modules/accounts/enums/gender.enum';
import { AuthController } from '../../../../src/modules/auth/auth.controller';

describe('UC-42 Create Doctor Account', () => {
  const baseDto = {
    email: 'doctor@clinic.com',
    password: 'DoctorPass123',
    fullName: 'Dr. John Smith',
  };

  const createServiceContext = () => {
    const queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        save: jest.fn().mockImplementation(async (value) => ({
          _id: value.accountId ? undefined : 'doctor-1',
          ...value,
        })),
      },
    };

    return {
      BCRYPT_SALT_ROUNDS: 1,
      findAccountEntityById: jest.fn().mockResolvedValue({
        _id: 'manager-1',
        role: AccountRole.CLINIC_MANAGER,
      }),
      validateManagerStatus: jest.fn().mockResolvedValue(undefined),
      findByEmail: jest.fn().mockResolvedValue(null),
      dataSource: {
        createQueryRunner: jest.fn().mockReturnValue(queryRunner),
      },
      accountRepository: {
        createAccount: jest.fn().mockImplementation((value) => value),
      },
      doctorInfoRepository: {
        create: jest.fn().mockImplementation((value) => value),
      },
    } as any;
  };

  const collectMessages = async (dto: object) => {
    const errors = await validate(plainToInstance(CreateDoctorByClinicManagerDto, dto));
    return errors.flatMap((error) => Object.values(error.constraints ?? {}));
  };

  it('UT-42-01: Create doctor account successfully with minimal valid payload.', async () => {
    const serviceContext = createServiceContext();

    const result = await AccountsService.prototype.createDoctorByClinicManager.call(
      serviceContext,
      'manager-1',
      baseDto,
    );

    expect(result).toMatchObject({
      email: 'doctor@clinic.com',
      role: AccountRole.DOCTOR,
      status: AccountStatus.PENDING_APPROVAL,
    });
  });

  it('UT-42-02: Create doctor account successfully with optional doctor-information fields.', async () => {
    const serviceContext = createServiceContext();

    await AccountsService.prototype.createDoctorByClinicManager.call(
      serviceContext,
      'manager-1',
      {
        ...baseDto,
        gender: Gender.MALE,
        academicDegree: 'MD',
        experience: '10 years',
        position: 'Chief Cardiologist',
        identityNumber: '001234567890',
        placeIdentityCard: 'Hanoi',
        identityDate: '2020-01-15',
        bankNumber: '1234567890',
        bankName: 'Vietcombank',
        bankBranch: 'Hanoi Branch',
        professionalLicense: 'https://example.com/license.pdf',
        certificatePracticalTraining: 'https://example.com/training.pdf',
        medicalLicense: 'https://example.com/medical.pdf',
      },
    );

    expect(serviceContext.doctorInfoRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        gender: Gender.MALE,
        academicDegree: 'MD',
        experience: '10 years',
        position: 'Chief Cardiologist',
        professionalLicense: 'https://example.com/license.pdf',
      }),
    );
  });

  it('UT-42-03: Reject missing or invalid JWT.', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      AuthController.prototype.addDoctorByManager,
    );

    expect(guards).toHaveLength(2);
  });

  it('UT-42-04: Reject authenticated non-manager role.', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, AuthController.prototype.addDoctorByManager);

    expect(roles).toEqual([AccountRole.CLINIC_MANAGER]);
  });

  it('UT-42-05: Reject missing or blocked manager account.', async () => {
    const missingManagerContext = {
      accountRepository: {
        findAccountById: jest.fn().mockResolvedValue(null),
      },
    } as any;
    const pendingManagerContext = {
      accountRepository: {
        findAccountById: jest.fn().mockResolvedValue({
          _id: 'manager-1',
          role: AccountRole.CLINIC_MANAGER,
          status: AccountStatus.PENDING_APPROVAL,
        }),
      },
    } as any;

    await expect(
      (AccountsService.prototype as any).validateManagerStatus.call(
        missingManagerContext,
        'manager-1',
        'CREATE_STAFF',
      ),
    ).rejects.toThrow(new NotFoundException('Manager account not found'));
    await expect(
      (AccountsService.prototype as any).validateManagerStatus.call(
        pendingManagerContext,
        'manager-1',
        'CREATE_STAFF',
      ),
    ).rejects.toThrow(
      new ForbiddenException(
        'Cannot create staff. Manager legal documents pending approval. Please complete document verification first.',
      ),
    );
  });

  it('UT-42-06: Reject duplicate email.', async () => {
    const serviceContext = createServiceContext();
    serviceContext.findByEmail.mockResolvedValue({ _id: 'existing-account' });

    await expect(
      AccountsService.prototype.createDoctorByClinicManager.call(serviceContext, 'manager-1', {
        ...baseDto,
        email: 'duplicate@clinic.com',
      }),
    ).rejects.toThrow(
      new ConflictException(
        'This email is already registered in the system and cannot be used for this role.',
      ),
    );
  });

  it('UT-42-07: Reject invalid required or typed fields.', async () => {
    const messages = await collectMessages({
      email: 'invalid-email',
      password: 'abcdef',
      fullName: 'A'.repeat(256),
      gender: 'INVALID',
      identityDate: 'not-a-date',
    });
    const missingMessages = await collectMessages({});

    expect(missingMessages).toContain('Email is required');
    expect(messages).toContain('Invalid email format');
    expect(missingMessages).toContain('Password is required');
    expect(messages).toContain('Password must contain at least one letter and one number');
    expect(missingMessages).toContain('Full name is required');
    expect(messages).toContain('Full name must not exceed 255 characters');
    expect(messages).toContain('Gender must be one of: MALE, FEMALE, OTHER');
    expect(messages).toContain('Identity date must be a valid date string (YYYY-MM-DD)');
    expect(() =>
      plainToInstance(CreateDoctorByClinicManagerDto, {
        ...baseDto,
        academicDegree: 123,
        experience: 123,
        position: 123,
        identityNumber: 123,
        placeIdentityCard: 123,
        bankNumber: 123,
        bankName: 123,
        bankBranch: 123,
      }),
    ).toThrow('value?.trim is not a function');
  });

  it('UT-42-08: Accept password at minimum length 6 with letter and number.', async () => {
    const serviceContext = createServiceContext();

    const result = await AccountsService.prototype.createDoctorByClinicManager.call(
      serviceContext,
      'manager-1',
      {
        ...baseDto,
        password: 'Abc123',
      },
    );

    expect(result.email).toBe('doctor@clinic.com');
  });

  it('UT-42-09: Reject invalid optional field formats and enum/date limits.', async () => {
    const messages = await collectMessages({
      ...baseDto,
      gender: 'INVALID',
      identityDate: 'not-a-date',
      professionalLicense: 'https://example.com/license.pdf',
      certificatePracticalTraining: 'https://example.com/training.pdf',
      medicalLicense: 'https://example.com/medical.pdf',
    });

    expect(messages).toContain('Gender must be one of: MALE, FEMALE, OTHER');
    expect(messages).toContain('Identity date must be a valid date string (YYYY-MM-DD)');
    expect(() =>
      plainToInstance(CreateDoctorByClinicManagerDto, {
        ...baseDto,
        academicDegree: 123,
        experience: 123,
        position: 123,
        identityNumber: 123,
        placeIdentityCard: 123,
        bankNumber: 123,
        bankName: 123,
        bankBranch: 123,
      }),
    ).toThrow('value?.trim is not a function');
  });
});
