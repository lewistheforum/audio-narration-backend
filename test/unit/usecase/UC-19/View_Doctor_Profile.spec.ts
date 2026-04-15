import { NotFoundException, ParseUUIDPipe } from '@nestjs/common';

import { AccountsController } from '../../../../src/modules/accounts/accounts.controller';
import { AccountsService } from '../../../../src/modules/accounts/accounts.service';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';
import { AccountStatus } from '../../../../src/modules/accounts/enums/account-status.enum';

describe('UC-19 View Doctor Profile', () => {
  const createDoctor = (overrides: Record<string, unknown> = {}) => ({
    _id: '550e8400-e29b-41d4-a716-446655440000',
    username: 'doctor-nguyen',
    email: 'doctor@example.com',
    phone: '0911111111',
    profilePicture: null,
    role: AccountRole.DOCTOR,
    status: AccountStatus.ACTIVE,
    parentId: 'clinic-1',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    parent: {
      phone: '0900000000',
      clinicManagerInformation: {
        _id: 'clinic-info-1',
        clinicBranchName: 'District 1',
      },
    },
    ...overrides,
  });

  const createDoctorInfo = (overrides: Record<string, unknown> = {}) => ({
    _id: 'doctor-info-1',
    accountId: '550e8400-e29b-41d4-a716-446655440000',
    fullName: 'Dr Nguyen',
    gender: 'OTHER',
    dob: new Date('1990-01-01T00:00:00.000Z'),
    profilePicture: 'https://example.com/doctor.jpg',
    academicDegree: 'MD',
    experience: '5 years',
    position: 'Chief Physician',
    introduction1: 'Intro',
    workProcess2: 'Work',
    studyProcess3: 'Study',
    members4: 'Members',
    scientificWork5: 'Research',
    papers6: 'Papers',
    introductionImage: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    ...overrides,
  });

  const createServiceContext = (doctor: any, doctorInfo: any) => {
    const queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(doctor),
    };

    return {
      accountRepository: {
        createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      },
      doctorInfoRepository: {
        findPublicByDoctorAccountId: jest.fn().mockResolvedValue(doctorInfo),
      },
      dataSource: {
        query: jest.fn(),
      },
    };
  };

  it('UT-19-01: View doctor profile successfully with clinic information.', async () => {
    const controller = new AccountsController({
      getPublicDoctorById: jest.fn().mockResolvedValue({ id: 'doctor-1' }),
    } as any);

    const result = await controller.getDoctorById(
      '550e8400-e29b-41d4-a716-446655440000',
    );

    expect(result).toEqual({ id: 'doctor-1' });
  });

  it('UT-19-02: View doctor profile successfully without parent clinic information.', async () => {
    const serviceContext = createServiceContext(
      createDoctor({ parent: null, parentId: null }),
      createDoctorInfo(),
    );
    serviceContext.dataSource.query
      .mockResolvedValueOnce([{ avg_rating: '4.50' }])
      .mockResolvedValueOnce([]);

    const result = await AccountsService.prototype.getPublicDoctorById.call(
      serviceContext,
      '550e8400-e29b-41d4-a716-446655440000',
    );

    expect(result.clinic).toBeUndefined();
    expect(result.averageRating).toBe(4.5);
  });

  it('UT-19-03: Reject invalid doctor UUID.', async () => {
    const pipe = new ParseUUIDPipe();

    await expect(
      pipe.transform('invalid_format_id', {
        type: 'param',
        metatype: String,
        data: 'id',
      }),
    ).rejects.toThrow('Validation failed (uuid is expected)');
  });

  it('UT-19-04: Reject missing doctor by id or role or status.', async () => {
    const serviceContext = createServiceContext(null, createDoctorInfo());

    await expect(
      AccountsService.prototype.getPublicDoctorById.call(
        serviceContext,
        '550e8400-e29b-41d4-a716-446655440001',
      ),
    ).rejects.toThrow(new NotFoundException('Doctor not found'));
  });

  it('UT-19-05: Reject missing public doctor information.', async () => {
    const serviceContext = createServiceContext(createDoctor(), null);

    await expect(
      AccountsService.prototype.getPublicDoctorById.call(
        serviceContext,
        '550e8400-e29b-41d4-a716-446655440000',
      ),
    ).rejects.toThrow(new NotFoundException('Doctor information not found'));
  });

  it('UT-19-06: Treat soft-deleted public doctor information as not found.', async () => {
    const serviceContext = createServiceContext(
      createDoctor(),
      createDoctorInfo({ deletedAt: new Date('2026-01-03T00:00:00.000Z') }),
    );

    await expect(
      AccountsService.prototype.getPublicDoctorById.call(
        serviceContext,
        '550e8400-e29b-41d4-a716-446655440000',
      ),
    ).rejects.toThrow(new NotFoundException('Doctor information not found'));
  });

  it('UT-19-07: Return doctor successfully when feedback list is empty.', async () => {
    const serviceContext = createServiceContext(createDoctor(), createDoctorInfo());
    serviceContext.dataSource.query
      .mockResolvedValueOnce([{ avg_rating: '4.50' }])
      .mockResolvedValueOnce([]);

    const result = await AccountsService.prototype.getPublicDoctorById.call(
      serviceContext,
      '550e8400-e29b-41d4-a716-446655440000',
    );

    expect(result.feedbacks).toEqual([]);
  });

  it('UT-19-08: Return doctor successfully when rating query falls back to 0.', async () => {
    const serviceContext = createServiceContext(createDoctor(), createDoctorInfo());
    serviceContext.dataSource.query
      .mockRejectedValueOnce(new Error('rating failed'))
      .mockResolvedValueOnce([]);

    const result = await AccountsService.prototype.getPublicDoctorById.call(
      serviceContext,
      '550e8400-e29b-41d4-a716-446655440000',
    );

    expect(result.averageRating).toBe(0);
  });
});
