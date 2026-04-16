import { BlogType } from '../../../../src/modules/blogs/enums';
import { BlogsController } from '../../../../src/modules/blogs/blogs.controller';
import { BlogsService } from '../../../../src/modules/blogs/blogs.service';

describe('UC-85 Browse Health Blogs', () => {
  const createBlog = (id: string, type: BlogType, createdAt: string) => ({
    _id: id,
    clinicId: 'clinic-1',
    title: `Blog ${id}`,
    content: 'content',
    thumbnail: undefined,
    type,
    createdAt: new Date(createdAt),
    updatedAt: new Date(createdAt),
    clinic: null,
  });

  const createController = (result?: any) =>
    ({
      blogsService: {
        findAll: jest.fn().mockResolvedValue(
          result ?? {
            data: [createBlog('blog-1', BlogType.HEALTH, '2026-02-01T00:00:00.000Z')],
            pagination: { page: 1, limit: 6, total: 1, totalPages: 1 },
          },
        ),
      },
    }) as any;

  it('UT-85-01: Browse default feed as guest', async () => {
    const controller = createController();

    const result = await BlogsController.prototype.findAll.call(controller, undefined, undefined, undefined);

    expect(controller.blogsService.findAll).toHaveBeenCalledWith(1, 6, undefined);
    expect(result.message).toBe('Blogs retrieved successfully');
  });

  it('UT-85-02: Browse with custom pagination as patient', async () => {
    const controller = createController();

    const result = await BlogsController.prototype.findAll.call(controller, 3, 12, undefined);

    expect(controller.blogsService.findAll).toHaveBeenCalledWith(3, 12, undefined);
    expect(result.message).toBe('Blogs retrieved successfully');
  });

  it('UT-85-03: Browse by blog type HEALTH', async () => {
    const controller = createController();

    const result = await BlogsController.prototype.findAll.call(controller, 1, 6, BlogType.HEALTH);

    expect(controller.blogsService.findAll).toHaveBeenCalledWith(1, 6, BlogType.HEALTH);
    expect(result.message).toBe('Blogs retrieved successfully');
  });

  it('UT-85-04: Feed sorted by newest createdAt', async () => {
    const serviceContext = {
      blogRepository: {
        findAllWithClinic: jest.fn().mockResolvedValue([
          [
            createBlog('blog-new', BlogType.HEALTH, '2026-02-01T00:00:00.000Z'),
            createBlog('blog-old', BlogType.HEALTH, '2026-01-01T00:00:00.000Z'),
          ],
          2,
        ]),
      },
    } as any;

    const result = await BlogsService.prototype.findAll.call(serviceContext, 1, 6, undefined);

    expect(result.data[0].id).toBe('blog-new');
  });

  it('UT-85-05: Repository runtime error on browse', async () => {
    const serviceContext = {
      blogRepository: {
        findAllWithClinic: jest.fn().mockRejectedValue(new Error('repository failed')),
      },
    } as any;

    await expect(BlogsService.prototype.findAll.call(serviceContext, 1, 6, undefined)).rejects.toThrow('repository failed');
  });

  it('UT-85-06: Service exception propagated', async () => {
    const controller = {
      blogsService: {
        findAll: jest.fn().mockRejectedValue(new Error('service failed')),
      },
    } as any;

    await expect(BlogsController.prototype.findAll.call(controller, 3, 12, BlogType.HEALTH)).rejects.toThrow('service failed');
  });

  it('UT-85-07: Boundary default paging fallback', async () => {
    const controller = createController();

    await BlogsController.prototype.findAll.call(controller, undefined, undefined, undefined);

    expect(controller.blogsService.findAll).toHaveBeenCalledWith(1, 6, undefined);
  });

  it('UT-85-08: Boundary empty feed response', async () => {
    const controller = createController({
      data: [],
      pagination: { page: 1, limit: 6, total: 0, totalPages: 0 },
    });

    const result = await BlogsController.prototype.findAll.call(controller, 1, 6, BlogType.HEALTH);

    expect(result.data.data).toEqual([]);
    expect(result.message).toBe('Blogs retrieved successfully');
  });
});
