import { NotFoundException, ParseUUIDPipe } from '@nestjs/common';

import { ClinicServicesController } from '../../../../src/modules/clinic-services/clinic-services.controller';
import { ClinicServicesService } from '../../../../src/modules/clinic-services/clinic-services.service';

describe('UC-59 View Clinic Service Category', () => {
  const createServiceContext = ({
    categories = [{ _id: 'cat-1', categoryName: 'General', type: 'CONSULTATION' }],
    category = { _id: 'cat-1', categoryName: 'General', type: 'CONSULTATION' },
    clinicUsage = [{ clinicName: 'Sunrise Clinic' }],
    listThrows = false,
    detailThrows = false,
  }: any = {}) => ({
    clinicServiceCategoryRepository: {
      findAll: jest.fn().mockImplementation(async () => {
        if (listThrows) {
          throw new Error('db failed');
        }
        return categories;
      }),
      findById: jest.fn().mockImplementation(async () => {
        if (detailThrows) {
          throw new Error('db failed');
        }
        return category;
      }),
    },
    clinicServiceConfigRepository: {
      findClinicsByCategoryId: jest.fn().mockResolvedValue(clinicUsage),
    },
    getCategoryById: ClinicServicesService.prototype.getCategoryById,
    getClinicsUsingCategory: ClinicServicesService.prototype.getClinicsUsingCategory,
  }) as any;

  it('UT-59-01: View all service categories successfully.', async () => {
    const serviceContext = createServiceContext();

    const result = await ClinicServicesService.prototype.getAllCategories.call(serviceContext);

    expect(result).toHaveLength(1);
  });

  it('UT-59-02: View category detail with clinic usage.', async () => {
    const controllerContext = {
      clinicServicesService: {
        getCategoryById: jest
          .fn()
          .mockResolvedValue({ _id: 'cat-1', categoryName: 'General', type: 'CONSULTATION' }),
        getClinicsUsingCategory: jest.fn().mockResolvedValue([{ clinicName: 'Sunrise Clinic' }]),
      },
    } as any;

    const result = await ClinicServicesController.prototype.getCategoryById.call(
      controllerContext,
      'cat-1',
    );

    expect(result.clinicCount).toBe(1);
    expect(result.clinicUsage).toEqual([{ clinicName: 'Sunrise Clinic' }]);
  });

  it('UT-59-03: View category detail with empty clinic usage.', async () => {
    const controllerContext = {
      clinicServicesService: {
        getCategoryById: jest
          .fn()
          .mockResolvedValue({ _id: 'cat-1', categoryName: 'General', type: 'CONSULTATION' }),
        getClinicsUsingCategory: jest.fn().mockResolvedValue([]),
      },
    } as any;

    const result = await ClinicServicesController.prototype.getCategoryById.call(
      controllerContext,
      'cat-1',
    );

    expect(result.clinicCount).toBe(0);
  });

  it('UT-59-04: Reject invalid UUID in category detail.', async () => {
    const pipe = new ParseUUIDPipe();

    await expect(pipe.transform('invalid_uuid', {} as any)).rejects.toThrow(
      'Validation failed (uuid is expected)',
    );
  });

  it('UT-59-05: Return not found for unknown category id.', async () => {
    const serviceContext = createServiceContext({ category: null });

    await expect(
      ClinicServicesService.prototype.getCategoryById.call(serviceContext, 'missing-id'),
    ).rejects.toThrow(new NotFoundException('Category with ID missing-id not found.'));
  });

  it('UT-59-06: Return internal error when data source fails.', async () => {
    const serviceContext = createServiceContext({ detailThrows: true });

    await expect(
      ClinicServicesService.prototype.getCategoryById.call(serviceContext, 'cat-1'),
    ).rejects.toThrow('db failed');
  });

  it('UT-59-07: List endpoint returns empty array.', async () => {
    const serviceContext = createServiceContext({ categories: [] });

    const result = await ClinicServicesService.prototype.getAllCategories.call(serviceContext);

    expect(result).toEqual([]);
  });

  it('UT-59-08: Detail response clinicCount boundary equals zero.', async () => {
    const controllerContext = {
      clinicServicesService: {
        getCategoryById: jest
          .fn()
          .mockResolvedValue({ _id: 'cat-1', categoryName: 'General', type: 'CONSULTATION' }),
        getClinicsUsingCategory: jest.fn().mockResolvedValue([]),
      },
    } as any;

    const result = await ClinicServicesController.prototype.getCategoryById.call(
      controllerContext,
      'cat-1',
    );

    expect(result.clinicCount).toBe(0);
  });
});
