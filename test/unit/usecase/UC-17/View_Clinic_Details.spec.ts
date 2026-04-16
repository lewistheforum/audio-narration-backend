import { NotFoundException, ParseUUIDPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { AccountsController } from '../../../../src/modules/accounts/accounts.controller';
import { AccountsService } from '../../../../src/modules/accounts/accounts.service';
import { GetClinicDetailQueryDto } from '../../../../src/modules/accounts/dto/get-clinic-detail-query.dto';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';
import { AccountStatus } from '../../../../src/modules/accounts/enums/account-status.enum';

describe('UC-17 View Clinic Details', () => {
  const createClinic = (overrides: Record<string, unknown> = {}) => ({
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
      _id: 'clinic-admin-1',
      username: 'city-medical',
      email: 'admin@example.com',
      role: AccountRole.CLINIC_ADMIN,
      status: AccountStatus.ACTIVE,
      clinicAdminInformation: {
        _id: 'admin-info-1',
        clinicName: 'City Medical',
      },
    },
    children: [
      {
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
          bio: 'Experienced physician',
          specializedIn: ['Cardiology'],
          yearOfExperience: 5,
        },
      },
    ],
    ...overrides,
  });

  const createQueryBuilder = (clinic: any) => {
    const builder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(clinic),
    };

    return builder;
  };

  const createServiceContext = (clinic: any) => {
    const queryBuilder = createQueryBuilder(clinic);

    return {
      accountRepository: {
        createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      },
      googleIframeRepository: {
        findByAddressId: jest.fn().mockResolvedValue({ iframeLink: 'https://maps.example.com' }),
      },
      clinicSubscriptionRepository: {
        findByClinicId: jest.fn().mockResolvedValue({
          clinicId: clinic?._id,
          serviceId: 'service-1',
          subscriptionStatus: 'ACTIVE',
          subscriptionDate: new Date('2026-01-01T00:00:00.000Z'),
          expirationDate: new Date('2026-12-31T23:59:59.999Z'),
        }),
      },
      subscriptionServiceRepository: {
        findById: jest.fn().mockResolvedValue({
          _id: 'service-1',
          serviceName: 'Premium',
          price: 1000000,
          discount: 10,
        }),
      },
      dataSource: {
        query: jest.fn(),
      },
    };
  };

  it('UT-17-01: View clinic details successfully without doctor filter.', async () => {
    const controller = new AccountsController({
      findClinicById: jest.fn().mockResolvedValue({ id: 'clinic-1' }),
    } as any);
    const result = await controller.getClinicById(
      '550e8400-e29b-41d4-a716-446655440000',
      plainToInstance(GetClinicDetailQueryDto, {}),
    );

    expect(result.message).toBe('Clinic details retrieved successfully');
  });

  it('UT-17-02: View clinic details successfully with matching doctorSearch.', async () => {
    const clinic = createClinic();
    const serviceContext = createServiceContext(clinic);
    serviceContext.dataSource.query
      .mockResolvedValueOnce([{ doctor_id: 'doctor-1', avg_rating: '4.80' }])
      .mockResolvedValueOnce([{ avg_rating: '4.20' }])
      .mockResolvedValueOnce([{ _id: 'feedback-1', rating: 5, created_at: new Date('2026-01-03T00:00:00.000Z') }]);

    const result = await AccountsService.prototype.findClinicById.call(
      serviceContext,
      clinic._id,
      'Nguyen',
    );

    expect(serviceContext.accountRepository.createQueryBuilder).toHaveBeenCalledWith('clinic');
    expect(result.finalClinicName).toBe('City Medical - District 1');
    expect(result.doctors).toHaveLength(1);
    expect(result.averageRating).toBe(4.2);
  });

  it('UT-17-03: Reject invalid clinic UUID.', async () => {
    const pipe = new ParseUUIDPipe();

    await expect(
      pipe.transform('invalid_format_id', {
        type: 'param',
        metatype: String,
        data: 'id',
      }),
    ).rejects.toThrow('Validation failed (uuid is expected)');
  });

  it('UT-17-04: Reject clinic not found by role or status or id.', async () => {
    const serviceContext = createServiceContext(null);

    await expect(
      AccountsService.prototype.findClinicById.call(
        serviceContext,
        '550e8400-e29b-41d4-a716-446655440001',
      ),
    ).rejects.toThrow(new NotFoundException('Clinic not found'));
  });

  it('UT-17-05: Reject missing clinic manager information.', async () => {
    const serviceContext = createServiceContext(
      createClinic({ clinicManagerInformation: null }),
    );

    await expect(
      AccountsService.prototype.findClinicById.call(
        serviceContext,
        '550e8400-e29b-41d4-a716-446655440000',
      ),
    ).rejects.toThrow(new NotFoundException('Clinic manager information not found'));
  });

  it('UT-17-06: Reject invalid doctorSearch input.', async () => {
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

  it('UT-17-07: Treat blank doctorSearch as omitted and return full list.', async () => {
    const clinic = createClinic();
    const serviceContext = createServiceContext(clinic);
    serviceContext.dataSource.query
      .mockResolvedValueOnce([{ doctor_id: 'doctor-1', avg_rating: '4.80' }])
      .mockResolvedValueOnce([{ avg_rating: '4.20' }])
      .mockResolvedValueOnce([]);

    const result = await AccountsService.prototype.findClinicById.call(
      serviceContext,
      clinic._id,
      '   ',
    );

    expect(result.doctors).toHaveLength(1);
  });

  it('UT-17-08: Return clinic successfully when no doctors match or no doctors exist.', async () => {
    const clinic = createClinic({ children: [] });
    const serviceContext = createServiceContext(clinic);
    serviceContext.dataSource.query
      .mockResolvedValueOnce([{ avg_rating: '4.20' }])
      .mockResolvedValueOnce([]);

    const result = await AccountsService.prototype.findClinicById.call(
      serviceContext,
      clinic._id,
      'NonExistentDoctorName',
    );

    expect(result.doctors).toEqual([]);
  });

  it('UT-17-09: Return clinic successfully when subscription or feedback data is absent.', async () => {
    const clinic = createClinic();
    const serviceContext = createServiceContext(clinic);
    serviceContext.clinicSubscriptionRepository.findByClinicId.mockResolvedValue(null);
    serviceContext.dataSource.query
      .mockResolvedValueOnce([{ doctor_id: 'doctor-1', avg_rating: '4.80' }])
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('feedback query failed'));

    const result = await AccountsService.prototype.findClinicById.call(
      serviceContext,
      clinic._id,
    );

    expect(result.subscription).toBeUndefined();
    expect(result.feedbacks).toEqual([]);
  });
});
