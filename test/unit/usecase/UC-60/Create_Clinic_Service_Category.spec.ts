import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ClinicServicesService } from '../../../../src/modules/clinic-services/clinic-services.service';
import { CreateClinicServiceCategoryDto } from '../../../../src/modules/clinic-services/dto/create-clinic-service-category.dto';
import { ServiceCategoryType } from '../../../../src/modules/clinic-services/enums/service-category-type.enum';

describe('UC-60 Create Clinic Service Category', () => {
  const collectMessages = async (dto: object) => {
    const errors = await validate(plainToInstance(CreateClinicServiceCategoryDto, dto));
    return errors.flatMap((error) => Object.values(error.constraints ?? {}));
  };

  const createServiceContext = ({ existingType = null, saveThrows = false }: any = {}) => ({
    clinicServiceCategoryRepository: {
      findByType: jest.fn().mockResolvedValue(existingType),
      create: jest.fn().mockImplementation((payload) => payload),
      save: jest.fn().mockImplementation(async (payload) => {
        if (saveThrows) {
          throw new Error('db failed');
        }
        return payload;
      }),
    },
  }) as any;

  it('UT-60-01: Create category successfully.', async () => {
    const serviceContext = createServiceContext();

    const result = await ClinicServicesService.prototype.createCategory.call(serviceContext, {
      categoryName: 'General Checkup',
      type: ServiceCategoryType.CONSULTATION,
    });

    expect(result.categoryName).toBe('General Checkup');
    expect(result.type).toBe(ServiceCategoryType.CONSULTATION);
  });

  it('UT-60-02: Create category successfully with another valid enum value.', async () => {
    const serviceContext = createServiceContext();

    const result = await ClinicServicesService.prototype.createCategory.call(serviceContext, {
      categoryName: 'Imaging',
      type: ServiceCategoryType.XRAY,
    });

    expect(result.type).toBe(ServiceCategoryType.XRAY);
  });

  it('UT-60-03: Reject missing categoryName.', async () => {
    const messages = await collectMessages({ type: ServiceCategoryType.CONSULTATION });

    expect(messages).toContain('Category Name is required');
  });

  it('UT-60-04: Reject invalid categoryName data type.', async () => {
    const messages = await collectMessages({ categoryName: 123, type: ServiceCategoryType.CONSULTATION });

    expect(messages).toContain('Category Name must be a string');
  });

  it('UT-60-05: Reject invalid or missing category type.', async () => {
    const invalidMessages = await collectMessages({
      categoryName: 'General Checkup',
      type: 'INVALID',
    });
    const missingMessages = await collectMessages({ categoryName: 'General Checkup' });

    expect(invalidMessages).toContain('Invalid Category Type');
    expect(missingMessages).toContain('Type is required');
  });

  it('UT-60-06: Reject duplicate category type.', async () => {
    const serviceContext = createServiceContext({ existingType: { _id: 'cat-1' } });

    await expect(
      ClinicServicesService.prototype.createCategory.call(serviceContext, {
        categoryName: 'Duplicate Name',
        type: ServiceCategoryType.CONSULTATION,
      }),
    ).rejects.toThrow(new BadRequestException('Category with type CONSULTATION already exists.'));
  });

  it('UT-60-07: Return internal error when save fails.', async () => {
    const serviceContext = createServiceContext({ saveThrows: true });

    await expect(
      ClinicServicesService.prototype.createCategory.call(serviceContext, {
        categoryName: 'General Checkup',
        type: ServiceCategoryType.CONSULTATION,
      }),
    ).rejects.toThrow('db failed');
  });

  it('UT-60-08: Boundary minimal non-empty categoryName accepted.', async () => {
    const serviceContext = createServiceContext();

    const result = await ClinicServicesService.prototype.createCategory.call(serviceContext, {
      categoryName: 'A',
      type: ServiceCategoryType.LAB,
    });

    expect(result.categoryName).toBe('A');
  });

  it('UT-60-09: Boundary enum extremes accepted.', async () => {
    const serviceContext = createServiceContext();

    const first = await ClinicServicesService.prototype.createCategory.call(serviceContext, {
      categoryName: 'First',
      type: ServiceCategoryType.CONSULTATION,
    });
    const last = await ClinicServicesService.prototype.createCategory.call(serviceContext, {
      categoryName: 'Last',
      type: ServiceCategoryType.PROCEDURE,
    });

    expect(first.type).toBe(ServiceCategoryType.CONSULTATION);
    expect(last.type).toBe(ServiceCategoryType.PROCEDURE);
  });
});
