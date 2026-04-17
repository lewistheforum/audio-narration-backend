import { NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { AccountsController } from '../../../../src/modules/accounts/accounts.controller';
import { AccountsService } from '../../../../src/modules/accounts/accounts.service';
import { GetDoctorListDto } from '../../../../src/modules/accounts/dto/get-doctor-list.dto';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';
import { AccountStatus } from '../../../../src/modules/accounts/enums/account-status.enum';

describe('UC-40 View Doctor List', () => {
  const baseDoctor = {
    _id: 'doctor-1',
    username: 'doctor.one',
    email: 'doctor.one@example.com',
    phone: '0123456789',
    profilePicture: null,
    role: AccountRole.DOCTOR,
    status: AccountStatus.ACTIVE,
    doctorInformation: {
      fullName: 'Dr. John Smith',
      academicDegree: 'MD',
      experience: '10 years',
      position: 'Cardiologist',
      profilePicture: null,
      bio: null,
    },
  } as any;

  const clinicInfo = {
    _id: 'manager-info-1',
    clinicBranchName: 'Clinic A',
    fullName: 'Manager',
    gender: null,
    profilePicture: null,
    dob: null,
  };

  const createContext = ({ parent = { parentId: 'clinic-admin-1' }, accounts = [baseDoctor], total = 1 } = {}) => ({
    accountRepository: {
      findAccountById: jest.fn().mockResolvedValue(parent),
      findByParentIdAndRole: jest.fn().mockResolvedValue([{ _id: 'manager-2' }]),
      findDoctorsWithFilters: jest.fn().mockResolvedValue([accounts, total]),
    },
    clinicManagerInfoRepository: {
      findByAccountId: jest.fn().mockResolvedValue(clinicInfo),
    },
  } as any);

  const collectMessages = async (dto: object) => {
    const errors = await validate(plainToInstance(GetDoctorListDto, dto));
    return errors.flatMap((error) => Object.values(error.constraints ?? {}));
  };

  it('UT-40-01: View doctor list successfully with default pagination.', async () => {
    const serviceContext = createContext();

    const result = await AccountsService.prototype.findAllDoctorsByManager.call(
      serviceContext,
      'manager-1',
      1,
      10,
    );

    expect(result.doctors).toHaveLength(1);
    expect(result.pagination).toEqual({ page: 1, limit: 10, total: 1, totalPages: 1 });
  });

  it('UT-40-02: View doctor list successfully with search or academic degree filter.', async () => {
    const serviceContext = createContext();

    const result = await AccountsService.prototype.findAllDoctorsByManager.call(
      serviceContext,
      'manager-1',
      1,
      10,
      'john',
      'MD',
    );

    expect(serviceContext.accountRepository.findDoctorsWithFilters).toHaveBeenCalledWith(
      AccountRole.DOCTOR,
      undefined,
      0,
      10,
      ['clinic-admin-1', 'manager-2'],
      undefined,
      'john',
      'MD',
      undefined,
      undefined,
    );
    expect(result.doctors[0].doctorInfo.academicDegree).toBe('MD');
  });

  it('UT-40-03: View doctor list successfully with date range filter.', async () => {
    const controllerContext = {
      accountsService: {
        findAllDoctorsByManager: jest.fn().mockResolvedValue({
          doctors: [],
          pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        }),
      },
    } as any;

    const result = await AccountsController.prototype.getDoctorListManagement.call(
      controllerContext,
      { user: { _id: 'manager-1' } },
      { fromDate: '2023-01-01', toDate: '2023-12-31', page: 1, limit: 10 },
    );

    expect(result.message).toBe('Doctor list retrieved successfully');
    expect(controllerContext.accountsService.findAllDoctorsByManager).toHaveBeenCalledWith(
      'manager-1',
      1,
      10,
      undefined,
      undefined,
      '2023-01-01',
      '2023-12-31',
    );
  });

  it('UT-40-04: Reject missing or invalid JWT.', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      AccountsController.prototype.getDoctorListManagement,
    );

    expect(guards).toHaveLength(2);
  });

  it('UT-40-05: Reject authenticated non-manager role.', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      AccountsController.prototype.getDoctorListManagement,
    );

    expect(roles).toEqual([AccountRole.CLINIC_MANAGER]);
  });

  it('UT-40-06: Reject missing manager account.', async () => {
    const serviceContext = createContext({ parent: null });

    await expect(
      AccountsService.prototype.findAllDoctorsByManager.call(serviceContext, 'manager-1', 1, 10),
    ).rejects.toThrow(new NotFoundException('User not found'));
  });

  it('UT-40-07: Return empty result when no doctors match or none exist.', async () => {
    const serviceContext = createContext({ accounts: [], total: 0 });

    const result = await AccountsService.prototype.findAllDoctorsByManager.call(
      serviceContext,
      'manager-1',
      999,
      10,
      'john',
    );

    expect(result).toEqual({
      doctors: [],
      pagination: { page: 999, limit: 10, total: 0, totalPages: 0 },
    });
  });

  it('UT-40-08: Reject invalid query DTO values.', async () => {
    const messages = await collectMessages({
      search: 123,
      academicDegree: 123,
      fromDate: 'not-a-date',
      toDate: 'not-a-date',
      page: 0,
      limit: 0,
    });

    expect(messages).toContain('search must be a string');
    expect(messages).toContain('academicDegree must be a string');
    expect(messages).toContain('fromDate must be a valid ISO 8601 date string');
    expect(messages).toContain('toDate must be a valid ISO 8601 date string');
    expect(messages).toContain('page must not be less than 1');
    expect(messages).toContain('limit must not be less than 1');
  });
});
