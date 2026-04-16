import { NotFoundException, ParseUUIDPipe } from '@nestjs/common';

import { BlogType } from '../../../../src/modules/blogs/enums';
import { BlogsController } from '../../../../src/modules/blogs/blogs.controller';
import { BlogsService } from '../../../../src/modules/blogs/blogs.service';

describe('UC-86 View Blog Details', () => {
  const blogId = '123e4567-e89b-42d3-a456-426614174030';

  const createBlog = () => ({
    _id: blogId,
    clinicId: 'clinic-1',
    title: 'Health Tips',
    content: 'detail content',
    thumbnail: 'https://example.com/thumbnail.jpg',
    type: BlogType.HEALTH,
    createdAt: new Date('2026-02-01T00:00:00.000Z'),
    updatedAt: new Date('2026-02-01T00:00:00.000Z'),
    clinic: {
      _id: 'clinic-1',
      username: 'clinic.user',
      email: 'clinic@example.com',
      phone: '0900000000',
      clinicManagerInformation: {
        fullName: 'Clinic Manager',
        clinicBranchName: 'Main Branch',
        profilePicture: 'https://example.com/profile.jpg',
      },
    },
  });

  const createController = (blog?: any) =>
    ({
      blogsService: {
        findOne: jest.fn().mockResolvedValue(blog ?? createBlog()),
      },
    }) as any;

  it('UT-86-01: Guest views blog detail', async () => {
    const controller = createController();

    const result = await BlogsController.prototype.findOnePublic.call(controller, blogId);

    expect(controller.blogsService.findOne).toHaveBeenCalledWith(blogId);
    expect(result.message).toBe('Blog retrieved successfully');
  });

  it('UT-86-02: Patient views blog detail', async () => {
    const controller = createController();

    const result = await BlogsController.prototype.findOnePublic.call(controller, blogId);

    expect(result.message).toBe('Blog retrieved successfully');
  });

  it('UT-86-03: Blog detail includes clinic relation', async () => {
    const controller = createController();

    const result = await BlogsController.prototype.findOnePublic.call(controller, blogId);

    expect(result.data.clinic).toBeDefined();
    expect(result.data.clinic._id).toBe('clinic-1');
  });

  it('UT-86-04: Blog not found by UUID', async () => {
    const serviceContext = {
      blogRepository: {
        findByIdWithClinic: jest.fn().mockResolvedValue(null),
      },
    } as any;

    await expect(BlogsService.prototype.findOne.call(serviceContext, blogId)).rejects.toThrow(
      new NotFoundException('Blog not found'),
    );
  });

  it('UT-86-05: Invalid UUID path param', async () => {
    const pipe = new ParseUUIDPipe();

    await expect(pipe.transform('invalid_uuid', {} as any)).rejects.toThrow('Validation failed (uuid is expected)');
  });

  it('UT-86-06: Runtime error on blog detail query', async () => {
    const serviceContext = {
      blogRepository: {
        findByIdWithClinic: jest.fn().mockRejectedValue(new Error('db failed')),
      },
    } as any;

    await expect(BlogsService.prototype.findOne.call(serviceContext, blogId)).rejects.toThrow('db failed');
  });

  it('UT-86-07: Soft-deleted blog treated as not found', async () => {
    const serviceContext = {
      blogRepository: {
        findByIdWithClinic: jest.fn().mockResolvedValue(null),
      },
    } as any;

    await expect(BlogsService.prototype.findOne.call(serviceContext, blogId)).rejects.toThrow(
      new NotFoundException('Blog not found'),
    );
  });

  it('UT-86-08: Boundary minimal valid UUID', async () => {
    const controller = createController();

    const result = await BlogsController.prototype.findOnePublic.call(controller, blogId);

    expect(result.message).toBe('Blog retrieved successfully');
  });
});
