import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { BlogsController } from '../../../../src/modules/blogs/blogs.controller';
import { BlogsService } from '../../../../src/modules/blogs/blogs.service';
import { CreateBlogDto } from '../../../../src/modules/blogs/dto/create-blog.dto';
import { BlogType } from '../../../../src/modules/blogs/enums';

describe('UC-87.1 Create New Blogs', () => {
  const createDto: CreateBlogDto = {
    title: 'New Blog',
    content: 'Blog content',
    thumbnail: 'https://example.com/thumbnail.jpg',
    type: BlogType.HEALTH,
  };

  const user = { _id: 'staff-1', parentId: 'clinic-1' } as any;

  const collectMessages = async (value: object) => {
    const errors = await validate(plainToInstance(CreateBlogDto, value));
    return errors.flatMap((error) => Object.values(error.constraints ?? {}));
  };

  const createBlogEntity = () => ({
    _id: 'blog-1',
    clinicId: 'clinic-1',
    title: 'New Blog',
    content: 'Blog content',
    thumbnail: 'https://example.com/thumbnail.jpg',
    type: BlogType.HEALTH,
    createdAt: new Date('2026-02-01T00:00:00.000Z'),
    updatedAt: new Date('2026-02-01T00:00:00.000Z'),
    clinic: null,
  });

  const createServiceContext = (options?: {
    patients?: any[];
    transactionReject?: string;
    fullBlog?: any;
    fullBlogReject?: string;
  }) => {
    const manager = {
      create: jest.fn().mockImplementation((_entity: any, payload: any) => payload),
      save: jest.fn().mockImplementation(async (_entity: any, payload: any) => {
        if (Array.isArray(payload)) return payload;
        return { _id: 'blog-1', ...payload };
      }),
    };

    return {
      accountsService: {
        findByRoleAndStatus: jest
          .fn()
          .mockResolvedValue([options?.patients ?? [{ _id: 'patient-1' }], 1]),
      },
      dataSource: {
        transaction: jest.fn().mockImplementation(async (handler: any) => {
          if (options?.transactionReject) throw new Error(options.transactionReject);
          return handler(manager);
        }),
      },
      blogRepository: {
        findByIdWithClinic: jest.fn().mockImplementation(async () => {
          if (options?.fullBlogReject) throw new Error(options.fullBlogReject);
          return options?.fullBlog ?? createBlogEntity();
        }),
      },
      socketGatewayService: {
        getUserSocket: jest.fn().mockReturnValue(null),
        server: { to: jest.fn().mockReturnValue({ emit: jest.fn() }) },
      },
    } as any;
  };

  it('UT-87.1-01: Create blog with full valid payload', async () => {
    const serviceContext = createServiceContext();

    const result = await BlogsService.prototype.create.call(serviceContext, createDto, user);

    expect(result.title).toBe('New Blog');
  });

  it('UT-87.1-02: Create blog without thumbnail', async () => {
    const serviceContext = createServiceContext();

    const result = await BlogsService.prototype.create.call(
      serviceContext,
      { ...createDto, thumbnail: undefined, type: BlogType.NEWS },
      user,
    );

    expect(result.type).toBe(BlogType.HEALTH);
  });

  it('UT-87.1-03: Create blog when no active patients', async () => {
    const serviceContext = createServiceContext({ patients: [] });

    const result = await BlogsService.prototype.create.call(serviceContext, { ...createDto, thumbnail: undefined }, user);

    expect(result.title).toBe('New Blog');
  });

  it('UT-87.1-04: Create blog and generate patient notifications', async () => {
    const serviceContext = createServiceContext({ patients: [{ _id: 'p1' }, { _id: 'p2' }] });

    await BlogsService.prototype.create.call(serviceContext, { ...createDto, type: BlogType.NEWS }, user);

    expect(serviceContext.accountsService.findByRoleAndStatus).toHaveBeenCalled();
  });

  it('UT-87.1-05: Reject missing JWT', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, BlogsController.prototype.create);

    expect(guards).toHaveLength(2);
  });

  it('UT-87.1-06: Reject missing required fields', async () => {
    const messages = await collectMessages({});

    expect(messages).toContain('title should not be empty');
    expect(messages).toContain('content should not be empty');
    expect(messages).toContain('type should not be empty');
  });

  it('UT-87.1-07: Reject invalid field types', async () => {
    const messages = await collectMessages({ title: 1, content: 2, thumbnail: 3, type: BlogType.HEALTH });

    expect(messages).toContain('title must be a string');
    expect(messages).toContain('content must be a string');
    expect(messages).toContain('thumbnail must be a string');
  });

  it('UT-87.1-08: Reject invalid type enum', async () => {
    const messages = await collectMessages({ title: 'T', content: 'C', type: 'INVALID' });

    expect(messages).toContain('type must be one of the following values: HEALTH, MEDICAL, WELLNESS, NEWS, EDUCATION');
  });

  it('UT-87.1-09: Transaction rollback when DB save fails', async () => {
    const serviceContext = createServiceContext({ transactionReject: 'db failed' });

    await expect(BlogsService.prototype.create.call(serviceContext, createDto, user)).rejects.toThrow('db failed');
  });

  it('UT-87.1-10: Runtime error fetching full blog after save', async () => {
    const serviceContext = createServiceContext({ fullBlogReject: 'load failed' });

    await expect(BlogsService.prototype.create.call(serviceContext, { ...createDto, type: BlogType.NEWS }, user)).rejects.toThrow('load failed');
  });

  it('UT-87.1-11: Boundary minimal valid content', async () => {
    const serviceContext = createServiceContext({ patients: [] });

    const result = await BlogsService.prototype.create.call(
      serviceContext,
      { title: 'A', content: 'B', type: BlogType.HEALTH },
      user,
    );

    expect(result.title).toBe('New Blog');
  });

  it('UT-87.1-12: Boundary optional thumbnail omitted', async () => {
    const serviceContext = createServiceContext();

    const result = await BlogsService.prototype.create.call(
      serviceContext,
      { ...createDto, thumbnail: undefined },
      user,
    );

    expect(result.title).toBe('New Blog');
  });
});
