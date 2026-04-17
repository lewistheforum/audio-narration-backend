import { NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { ManagerServiceConfigsController } from '../../../../src/modules/service-configs/service-configs.controller';
import { ServiceConfigsService } from '../../../../src/modules/service-configs/service-configs.service';
import { UpdateClinicServiceStatusDto } from '../../../../src/modules/clinic-services/dto/update-clinic-service-status.dto';
import { AccountRole } from '../../../../src/modules/accounts/enums';

describe('UC-66 Activate Deactivate Service Config', () => {
  const collectMessages = async (dto: object) => {
    const errors = await validate(plainToInstance(UpdateClinicServiceStatusDto, dto));
    return errors.flatMap((error) => Object.values(error.constraints ?? {}));
  };

  const createServiceContext = ({ runtimeError = false }: any = {}) => {
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

    return {
      serviceContext: {
        dataSource: {
          createQueryRunner: jest.fn().mockReturnValue(queryRunner),
        },
        getServiceDetail: jest.fn().mockResolvedValue({ _id: 'service-1', isActive: true }),
      } as any,
      queryRunner,
    };
  };

  it('UT-66-01: Activate service config successfully', async () => {
    const { serviceContext, queryRunner } = createServiceContext();

    await ServiceConfigsService.prototype.toggleServiceStatus.call(serviceContext, 'manager-1', 'service-1', true);

    expect(queryRunner.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('UPDATE clinic_services SET is_active = $1'),
      [true, 'service-1'],
    );
    expect(queryRunner.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('UPDATE clinic_service_config SET is_active = $1'),
      [true, 'service-1', 'manager-1'],
    );
  });

  it('UT-66-02: Deactivate service config successfully', async () => {
    const { serviceContext, queryRunner } = createServiceContext();

    await ServiceConfigsService.prototype.toggleServiceStatus.call(serviceContext, 'manager-1', 'service-1', false);

    expect(queryRunner.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('UPDATE clinic_services SET is_active = $1'),
      [false, 'service-1'],
    );
  });

  it('UT-66-03: Reject missing JWT on toggle endpoint', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, ManagerServiceConfigsController.prototype.toggleServiceStatus);

    expect(guards).toHaveLength(2);
  });

  it('UT-66-04: Reject authenticated non-manager role', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, ManagerServiceConfigsController.prototype.toggleServiceStatus);

    expect(roles).toEqual([AccountRole.CLINIC_MANAGER]);
  });

  it('UT-66-05: Reject service outside manager clinic scope', async () => {
    const serviceContext = {
      getServiceDetail: jest.fn().mockRejectedValue(new NotFoundException('Service with ID missing not found for this clinic.')),
    } as any;

    await expect(
      ServiceConfigsService.prototype.toggleServiceStatus.call(serviceContext, 'manager-1', 'missing', true),
    ).rejects.toThrow(new NotFoundException('Service with ID missing not found for this clinic.'));
  });

  it('UT-66-06: Reject missing isActive field', async () => {
    const messages = await collectMessages({});

    expect(messages).toContain('Is Active is required');
  });

  it('UT-66-07: Reject non-boolean isActive value', async () => {
    const messages = await collectMessages({ isActive: 'yes' });

    expect(messages).toContain('Is Active must be a boolean');
  });

  it('UT-66-08: Bubble runtime error from status transaction', async () => {
    const { serviceContext, queryRunner } = createServiceContext({ runtimeError: true });

    await expect(
      ServiceConfigsService.prototype.toggleServiceStatus.call(serviceContext, 'manager-1', 'service-1', true),
    ).rejects.toThrow('db failed');
    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
  });

  it('UT-66-09: Accept explicit true boundary value', async () => {
    const messages = await collectMessages({ isActive: true });

    expect(messages).toEqual([]);
  });

  it('UT-66-10: Accept explicit false boundary value', async () => {
    const messages = await collectMessages({ isActive: false });

    expect(messages).toEqual([]);
  });
});
