import { NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { ManagerServiceConfigsController } from '../../../../src/modules/service-configs/service-configs.controller';
import { ServiceConfigsService } from '../../../../src/modules/service-configs/service-configs.service';
import { CreateClinicServiceDto } from '../../../../src/modules/clinic-services/dto/create-clinic-service.dto';
import { AccountRole } from '../../../../src/modules/accounts/enums';

describe('UC-64 Create Service Config', () => {
  const collectMessages = async (dto: object) => {
    const errors = await validate(plainToInstance(CreateClinicServiceDto, dto));
    return errors.flatMap((error) => Object.values(error.constraints ?? {}));
  };

  const baseDto = {
    categoryId: '550e8400-e29b-41d4-a716-446655440000',
    serviceName: 'General Checkup',
    serviceCode: 'SV001',
    description: 'Basic health checkup',
    serviceFunctions: ['CONSULTATION'],
    price: 150000,
    discount: 10,
    durationMin: 30,
    noteForPatient: 'Fast for 8 hours',
  };

  const createServiceContext = ({
    categoryExists = [{ _id: 'cat-1' }],
    runtimeError = false,
  }: any = {}) => {
    const queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      query: jest
        .fn()
        .mockResolvedValueOnce([{ _id: 'service-1', category_id: baseDto.categoryId, service_name: baseDto.serviceName, service_code: baseDto.serviceCode, description: baseDto.description, service_functions: baseDto.serviceFunctions, is_active: true }])
        .mockResolvedValueOnce([{ price: baseDto.price, discount: baseDto.discount, duration_min: baseDto.durationMin, note_for_patient: baseDto.noteForPatient }]),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
    } as any;

    if (runtimeError) {
      queryRunner.query = jest.fn().mockRejectedValue(new Error('db failed'));
    }

    const serviceContext = {
      dataSource: {
        query: jest.fn().mockResolvedValue(categoryExists),
        createQueryRunner: jest.fn().mockReturnValue(queryRunner),
      },
    } as any;

    return { serviceContext, queryRunner };
  };

  it('UT-64-01: Create service config with full valid payload', async () => {
    const { serviceContext } = createServiceContext();

    const result = await ServiceConfigsService.prototype.createService.call(serviceContext, 'manager-1', baseDto);

    expect(result.serviceName).toBe('General Checkup');
    expect(result.price).toBe(150000);
  });

  it('UT-64-02: Create service config with optional fields omitted', async () => {
    const { serviceContext, queryRunner } = createServiceContext();
    const dto = {
      categoryId: baseDto.categoryId,
      serviceName: baseDto.serviceName,
      serviceCode: baseDto.serviceCode,
      price: baseDto.price,
    };

    await ServiceConfigsService.prototype.createService.call(serviceContext, 'manager-1', dto);

    expect(queryRunner.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('INSERT INTO clinic_service_config'),
      ['service-1', 'manager-1', 150000, 0, undefined, undefined, true],
    );
  });

  it('UT-64-03: Create service config with explicit service function array', async () => {
    const { serviceContext, queryRunner } = createServiceContext();
    const dto = { ...baseDto, serviceFunctions: ['XRAY', 'LAB'] };

    await ServiceConfigsService.prototype.createService.call(serviceContext, 'manager-1', dto);

    expect(queryRunner.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('INSERT INTO clinic_services'),
      [
        dto.categoryId,
        dto.serviceName,
        dto.serviceCode,
        dto.description,
        ['XRAY', 'LAB'],
        true,
      ],
    );
  });

  it('UT-64-04: Created master service and clinic config are active by default', async () => {
    const { serviceContext } = createServiceContext();

    const result = await ServiceConfigsService.prototype.createService.call(serviceContext, 'manager-1', baseDto);

    expect(result.isActive).toBe(true);
  });

  it('UT-64-05: Omitted discount is stored through default zero branch', async () => {
    const { serviceContext, queryRunner } = createServiceContext();

    await ServiceConfigsService.prototype.createService.call(serviceContext, 'manager-1', {
      ...baseDto,
      discount: undefined,
    });

    expect(queryRunner.query).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      expect.arrayContaining(['service-1', 'manager-1', 150000, 0]),
    );
  });

  it('UT-64-06: Reject missing JWT on manager endpoint', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, ManagerServiceConfigsController.prototype.createService);

    expect(guards).toHaveLength(2);
  });

  it('UT-64-07: Reject authenticated non-manager role', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, ManagerServiceConfigsController.prototype.createService);

    expect(roles).toEqual([AccountRole.CLINIC_MANAGER]);
  });

  it('UT-64-08: Reject non-existing category lookup', async () => {
    const { serviceContext } = createServiceContext({ categoryExists: [] });

    await expect(
      ServiceConfigsService.prototype.createService.call(serviceContext, 'manager-1', baseDto),
    ).rejects.toThrow(new NotFoundException(`Category with ID ${baseDto.categoryId} not found.`));
  });

  it('UT-64-09: Reject missing required DTO fields', async () => {
    const messages = await collectMessages({});

    expect(messages).toContain('Category ID is required');
    expect(messages).toContain('Service Name is required');
    expect(messages).toContain('Service Code is required');
    expect(messages).toContain('Price is required');
  });

  it('UT-64-10: Reject invalid base field types and formats', async () => {
    const messages = await collectMessages({
      categoryId: 'invalid',
      serviceName: 123,
      serviceCode: 456,
      description: 789,
      price: 'abc',
      discount: 'abc',
      durationMin: 'abc',
      noteForPatient: 123,
    });

    expect(messages).toContain('Invalid Category ID format');
    expect(messages).toContain('Service Name must be a string');
    expect(messages).toContain('Service Code must be a string');
    expect(messages).toContain('Description must be a string');
    expect(messages).toContain('Price must be a number');
    expect(messages).toContain('Discount must be a number');
    expect(messages).toContain('Duration must be a number');
    expect(messages).toContain('Note for patient must be a string');
  });

  it('UT-64-11: Reject invalid serviceFunctions payload shape', async () => {
    const messages = await collectMessages({ ...baseDto, serviceFunctions: 'invalid' });

    expect(messages).toContain('Service Functions must be an array');
  });

  it('UT-64-12: Reject negative price value', async () => {
    const messages = await collectMessages({ ...baseDto, price: -1 });

    expect(messages).toContain('Price must be greater than or equal to 0');
  });

  it('UT-64-13: Reject discount above maximum', async () => {
    const messages = await collectMessages({ ...baseDto, discount: 101 });

    expect(messages).toContain('Discount cannot exceed 100');
  });

  it('UT-64-14: Reject durationMin below minimum', async () => {
    const messages = await collectMessages({ ...baseDto, durationMin: 0 });

    expect(messages).toContain('Duration must be at least 1 minute');
  });

  it('UT-64-15: Reject wrong optional text and array element types', async () => {
    const messages = await collectMessages({
      ...baseDto,
      serviceCode: '',
      description: 123,
      serviceFunctions: ['ok', 123],
      noteForPatient: 456,
    });

    expect(messages).toContain('Service Code is required');
    expect(messages).toContain('Description must be a string');
    expect(messages).toContain('Each function must be a string');
    expect(messages).toContain('Note for patient must be a string');
  });

  it('UT-64-16: Bubble runtime error from transactional insert', async () => {
    const { serviceContext, queryRunner } = createServiceContext({ runtimeError: true });

    await expect(
      ServiceConfigsService.prototype.createService.call(serviceContext, 'manager-1', baseDto),
    ).rejects.toThrow('db failed');
    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
  });

  it('UT-64-17: Accept zero price boundary', async () => {
    const messages = await collectMessages({ ...baseDto, price: 0 });

    expect(messages).toEqual([]);
  });

  it('UT-64-18: Accept discount at 100 boundary', async () => {
    const messages = await collectMessages({ ...baseDto, discount: 100 });

    expect(messages).toEqual([]);
  });

  it('UT-64-19: Accept durationMin at minimum boundary', async () => {
    const messages = await collectMessages({ ...baseDto, durationMin: 1 });

    expect(messages).toEqual([]);
  });
});
