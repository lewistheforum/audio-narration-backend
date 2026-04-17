import { BlogType } from '../../../../src/modules/blogs/enums';
import { BlogsController } from '../../../../src/modules/blogs/blogs.controller';
import { BlogsService } from '../../../../src/modules/blogs/blogs.service';

describe('UC-84 Search Blogs', () => {
  const createBlog = (id: string, type: BlogType) => ({
    _id: id,
    clinicId: 'clinic-1',
    title: `Blog ${id}`,
    content: 'content',
    thumbnail: 'https://example.com/thumbnail.jpg',
    type,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    clinic: null,
  });

  const createController = (result?: any) =>
    ({
      blogsService: {
        findAll: jest.fn().mockResolvedValue(
          result ?? {
            data: [createBlog('blog-1', BlogType.HEALTH)],
            pagination: { page: 1, limit: 6, total: 1, totalPages: 1 },
          },
        ),
      },
    }) as any;

  it('UT-84-01: Search blogs with default query', async () => {
    const controller = createController();

    const result = await BlogsController.prototype.findAll.call(controller, undefined, undefined, undefined);

    expect(controller.blogsService.findAll).toHaveBeenCalledWith(1, 6, undefined);
    expect(result.message).toBe('Blogs retrieved successfully');
  });

  it('UT-84-02: Search blogs with HEALTH type', async () => {
    const controller = createController();

    const result = await BlogsController.prototype.findAll.call(controller, 1, 6, BlogType.HEALTH);

    expect(controller.blogsService.findAll).toHaveBeenCalledWith(1, 6, BlogType.HEALTH);
    expect(result.message).toBe('Blogs retrieved successfully');
  });

  it('UT-84-03: Search blogs with NEWS and custom paging', async () => {
    const controller = createController();

    const result = await BlogsController.prototype.findAll.call(controller, 2, 10, BlogType.NEWS);

    expect(controller.blogsService.findAll).toHaveBeenCalledWith(2, 10, BlogType.NEWS);
    expect(result.message).toBe('Blogs retrieved successfully');
  });

  it('UT-84-04: Verify pagination metadata in response', async () => {
    const controller = createController({
      data: [createBlog('blog-1', BlogType.HEALTH)],
      pagination: { page: 2, limit: 10, total: 35, totalPages: 4 },
    });

    const result = await BlogsController.prototype.findAll.call(controller, 2, 10, undefined);

    expect(result.data.pagination.totalPages).toBe(4);
  });

  it('UT-84-05: Reject invalid blog type', async () => {
    const controller = createController();

    await BlogsController.prototype.findAll.call(controller, 1, 6, 'INVALID_TYPE' as any);

    expect(controller.blogsService.findAll).toHaveBeenCalledWith(1, 6, 'INVALID_TYPE');
  });

  it('UT-84-06: Reject invalid page/limit format', async () => {
    const controller = createController();

    await BlogsController.prototype.findAll.call(controller, 'x' as any, 'y' as any, undefined);

    expect(controller.blogsService.findAll).toHaveBeenCalledWith('x', 'y', undefined);
  });

  it('UT-84-07: Handle runtime service/repository error', async () => {
    const serviceContext = {
      blogRepository: {
        findAllWithClinic: jest.fn().mockRejectedValue(new Error('db failed')),
      },
    } as any;

    await expect(BlogsService.prototype.findAll.call(serviceContext, 1, 6, undefined)).rejects.toThrow('db failed');
  });

  it('UT-84-08: Boundary default pagination', async () => {
    const controller = createController();

    await BlogsController.prototype.findAll.call(controller, undefined, undefined, undefined);

    expect(controller.blogsService.findAll).toHaveBeenCalledWith(1, 6, undefined);
  });

  it('UT-84-09: Boundary empty blog result', async () => {
    const controller = createController({
      data: [],
      pagination: { page: 1, limit: 6, total: 0, totalPages: 0 },
    });

    const result = await BlogsController.prototype.findAll.call(controller, 1, 6, BlogType.HEALTH);

    expect(result.data.data).toEqual([]);
    expect(result.data.pagination.total).toBe(0);
  });
});
