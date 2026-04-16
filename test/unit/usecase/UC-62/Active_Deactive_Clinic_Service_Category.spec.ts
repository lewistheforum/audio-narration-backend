import { NotFoundException, ParseUUIDPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ClinicServicesService } from '../../../../src/modules/clinic-services/clinic-services.service';
import { UpdateClinicServiceStatusDto } from '../../../../src/modules/clinic-services/dto/update-clinic-service-status.dto';

describe('UC-62 Active Deactive Clinic Service Category', () => {
  const collectMessages = async (dto: object) => {
    const errors = await validate(plainToInstance(UpdateClinicServiceStatusDto, dto));
    return errors.flatMap((error) => Object.values(error.constraints ?? {}));
  };

  const createServiceContext = ({
    category = { _id: 'cat-1', isActive: true },
    serviceIds = [{ _id: 'svc-1' }, { _id: 'svc-2' }],
    cascadeThrows = false,
  }: any = {}) => ({
    clinicServiceCategoryRepository: {
      findById: jest.fn().mockResolvedValue(category),
      save: jest.fn().mockImplementation(async (payload) => {
        if (cascadeThrows) {
          throw new Error('db failed');
        }
        return payload;
      }),
    },
    clinicServiceRepository: {
      findByCategoryId: jest.fn().mockResolvedValue(serviceIds),
      updateStatusByCategoryId: jest.fn().mockImplementation(async () => {
        if (cascadeThrows) {
          throw new Error('db failed');
        }
      }),
    },
    clinicServiceConfigRepository: {
      updateStatusByServiceIds: jest.fn().mockImplementation(async () => {
        if (cascadeThrows) {
          throw new Error('db failed');
        }
      }),
    },
    getCategoryById: ClinicServicesService.prototype.getCategoryById,
  }) as any;

  it('UT-62-01: Activate category with cascade updates.', async () => {
    const serviceContext = createServiceContext({ category: { _id: 'cat-1', isActive: false } });

    const result = await ClinicServicesService.prototype.updateCategoryStatus.call(
      serviceContext,
      'cat-1',
      true,
    );

    expect(result.isActive).toBe(true);
    expect(serviceContext.clinicServiceRepository.updateStatusByCategoryId).toHaveBeenCalledWith(
      'cat-1',
      true,
    );
  });

  it('UT-62-02: Deactivate category with cascade updates.', async () => {
    const serviceContext = createServiceContext();

    const result = await ClinicServicesService.prototype.updateCategoryStatus.call(
      serviceContext,
      'cat-1',
      false,
    );

    expect(result.isActive).toBe(false);
    expect(serviceContext.clinicServiceConfigRepository.updateStatusByServiceIds).toHaveBeenCalledWith(
      ['svc-1', 'svc-2'],
      false,
    );
  });

  it('UT-62-03: Toggle category with no linked services.', async () => {
    const serviceContext = createServiceContext({ serviceIds: [] });

    const result = await ClinicServicesService.prototype.updateCategoryStatus.call(
      serviceContext,
      'cat-1',
      false,
    );

    expect(result.isActive).toBe(false);
    expect(serviceContext.clinicServiceRepository.updateStatusByCategoryId).not.toHaveBeenCalled();
  });

  it('UT-62-04: Reject invalid UUID.', async () => {
    const pipe = new ParseUUIDPipe();

    await expect(pipe.transform('invalid_uuid', {} as any)).rejects.toThrow(
      'Validation failed (uuid is expected)',
    );
  });

  it('UT-62-05: Reject non-existing category id.', async () => {
    const serviceContext = createServiceContext({ category: null });

    await expect(
      ClinicServicesService.prototype.updateCategoryStatus.call(serviceContext, 'missing-id', true),
    ).rejects.toThrow(new NotFoundException('Category with ID missing-id not found.'));
  });

  it('UT-62-06: Reject missing isActive field.', async () => {
    const messages = await collectMessages({});

    expect(messages).toContain('Is Active is required');
  });

  it('UT-62-07: Reject invalid isActive type.', async () => {
    const messages = await collectMessages({ isActive: 'yes' });

    expect(messages).toContain('Is Active must be a boolean');
  });

  it('UT-62-08: Boundary exact boolean true accepted.', async () => {
    const messages = await collectMessages({ isActive: true });

    expect(messages).toEqual([]);
  });

  it('UT-62-09: Boundary exact boolean false accepted.', async () => {
    const messages = await collectMessages({ isActive: false });

    expect(messages).toEqual([]);
  });

  it('UT-62-10: Cascade update runtime failure.', async () => {
    const serviceContext = createServiceContext({ cascadeThrows: true });

    await expect(
      ClinicServicesService.prototype.updateCategoryStatus.call(serviceContext, 'cat-1', false),
    ).rejects.toThrow('db failed');
  });
});
