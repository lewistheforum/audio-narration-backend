import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { ManagerServiceConfigsController } from '../../../../src/modules/service-configs/service-configs.controller';
import { ServiceConfigsService } from '../../../../src/modules/service-configs/service-configs.service';
import { UpdateClinicServiceDto } from '../../../../src/modules/clinic-services/dto/update-clinic-service.dto';
import { AccountRole } from '../../../../src/modules/accounts/enums';

describe('UC-65 Update Service Config', () => {
  const collectMessages = async (dto: object) => {
    const errors = await validate(plainToInstance(UpdateClinicServiceDto, dto));
    return errors.flatMap((error) => Object.values(error.constraints ?? {}));
  };

  const detail = {
    _id: 'service-1',
    categoryId: '550e8400-e29b-41d4-a716-446655440000',
    serviceName: 'General',
    serviceCode: 'SV001',
    description: 'Old',
    serviceFunctions: ['CONSULTATION'],
    isActive: true,
    price: 100,
    discount: 5,
    durationMin: 30,
    noteForPatient: 'Old note',
  };

  const createServiceContext = ({
    notFound = false,
    runtimeError = false,
    returned = detail,
  }: any = {}) => {
    const queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      query: jest.fn().mockResolvedValue([]),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
    } as any;

    if (runtimeError) {
      queryRunner.query = jest.fn().mockRejectedValue(new Error('db failed'));
    }

    const serviceContext = {
      dataSource: {
        createQueryRunner: jest.fn().mockReturnValue(queryRunner),
      },
      getServiceDetail: jest.fn().mockImplementation(async () => {
        if (notFound) {
          throw new NotFoundException('Service with ID missing not found for this clinic.');
        }
        return returned;
      }),
    } as any;

    return { serviceContext, queryRunner };
  };

  it('UT-65-01: Update service config with full payload', async () => {
    const { serviceContext } = createServiceContext();

    const result = await ServiceConfigsService.prototype.updateService.call(serviceContext, 'manager-1', 'service-1', {
      categoryId: detail.categoryId,
      serviceName: 'Updated',
      serviceCode: 'SV002',
      description: 'Updated desc',
      serviceFunctions: ['XRAY'],
      price: 120,
      discount: 10,
      durationMin: 45,
      noteForPatient: 'New note',
    });

    expect(serviceContext.getServiceDetail).toHaveBeenCalledWith('manager-1', 'service-1');
    expect(result).toEqual(detail);
  });

  it('UT-65-02: Update only master service fields', async () => {
    const { serviceContext, queryRunner } = createServiceContext();

    await ServiceConfigsService.prototype.updateService.call(serviceContext, 'manager-1', 'service-1', {
      categoryId: detail.categoryId,
      serviceName: 'Updated',
      serviceCode: 'SV002',
      description: 'Updated desc',
      serviceFunctions: ['LAB'],
    });

    expect(queryRunner.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('UPDATE clinic_services'),
      expect.arrayContaining(['service-1']),
    );
  });

  it('UT-65-03: Update only clinic config fields', async () => {
    const { serviceContext, queryRunner } = createServiceContext();

    await ServiceConfigsService.prototype.updateService.call(serviceContext, 'manager-1', 'service-1', {
      price: 150,
      discount: 15,
      durationMin: 35,
      noteForPatient: 'Config only',
    });

    expect(queryRunner.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('UPDATE clinic_service_config'),
      expect.arrayContaining(['service-1', 'manager-1']),
    );
  });

  it('UT-65-04: Empty object update keeps scope and returns current detail', async () => {
    const { serviceContext } = createServiceContext();

    const result = await ServiceConfigsService.prototype.updateService.call(serviceContext, 'manager-1', 'service-1', {});

    expect(result).toEqual(detail);
  });

  it('UT-65-05: Reject missing JWT on update endpoint', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, ManagerServiceConfigsController.prototype.updateService);

    expect(guards).toHaveLength(2);
  });

  it('UT-65-06: Reject authenticated non-manager role', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, ManagerServiceConfigsController.prototype.updateService);

    expect(roles).toEqual([AccountRole.CLINIC_MANAGER]);
  });

  it('UT-65-07: Reject service outside manager scope', async () => {
    const serviceContext = {
      getServiceDetail: jest.fn().mockRejectedValue(new NotFoundException('Service with ID missing not found for this clinic.')),
    } as any;

    await expect(
      ServiceConfigsService.prototype.getServiceDetail.call(
        {
          dataSource: {
            createQueryBuilder: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnThis(),
              from: jest.fn().mockReturnThis(),
              innerJoin: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              getRawOne: jest.fn().mockResolvedValue(null),
            }),
          },
        },
        'manager-1',
        'missing',
      ),
    ).rejects.toThrow(new NotFoundException('Service with ID missing not found for this clinic.'));
    expect(serviceContext.getServiceDetail).not.toHaveBeenCalled();
  });

  it('UT-65-08: Reject invalid categoryId format in partial update', async () => {
    const messages = await collectMessages({ categoryId: 'invalid' });

    expect(messages).toContain('Invalid Category ID format');
  });

  it('UT-65-09: Reject invalid serviceName type', async () => {
    const messages = await collectMessages({ serviceName: 123 });

    expect(messages).toContain('Service Name must be a string');
  });

  it('UT-65-10: Reject invalid serviceCode type', async () => {
    const messages = await collectMessages({ serviceCode: 123 });

    expect(messages).toContain('Service Code must be a string');
  });

  it('UT-65-11: Reject invalid optional text and array fields', async () => {
    const messages = await collectMessages({
      description: 123,
      serviceFunctions: 'invalid',
      noteForPatient: 456,
    });

    expect(messages).toContain('Description must be a string');
    expect(messages).toContain('Service Functions must be an array');
    expect(messages).toContain('Note for patient must be a string');
  });

  it('UT-65-12: Reject negative price update', async () => {
    const messages = await collectMessages({ price: -1 });

    expect(messages).toContain('Price must be greater than or equal to 0');
  });

  it('UT-65-13: Reject discount above 100 in partial update', async () => {
    const messages = await collectMessages({ discount: 101 });

    expect(messages).toContain('Discount cannot exceed 100');
  });

  it('UT-65-14: Reject durationMin below minimum in partial update', async () => {
    const messages = await collectMessages({ durationMin: 0 });

    expect(messages).toContain('Duration must be at least 1 minute');
  });

  it('UT-65-15: Bubble runtime error during transactional update', async () => {
    const { serviceContext, queryRunner } = createServiceContext({ runtimeError: true });

    await expect(
      ServiceConfigsService.prototype.updateService.call(serviceContext, 'manager-1', 'service-1', {
        serviceName: 'Updated',
      }),
    ).rejects.toThrow('db failed');
    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
  });

  it('UT-65-16: Accept zero price boundary on update', async () => {
    const messages = await collectMessages({ price: 0 });

    expect(messages).toEqual([]);
  });

  it('UT-65-17: Accept discount zero boundary on update', async () => {
    const messages = await collectMessages({ discount: 0 });

    expect(messages).toEqual([]);
  });

  it('UT-65-18: Accept durationMin minimum boundary on update', async () => {
    const messages = await collectMessages({ durationMin: 1 });

    expect(messages).toEqual([]);
  });
});
