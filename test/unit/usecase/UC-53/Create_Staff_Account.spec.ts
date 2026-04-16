import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { AuthController } from '../../../../src/modules/auth/auth.controller';
import { AccountsService } from '../../../../src/modules/accounts/accounts.service';
import { CreateStaffByClinicManagerDto } from '../../../../src/modules/accounts/dto/create-staff-by-manager.dto';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';
import { AccountStatus } from '../../../../src/modules/accounts/enums/account-status.enum';
import { ClinicRole } from '../../../../src/modules/accounts/enums/clinic-role.enum';
import { Gender } from '../../../../src/modules/accounts/enums/gender.enum';

describe('UC-53 Create Staff Account', () => {
  const baseDto = {
    email: 'staff@clinic.com',
    password: 'Staff123',
    fullName: 'Jane Doe',
    gender: Gender.FEMALE,
    clinicRole: ClinicRole.STAFF,
  };

  const collectMessages = async (dto: object) => {
    const errors = await validate(plainToInstance(CreateStaffByClinicManagerDto, dto));
    return errors.flatMap((error) => Object.values(error.constraints ?? {}));
  };

  const createServiceContext = ({
    managerRole = AccountRole.CLINIC_MANAGER,
    statusCheckResult = {
      _id: 'manager-1',
      role: AccountRole.CLINIC_MANAGER,
      status: AccountStatus.ACTIVE,
    },
    existingAccount = null,
    saveThrows = false,
  }: {
    managerRole?: AccountRole;
    statusCheckResult?: any;
    existingAccount?: any;
    saveThrows?: boolean;
  } = {}) => {
    const queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        save: jest
          .fn()
          .mockImplementationOnce(async (entity) => {
            if (saveThrows) {
              throw new Error('db failed');
            }
            return { _id: 'staff-1', ...entity };
          })
          .mockImplementationOnce(async (entity) => {
            if (saveThrows) {
              throw new Error('db failed');
            }
            return entity;
          }),
      },
    };

    const serviceContext = {
      BCRYPT_SALT_ROUNDS: 10,
      findAccountEntityById: jest
        .fn()
        .mockResolvedValue({ _id: 'manager-1', role: managerRole }),
      validateManagerStatus: AccountsService.prototype['validateManagerStatus'],
      findByEmail: jest.fn().mockResolvedValue(existingAccount),
      dataSource: {
        createQueryRunner: jest.fn().mockReturnValue(queryRunner),
      },
      accountRepository: {
        findAccountById: jest.fn().mockResolvedValue(statusCheckResult),
        createAccount: jest.fn().mockImplementation((payload) => payload),
      },
      clinicStaffRepository: {
        create: jest.fn().mockImplementation((payload) => payload),
      },
    } as any;

    return { serviceContext, queryRunner };
  };

  it('UT-53-01: Create staff successfully with valid payload.', async () => {
    const controllerContext = {
      AccountsService: {
        createStaffByClinicManager: jest.fn().mockResolvedValue({ _id: 'staff-1' }),
      },
    } as any;

    const result = await AuthController.prototype.addStaffByManager.call(
      controllerContext,
      { user: { _id: 'manager-1' } },
      baseDto,
    );

    expect(controllerContext.AccountsService.createStaffByClinicManager).toHaveBeenCalledWith(
      'manager-1',
      baseDto,
    );
    expect(result).toEqual({
      data: { _id: 'staff-1' },
      message: 'Staff account created successfully',
    });
  });

  it('UT-53-02: Create staff successfully without optional gender.', async () => {
    const { serviceContext } = createServiceContext();

    const result = await AccountsService.prototype.createStaffByClinicManager.call(
      serviceContext,
      'manager-1',
      { ...baseDto, gender: undefined },
    );

    expect(result).toBeDefined();
    expect(serviceContext.clinicStaffRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ gender: undefined }),
    );
  });

  it('UT-53-03: Create staff returns pending approval account state.', async () => {
    const { serviceContext } = createServiceContext();

    const result = await AccountsService.prototype.createStaffByClinicManager.call(
      serviceContext,
      'manager-1',
      baseDto,
    );

    expect(result.status).toBe(AccountStatus.PENDING_APPROVAL);
  });

  it('UT-53-04: Reject request without JWT.', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, AuthController.prototype.addStaffByManager);

    expect(guards).toHaveLength(2);
  });

  it('UT-53-05: Reject non-manager role by RolesGuard.', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, AuthController.prototype.addStaffByManager);

    expect(roles).toEqual([AccountRole.CLINIC_MANAGER]);
  });

  it('UT-53-06: Reject invalid DTO fields.', async () => {
    const messages = await collectMessages({
      gender: 'INVALID',
      password: '',
    });

    expect(messages).toContain('Email is required');
    expect(messages).toContain('Password is required');
    expect(messages).toContain('Full name is required');
    expect(messages).toContain('Clinic role is required');
    expect(messages).toContain('Gender must be one of: MALE, FEMALE, OTHER');
  });

  it('UT-53-07: Reject when requester is not clinic manager in service layer.', async () => {
    const { serviceContext } = createServiceContext({ managerRole: AccountRole.CLINIC_ADMIN });

    await expect(
      AccountsService.prototype.createStaffByClinicManager.call(serviceContext, 'manager-1', baseDto),
    ).rejects.toThrow(new ForbiddenException('Only clinic managers can add staff members'));
  });

  it('UT-53-08: Reject when manager account does not exist.', async () => {
    const { serviceContext } = createServiceContext({ statusCheckResult: null });

    await expect(
      AccountsService.prototype.createStaffByClinicManager.call(serviceContext, 'manager-1', baseDto),
    ).rejects.toThrow(new NotFoundException('Manager account not found'));
  });

  it('UT-53-09: Reject when manager status is pending approval.', async () => {
    const { serviceContext } = createServiceContext({
      statusCheckResult: {
        _id: 'manager-1',
        role: AccountRole.CLINIC_MANAGER,
        status: AccountStatus.PENDING_APPROVAL,
      },
    });

    await expect(
      AccountsService.prototype.createStaffByClinicManager.call(serviceContext, 'manager-1', baseDto),
    ).rejects.toThrow(
      new ForbiddenException(
        'Cannot create staff. Manager legal documents pending approval. Please complete document verification first.',
      ),
    );
  });

  it('UT-53-10: Reject when manager status is manager disabled.', async () => {
    const { serviceContext } = createServiceContext({
      statusCheckResult: {
        _id: 'manager-1',
        role: AccountRole.CLINIC_MANAGER,
        status: AccountStatus.MANAGER_DISABLED,
      },
    });

    await expect(
      AccountsService.prototype.createStaffByClinicManager.call(serviceContext, 'manager-1', baseDto),
    ).rejects.toThrow(
      new ForbiddenException(
        'Cannot create staff. Manager account is disabled. Please contact your clinic administrator.',
      ),
    );
  });

  it('UT-53-11: Reject when manager status is other non-active status.', async () => {
    const { serviceContext } = createServiceContext({
      statusCheckResult: {
        _id: 'manager-1',
        role: AccountRole.CLINIC_MANAGER,
        status: AccountStatus.BAN,
      },
    });

    await expect(
      AccountsService.prototype.createStaffByClinicManager.call(serviceContext, 'manager-1', baseDto),
    ).rejects.toThrow(
      new ForbiddenException('Manager account must be ACTIVE to create staff members.'),
    );
  });

  it('UT-53-12: Reject duplicate staff email.', async () => {
    const { serviceContext } = createServiceContext({ existingAccount: { _id: 'dup-1' } });

    await expect(
      AccountsService.prototype.createStaffByClinicManager.call(serviceContext, 'manager-1', baseDto),
    ).rejects.toThrow(
      new ConflictException(
        'This email is already registered in the system and cannot be used for this role.',
      ),
    );
  });

  it('UT-53-13: Reject password complexity violations.', async () => {
    const messages = await collectMessages({
      ...baseDto,
      password: 'StaffPassword',
    });

    expect(messages).toContain('Password must contain at least one letter and one number');
  });

  it('UT-53-14: Rollback transaction when save fails.', async () => {
    const { serviceContext, queryRunner } = createServiceContext({ saveThrows: true });

    await expect(
      AccountsService.prototype.createStaffByClinicManager.call(serviceContext, 'manager-1', baseDto),
    ).rejects.toThrow('db failed');
    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
  });

  it('UT-53-15: Accept lower boundary valid values.', async () => {
    const { serviceContext } = createServiceContext();

    const result = await AccountsService.prototype.createStaffByClinicManager.call(
      serviceContext,
      'manager-1',
      {
        ...baseDto,
        password: 'abcde1',
        fullName: 'A'.repeat(255),
      },
    );

    expect(result).toBeDefined();
  });

  it('UT-53-16: Reject upper boundary overflow values.', async () => {
    const messages = await collectMessages({
      ...baseDto,
      password: 'A'.repeat(51),
      fullName: 'A'.repeat(256),
    });

    expect(messages).toContain('Password must not exceed 50 characters');
    expect(messages).toContain('Full name must not exceed 255 characters');
  });
});
