import { BadRequestException, NotFoundException, ParseUUIDPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ClinicServicesService } from '../../../../src/modules/clinic-services/clinic-services.service';
import { UpdateClinicServiceCategoryDto } from '../../../../src/modules/clinic-services/dto/update-clinic-service-category.dto';
import { ServiceCategoryType } from '../../../../src/modules/clinic-services/enums/service-category-type.enum';

describe('UC-61 Update Clinic Service Category', () => {
  const collectMessages = async (dto: object) => {
    const errors = await validate(plainToInstance(UpdateClinicServiceCategoryDto, dto));
    return errors.flatMap((error) => Object.values(error.constraints ?? {}));
  };

  const createServiceContext = ({
    category = { _id: 'cat-1', categoryName: 'General', type: ServiceCategoryType.CONSULTATION },
    typeConflict = null,
    saveThrows = false,
  }: any = {}) => ({
    clinicServiceCategoryRepository: {
      findById: jest.fn().mockResolvedValue(category),
      findByType: jest.fn().mockResolvedValue(typeConflict),
      save: jest.fn().mockImplementation(async (payload) => {
        if (saveThrows) {
          throw new Error('db failed');
        }
        return payload;
      }),
    },
    getCategoryById: ClinicServicesService.prototype.getCategoryById,
  }) as any;

  it('UT-61-01: Update category name successfully.', async () => {
    const serviceContext = createServiceContext();

    const result = await ClinicServicesService.prototype.updateCategory.call(serviceContext, 'cat-1', {
      categoryName: 'Updated Category',
    });

    expect(result.categoryName).toBe('Updated Category');
    expect(result.type).toBe(ServiceCategoryType.CONSULTATION);
  });

  it('UT-61-02: Update category type to unique value successfully.', async () => {
    const serviceContext = createServiceContext();

    const result = await ClinicServicesService.prototype.updateCategory.call(serviceContext, 'cat-1', {
      type: ServiceCategoryType.XRAY,
    });

    expect(result.type).toBe(ServiceCategoryType.XRAY);
  });

  it('UT-61-03: Partial update with omitted fields.', async () => {
    const serviceContext = createServiceContext();

    const result = await ClinicServicesService.prototype.updateCategory.call(serviceContext, 'cat-1', {});

    expect(result.categoryName).toBe('General');
  });

  it('UT-61-04: Reject invalid UUID.', async () => {
    const pipe = new ParseUUIDPipe();

    await expect(pipe.transform('invalid_uuid', {} as any)).rejects.toThrow(
      'Validation failed (uuid is expected)',
    );
  });

  it('UT-61-05: Reject when category not found.', async () => {
    const serviceContext = createServiceContext({ category: null });

    await expect(
      ClinicServicesService.prototype.updateCategory.call(serviceContext, 'missing-id', {
        categoryName: 'Updated Category',
      }),
    ).rejects.toThrow(new NotFoundException('Category with ID missing-id not found.'));
  });

  it('UT-61-06: Reject duplicate target type.', async () => {
    const serviceContext = createServiceContext({ typeConflict: { _id: 'cat-2' } });

    await expect(
      ClinicServicesService.prototype.updateCategory.call(serviceContext, 'cat-1', {
        type: ServiceCategoryType.XRAY,
      }),
    ).rejects.toThrow(new BadRequestException('Category with type XRAY already exists.'));
  });

  it('UT-61-07: Reject invalid DTO type and enum fields.', async () => {
    const messages = await collectMessages({
      categoryName: 123,
      type: 'INVALID',
    });

    expect(messages).toContain('Category Name must be a string');
    expect(messages).toContain('Invalid Category Type');
  });

  it('UT-61-08: Boundary update with same type succeeds.', async () => {
    const serviceContext = createServiceContext({
      category: { _id: 'cat-1', categoryName: 'General', type: ServiceCategoryType.XRAY },
    });

    const result = await ClinicServicesService.prototype.updateCategory.call(serviceContext, 'cat-1', {
      categoryName: 'Updated Category',
      type: ServiceCategoryType.XRAY,
    });

    expect(result.type).toBe(ServiceCategoryType.XRAY);
    expect(serviceContext.clinicServiceCategoryRepository.findByType).not.toHaveBeenCalled();
  });

  it('UT-61-09: Boundary runtime persistence failure.', async () => {
    const serviceContext = createServiceContext({ saveThrows: true });

    await expect(
      ClinicServicesService.prototype.updateCategory.call(serviceContext, 'cat-1', {
        categoryName: 'Updated Category',
        type: ServiceCategoryType.XRAY,
      }),
    ).rejects.toThrow('db failed');
  });
});
