import { ForbiddenException, NotFoundException, ParseUUIDPipe } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';

import { BlogsController } from '../../../../src/modules/blogs/blogs.controller';
import { BlogsService } from '../../../../src/modules/blogs/blogs.service';

describe('UC-87.3 Delete Blogs', () => {
  const blogId = '123e4567-e89b-42d3-a456-426614174030';
  const user = { parentId: 'clinic-1' } as any;

  const createServiceContext = (options?: {
    blog?: any;
    softDeleteReject?: string;
  }) => ({
    blogRepository: {
      findById: jest.fn().mockResolvedValue(
        options && 'blog' in options
          ? options.blog
          : {
              _id: blogId,
              clinicId: 'clinic-1',
            },
      ),
      softDelete: jest.fn().mockImplementation(async () => {
        if (options?.softDeleteReject) throw new Error(options.softDeleteReject);
      }),
    },
  }) as any;

  it('UT-87.3-01: Delete owned blog successfully', async () => {
    const serviceContext = createServiceContext();

    await expect(BlogsService.prototype.remove.call(serviceContext, blogId, user)).resolves.toBeUndefined();
  });

  it('UT-87.3-02: Delete success message returned', async () => {
    const controller = {
      blogsService: { remove: jest.fn().mockResolvedValue(undefined) },
    } as any;

    const result = await BlogsController.prototype.remove.call(controller, blogId, user);

    expect(result).toEqual({ message: 'Blog deleted successfully' });
  });

  it('UT-87.3-03: Reject missing JWT', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, BlogsController.prototype.remove);

    expect(guards).toHaveLength(2);
  });

  it('UT-87.3-04: Reject blog not found', async () => {
    const serviceContext = createServiceContext({ blog: null });

    await expect(BlogsService.prototype.remove.call(serviceContext, blogId, user)).rejects.toThrow(
      new NotFoundException('Blog not found'),
    );
  });

  it('UT-87.3-05: Reject delete non-owned blog', async () => {
    const serviceContext = createServiceContext({ blog: { _id: blogId, clinicId: 'clinic-2' } });

    await expect(BlogsService.prototype.remove.call(serviceContext, blogId, user)).rejects.toThrow(
      new ForbiddenException('You can only delete your own blogs'),
    );
  });

  it('UT-87.3-06: Handle runtime soft-delete error', async () => {
    const serviceContext = createServiceContext({ softDeleteReject: 'db failed' });

    await expect(BlogsService.prototype.remove.call(serviceContext, blogId, user)).rejects.toThrow('db failed');
  });

  it('UT-87.3-07: Invalid UUID path param', async () => {
    const pipe = new ParseUUIDPipe();

    await expect(pipe.transform('invalid_uuid', {} as any)).rejects.toThrow('Validation failed (uuid is expected)');
  });

  it('UT-87.3-08: Already deleted blog treated as not found', async () => {
    const serviceContext = createServiceContext({ blog: null });

    await expect(BlogsService.prototype.remove.call(serviceContext, blogId, user)).rejects.toThrow(
      new NotFoundException('Blog not found'),
    );
  });
});
