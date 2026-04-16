import { NotFoundException, ParseUUIDPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { AccountsService } from '../../../../src/modules/accounts/accounts.service';
import { GetClinicDetailQueryDto } from '../../../../src/modules/accounts/dto/get-clinic-detail-query.dto';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';
import { AccountStatus } from '../../../../src/modules/accounts/enums/account-status.enum';

describe('UC-18 View Doctor Directory', () => {
  const createClinic = (children: any[]) => ({
    _id: '550e8400-e29b-41d4-a716-446655440000',
    username: 'district-1-clinic',
    email: 'branch@example.com',
    phone: '0900000000',
    profilePicture: null,
    role: AccountRole.CLINIC_MANAGER,
    status: AccountStatus.ACTIVE,
    isEmailVerified: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    clinicManagerInformation: {
      _id: 'manager-info-1',
      clinicBranchName: 'District 1',
      fullName: 'District 1 Clinic',
      gender: 'OTHER',
      profilePicture: null,
      dob: new Date('1990-01-01T00:00:00.000Z'),
    },
    address: {
      _id: 'address-1',
      address: '1 Nguyen Hue',
      ward: 'ward-code',
      wardName: 'Ben Nghe',
      district: 'district-code',
      districtName: 'District 1',
      province: '79',
      provinceName: 'Ho Chi Minh City',
    },
    parent: {
      clinicAdminInformation: {
        _id: 'admin-info-1',
        clinicName: 'City Medical',
      },
    },
    children,
  });

  const createDoctor = (overrides: Record<string, unknown> = {}) => ({
    _id: 'doctor-1',
    username: 'doctor-nguyen',
    email: 'doctor@example.com',
    phone: '0911111111',
    role: AccountRole.DOCTOR,
    status: AccountStatus.ACTIVE,
    profilePicture: null,
    doctorInformation: {
      _id: 'doctor-info-1',
      fullName: 'Dr Nguyen',
      position: 'Chief Physician',
      profilePicture: null,
      specializedIn: ['Cardiology'],
      yearOfExperience: 5,
    },
    ...overrides,
  });

  const createServiceContext = (clinic: any) => {
    const queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(clinic),
    };

    return {
      accountRepository: {
        createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      },
      googleIframeRepository: {
        findByAddressId: jest.fn().mockResolvedValue(null),
      },
      clinicSubscriptionRepository: {
        findByClinicId: jest.fn().mockResolvedValue(null),
      },
      subscriptionServiceRepository: {
        findById: jest.fn().mockResolvedValue(null),
      },
      dataSource: {
        query: jest.fn(),
      },
    };
  };

  it('UT-18-01: View full doctor directory without filter.', async () => {
    const serviceContext = createServiceContext(createClinic([createDoctor()]));
    serviceContext.dataSource.query
      .mockResolvedValueOnce([{ doctor_id: 'doctor-1', avg_rating: '4.80' }])
      .mockResolvedValueOnce([{ avg_rating: '4.20' }])
      .mockResolvedValueOnce([]);

    const result = await AccountsService.prototype.findClinicById.call(
      serviceContext,
      '550e8400-e29b-41d4-a716-446655440000',
    );

    expect(result.doctors).toHaveLength(1);
  });

  it('UT-18-02: View filtered doctor directory by name or position.', async () => {
    const serviceContext = createServiceContext(createClinic([createDoctor()]));
    serviceContext.dataSource.query
      .mockResolvedValueOnce([{ doctor_id: 'doctor-1', avg_rating: '4.80' }])
      .mockResolvedValueOnce([{ avg_rating: '4.20' }])
      .mockResolvedValueOnce([]);

    const result = await AccountsService.prototype.findClinicById.call(
      serviceContext,
      '550e8400-e29b-41d4-a716-446655440000',
      'Chief Physician',
    );

    expect(result.doctors[0].position).toBe('Chief Physician');
  });

  it('UT-18-03: Reject invalid clinic UUID.', async () => {
    const pipe = new ParseUUIDPipe();

    await expect(
      pipe.transform('invalid_format_id', {
        type: 'param',
        metatype: String,
        data: 'id',
      }),
    ).rejects.toThrow('Validation failed (uuid is expected)');
  });

  it('UT-18-04: Reject missing clinic.', async () => {
    const serviceContext = createServiceContext(null);

    await expect(
      AccountsService.prototype.findClinicById.call(
        serviceContext,
        '550e8400-e29b-41d4-a716-446655440001',
      ),
    ).rejects.toThrow(new NotFoundException('Clinic not found'));
  });

  it('UT-18-05: Reject invalid doctorSearch length.', async () => {
    const validationErrors = await validate(
      plainToInstance(GetClinicDetailQueryDto, {
        doctorSearch: 'A'.repeat(256),
      }),
    );
    const messages = validationErrors.flatMap((error) =>
      Object.values(error.constraints ?? {}),
    );

    expect(messages).toContain(
      'doctorSearch must be shorter than or equal to 255 characters',
    );
  });

  it('UT-18-06: Treat blank doctorSearch as omitted.', async () => {
    const dto = plainToInstance(GetClinicDetailQueryDto, {
      doctorSearch: '',
    });

    expect(dto.doctorSearch).toBeUndefined();
  });

  it('UT-18-07: Return empty doctors array when no doctors match or no doctors exist.', async () => {
    const serviceContext = createServiceContext(createClinic([]));
    serviceContext.dataSource.query
      .mockResolvedValueOnce([{ avg_rating: '4.20' }])
      .mockResolvedValueOnce([]);

    const result = await AccountsService.prototype.findClinicById.call(
      serviceContext,
      '550e8400-e29b-41d4-a716-446655440000',
      'NonExistentDoctorName',
    );

    expect(result.doctors).toEqual([]);
  });

  it('UT-18-08: Return empty doctors array when all child doctors are inactive.', async () => {
    const inactiveDoctor = createDoctor({ status: AccountStatus.BAN });
    const serviceContext = createServiceContext(createClinic([inactiveDoctor]));
    serviceContext.dataSource.query
      .mockResolvedValueOnce([{ avg_rating: '4.20' }])
      .mockResolvedValueOnce([]);

    const result = await AccountsService.prototype.findClinicById.call(
      serviceContext,
      '550e8400-e29b-41d4-a716-446655440000',
    );

    expect(result.doctors).toEqual([]);
  });
});
