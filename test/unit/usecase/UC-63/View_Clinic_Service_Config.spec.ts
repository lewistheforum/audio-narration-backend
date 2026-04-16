import { NotFoundException, ParseUUIDPipe } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import {
  DoctorServiceConfigsController,
  PublicServiceConfigsController,
  ServiceConfigsController,
} from '../../../../src/modules/service-configs/service-configs.controller';
import { GetClinicServicesQueryDto } from '../../../../src/modules/service-configs/dto/get-clinic-services-query.dto';
import { ServiceConfigsService } from '../../../../src/modules/service-configs/service-configs.service';
import { AccountRole } from '../../../../src/modules/accounts/enums';

describe('UC-63 View Clinic Service Config', () => {
  const createServiceBuilder = ({
    totalItems = 1,
    rawServices = [],
    clinicInfo = {
      clinicId: 'clinic-1',
      clinicName: 'Clinic 1',
      address: 'Address',
      phone: '0123',
    },
    countThrows = false,
  }: any = {}) => ({
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockImplementation(async () => {
      if (countThrows) {
        throw new Error('db failed');
      }
      return totalItems;
    }),
    getRawMany: jest.fn().mockResolvedValue(rawServices),
    getRawOne: jest.fn().mockResolvedValue(clinicInfo),
  });

  it('UT-63-01: Staff views clinic service config successfully', async () => {
    const controllerContext = {
      serviceConfigsService: {
        dataSource: {
          createQueryBuilder: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnThis(),
            from: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            getRawOne: jest.fn().mockResolvedValue({ parent_id: 'clinic-1' }),
          }),
        },
        getClinicServices: jest.fn().mockResolvedValue({ services: [], pagination: {}, clinicInfo: {} }),
      },
    } as any;

    const result = await ServiceConfigsController.prototype.getClinicServices.call(
      controllerContext,
      { user: { _id: 'staff-1' } },
      { page: 1, limit: 50 },
    );

    expect(controllerContext.serviceConfigsService.getClinicServices).toHaveBeenCalledWith('clinic-1', {
      page: 1,
      limit: 50,
    });
    expect(result.message).toBe('Services retrieved successfully');
  });

  it('UT-63-02: Staff filters service config by search and active state', async () => {
    const controllerContext = {
      serviceConfigsService: {
        dataSource: {
          createQueryBuilder: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnThis(),
            from: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            getRawOne: jest.fn().mockResolvedValue({ parent_id: 'clinic-1' }),
          }),
        },
        getClinicServices: jest.fn().mockResolvedValue({ services: [], pagination: {}, clinicInfo: {} }),
      },
    } as any;

    await ServiceConfigsController.prototype.getClinicServices.call(
      controllerContext,
      { user: { _id: 'staff-1' } },
      { search: 'Checkup', isActive: false, page: 1, limit: 50 },
    );

    expect(controllerContext.serviceConfigsService.getClinicServices).toHaveBeenCalledWith('clinic-1', {
      search: 'Checkup',
      isActive: false,
      page: 1,
      limit: 50,
    });
  });

  it('UT-63-03: Public endpoint views clinic services', async () => {
    const controllerContext = {
      serviceConfigsService: {
        getClinicServices: jest.fn().mockResolvedValue({ services: [], pagination: {}, clinicInfo: {} }),
      },
    } as any;

    await PublicServiceConfigsController.prototype.getPublicClinicServices.call(
      controllerContext,
      'clinic-1',
      { search: 'Checkup', page: 1, limit: 50 },
    );

    expect(controllerContext.serviceConfigsService.getClinicServices).toHaveBeenCalledWith('clinic-1', {
      search: 'Checkup',
      page: 1,
      limit: 50,
      isActive: true,
    });
  });

  it('UT-63-04: Doctor endpoint views services from assigned clinics', async () => {
    const controllerContext = {
      serviceConfigsService: {
        getDoctorClinicServices: jest.fn().mockResolvedValue({ services: [], pagination: {}, clinicInfo: {} }),
      },
    } as any;

    const result = await DoctorServiceConfigsController.prototype.getDoctorClinicServices.call(
      controllerContext,
      { user: { _id: 'doctor-1' } },
      { isActive: true, page: 1, limit: 50 },
    );

    expect(controllerContext.serviceConfigsService.getDoctorClinicServices).toHaveBeenCalledWith('doctor-1', {
      isActive: true,
      page: 1,
      limit: 50,
    });
    expect(result.message).toBe('Services retrieved successfully');
  });

  it('UT-63-05: Standard pagination response shape is returned', async () => {
    const serviceBuilder = createServiceBuilder({ totalItems: 1, rawServices: [] });
    const clinicBuilder = createServiceBuilder({ totalItems: 0, rawServices: [] });
    const serviceContext = {
      dataSource: {
        createQueryBuilder: jest
          .fn()
          .mockReturnValueOnce(serviceBuilder)
          .mockReturnValueOnce(clinicBuilder),
      },
    } as any;

    const result = await ServiceConfigsService.prototype.getClinicServices.call(serviceContext, 'clinic-1', {
      isActive: true,
      page: 1,
      limit: 50,
    });

    expect(result.pagination).toEqual({
      currentPage: 1,
      totalPages: 1,
      totalItems: 1,
      itemsPerPage: 50,
    });
  });

  it('UT-63-06: Public endpoint forces active-only filter', async () => {
    const controllerContext = {
      serviceConfigsService: {
        getClinicServices: jest.fn().mockResolvedValue({ services: [], pagination: {}, clinicInfo: {} }),
      },
    } as any;

    await PublicServiceConfigsController.prototype.getPublicClinicServices.call(
      controllerContext,
      'clinic-1',
      { isActive: false, page: 1, limit: 50 },
    );

    expect(controllerContext.serviceConfigsService.getClinicServices).toHaveBeenCalledWith('clinic-1', {
      isActive: true,
      page: 1,
      limit: 50,
    });
  });

  it('UT-63-07: Staff endpoint rejects missing JWT', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, ServiceConfigsController.prototype.getClinicServices);

    expect(guards).toHaveLength(2);
  });

  it('UT-63-08: Staff endpoint rejects non-staff role', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, ServiceConfigsController.prototype.getClinicServices);

    expect(roles).toEqual([AccountRole.CLINIC_STAFF]);
  });

  it('UT-63-09: Staff without clinic association is rejected', async () => {
    const controllerContext = {
      serviceConfigsService: {
        dataSource: {
          createQueryBuilder: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnThis(),
            from: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            getRawOne: jest.fn().mockResolvedValue(null),
          }),
        },
        getClinicServices: jest.fn(),
      },
    } as any;

    await expect(
      ServiceConfigsController.prototype.getClinicServices.call(
        controllerContext,
        { user: { _id: 'staff-1' } },
        { page: 1, limit: 50 },
      ),
    ).rejects.toThrow('Staff is not associated with any clinic');
  });

  it('UT-63-10: Clinic not found in service layer', async () => {
    const serviceBuilder = createServiceBuilder({ totalItems: 0, rawServices: [] });
    const clinicBuilder = createServiceBuilder({ clinicInfo: null });
    const serviceContext = {
      dataSource: {
        createQueryBuilder: jest
          .fn()
          .mockReturnValueOnce(serviceBuilder)
          .mockReturnValueOnce(clinicBuilder),
      },
    } as any;

    await expect(
      ServiceConfigsService.prototype.getClinicServices.call(serviceContext, 'missing-clinic', {
        isActive: true,
        page: 1,
        limit: 50,
      }),
    ).rejects.toThrow(new NotFoundException('Clinic not found'));
  });

  it('UT-63-11: Doctor with no assigned clinic rejected', async () => {
    const doctorClinicsBuilder = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    const serviceContext = {
      dataSource: {
        createQueryBuilder: jest.fn().mockReturnValue(doctorClinicsBuilder),
      },
    } as any;

    await expect(
      ServiceConfigsService.prototype.getDoctorClinicServices.call(serviceContext, 'doctor-1', {
        isActive: true,
        page: 1,
        limit: 50,
      }),
    ).rejects.toThrow(new NotFoundException('Doctor is not assigned to any clinic'));
  });

  it('UT-63-12: Reject invalid query DTO values', async () => {
    const errors = await validate(
      plainToInstance(GetClinicServicesQueryDto, {
        clinicId: 123,
        isActive: 'maybe',
        page: 0,
        limit: 101,
      }),
    );

    const messages = errors.flatMap((error) => Object.values(error.constraints ?? {}));
    expect(messages).toContain('Clinic ID must be a string');
    expect(messages).toContain('isActive must be a boolean');
    expect(messages).toContain('Page must be at least 1');
    expect(messages).toContain('Limit must not exceed 100');
  });

  it('UT-63-13: Data layer runtime error returns 500', async () => {
    const serviceBuilder = createServiceBuilder({ countThrows: true });
    const serviceContext = {
      dataSource: {
        createQueryBuilder: jest.fn().mockReturnValue(serviceBuilder),
      },
    } as any;

    await expect(
      ServiceConfigsService.prototype.getClinicServices.call(serviceContext, 'clinic-1', {
        isActive: true,
        search: 'Checkup',
        page: 1,
        limit: 50,
      }),
    ).rejects.toThrow('db failed');
  });

  it('UT-63-14: Boundary limit=100 accepted', async () => {
    const errors = await validate(
      plainToInstance(GetClinicServicesQueryDto, {
        page: 1,
        limit: 100,
      }),
    );

    expect(errors).toEqual([]);
  });

  it('UT-63-15: Boundary high page returns empty services', async () => {
    const serviceBuilder = createServiceBuilder({ totalItems: 0, rawServices: [] });
    const clinicBuilder = createServiceBuilder({ totalItems: 0, rawServices: [] });
    const serviceContext = {
      dataSource: {
        createQueryBuilder: jest
          .fn()
          .mockReturnValueOnce(serviceBuilder)
          .mockReturnValueOnce(clinicBuilder),
      },
    } as any;

    const result = await ServiceConfigsService.prototype.getClinicServices.call(serviceContext, 'clinic-1', {
      isActive: true,
      page: 999,
      limit: 50,
    });

    expect(result.services).toEqual([]);
    expect(result.pagination.currentPage).toBe(999);
  });

  it("UT-63-16: Boundary boolean transform accepts 'true'/'false' strings", async () => {
    const trueDto = plainToInstance(GetClinicServicesQueryDto, { isActive: 'true' });
    const falseDto = plainToInstance(GetClinicServicesQueryDto, { isActive: 'false' });

    expect(trueDto.isActive).toBe(true);
    expect(falseDto.isActive).toBe(false);
  });
});
