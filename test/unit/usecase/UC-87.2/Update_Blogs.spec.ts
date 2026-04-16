import { ForbiddenException, NotFoundException, ParseUUIDPipe } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { BlogsController } from '../../../../src/modules/blogs/blogs.controller';
import { BlogsService } from '../../../../src/modules/blogs/blogs.service';
import { UpdateBlogDto } from '../../../../src/modules/blogs/dto/update-blog.dto';
import { BlogType } from '../../../../src/modules/blogs/enums';

describe('UC-87.2 Update Blogs', () => {
  const blogId = '123e4567-e89b-42d3-a456-426614174030';
  const user = { parentId: 'clinic-1' } as any;

  const collectMessages = async (value: object) => {
    const errors = await validate(plainToInstance(UpdateBlogDto, value));
    return errors.flatMap((error) => Object.values(error.constraints ?? {}));
  };

  const createBlog = (clinicId = 'clinic-1') => ({
    _id: blogId,
    clinicId,
    title: 'Old title',
    content: 'Old content',
    thumbnail: 'https://example.com/old.jpg',
    type: BlogType.NEWS,
  });

  const createServiceContext = (options?: {
    blog?: any;
    saveReject?: string;
    findOneReject?: string;
  }) => ({
    blogRepository: {
      findById: jest
        .fn()
        .mockResolvedValue(options && 'blog' in options ? options.blog : createBlog()),
      saveBlog: jest.fn().mockImplementation(async () => {
        if (options?.saveReject) throw new Error(options.saveReject);
      }),
    },
    findOne: jest.fn().mockImplementation(async () => {
      if (options?.findOneReject) throw new Error(options.findOneReject);
      return { id: blogId, title: 'Updated' };
    }),
  }) as any;

  it('UT-87.2-01: Update owned blog full fields', async () => {
    const serviceContext = createServiceContext();

    const result = await BlogsService.prototype.update.call(
      serviceContext,
      blogId,
      { title: 'New', content: 'New content', thumbnail: 'https://example.com/new.jpg', type: BlogType.HEALTH },
      user,
    );

    expect(result).toEqual({ id: blogId, title: 'Updated' });
  });

  it('UT-87.2-02: Partial update content only', async () => {
    const serviceContext = createServiceContext();

    const result = await BlogsService.prototype.update.call(serviceContext, blogId, { content: 'Changed' }, user);

    expect(result).toEqual({ id: blogId, title: 'Updated' });
  });

  it('UT-87.2-03: Update blog type', async () => {
    const serviceContext = createServiceContext();

    const result = await BlogsService.prototype.update.call(serviceContext, blogId, { type: BlogType.HEALTH }, user);

    expect(result).toEqual({ id: blogId, title: 'Updated' });
  });

  it('UT-87.2-04: Update thumbnail only', async () => {
    const serviceContext = createServiceContext();

    const result = await BlogsService.prototype.update.call(serviceContext, blogId, { thumbnail: 'https://example.com/new-thumb.jpg' }, user);

    expect(result).toEqual({ id: blogId, title: 'Updated' });
  });

  it('UT-87.2-05: Reject missing JWT', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, BlogsController.prototype.update);

    expect(guards).toHaveLength(2);
  });

  it('UT-87.2-06: Reject non-existing blog', async () => {
    const serviceContext = createServiceContext({ blog: null });

    await expect(BlogsService.prototype.update.call(serviceContext, blogId, { title: 'New' }, user)).rejects.toThrow(
      new NotFoundException('Blog not found'),
    );
  });

  it('UT-87.2-07: Reject update non-owned blog', async () => {
    const serviceContext = createServiceContext({ blog: createBlog('clinic-2') });

    await expect(BlogsService.prototype.update.call(serviceContext, blogId, { title: 'New' }, user)).rejects.toThrow(
      new ForbiddenException('You can only update your own blogs'),
    );
  });

  it('UT-87.2-08: Reject invalid DTO payload', async () => {
    const messages = await collectMessages({ title: 1, content: 2, thumbnail: 3, type: 'INVALID' });

    expect(messages).toContain('title must be a string');
    expect(messages).toContain('content must be a string');
    expect(messages).toContain('thumbnail must be a string');
    expect(messages).toContain('type must be one of the following values: HEALTH, MEDICAL, WELLNESS, NEWS, EDUCATION');
  });

  it('UT-87.2-09: Runtime update error', async () => {
    const serviceContext = createServiceContext({ saveReject: 'db failed' });

    await expect(BlogsService.prototype.update.call(serviceContext, blogId, { title: 'New' }, user)).rejects.toThrow('db failed');
  });

  it('UT-87.2-10: Boundary empty patch object', async () => {
    const serviceContext = createServiceContext();

    const result = await BlogsService.prototype.update.call(serviceContext, blogId, {}, user);

    expect(result).toEqual({ id: blogId, title: 'Updated' });
  });

  it('UT-87.2-11: Boundary single-field update with valid UUID', async () => {
    const pipe = new ParseUUIDPipe();
    const serviceContext = createServiceContext();

    await expect(pipe.transform(blogId, {} as any)).resolves.toBe(blogId);
    const result = await BlogsService.prototype.update.call(serviceContext, blogId, { title: 'Only title' }, user);
    expect(result).toEqual({ id: blogId, title: 'Updated' });
  });
});
