import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiExtraModels,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { BlogsService } from './blogs.service';
import {
  BlogResponseDto,
  BlogListResponseDto,
  CreateBlogDto,
  UpdateBlogDto,
  BlogNotificationResponseDto,
} from './dto';
import { ApiResponseData } from 'src/common/decorators/api-response.decorator';
import { MESSAGES } from 'src/common/message';
import { Account } from '../accounts/entities/accounts.entity';
import { User } from 'src/common/decorators/user.decorator';
import { JwtAuthGuard } from '../auth/jwt.strategy';
import { RolesGuard } from 'src/common/guards/roles.guard';

/**
 * Blogs Controller
 *
 * RESTful API controller for managing blog posts in the Medicare system.
 * Provides blog listing and detail retrieval functionality.
 *
 * Features:
 * - Blog list retrieval (all blogs, no pagination)
 * - Blog detail retrieval by ID
 * - Excludes soft-deleted blogs
 * - Includes clinic information for each blog
 *
 * Access Control:
 * - All endpoints are public (no authentication required)
 *
 * @controller
 * @tags Blogs
 */
@ApiTags('Blogs')
@ApiExtraModels(BlogResponseDto, BlogListResponseDto)
@Controller('blogs')
export class BlogsController {
  constructor(private readonly blogsService: BlogsService) {}

  /**
   * Get All Blogs
   *
   * Retrieves a list of all blog posts in the system.
   * Returns all blogs ordered by newest first.
   * Excludes soft-deleted records (deletedAt IS NULL).
   * Includes clinic information for each blog.
   *
   * Response Format:
   * - Returns array of BlogResponseDto objects
   * - Each blog includes clinic information
   * - Ordered by createdAt DESC (newest first)
   *
   * Access Control:
   * - Public endpoint (no authentication required)
   *
   * Use Cases:
   * - Blog listing page
   * - Blog feed display
   * - Public blog browsing
   *
   * @returns {Promise<{data: BlogResponseDto[], message: string}>} List of all blogs
   *
   * @swagger
   * @response 200 - Successfully retrieved blogs
   */
  @Get()
  @ApiOperation({ summary: 'Get all blogs' })
  @ApiResponseData({
    type: BlogResponseDto,
    status: MESSAGES.statusCode.success,
    message: 'Blogs retrieved successfully',
    isArray: true,
  })
  async findAll(): Promise<{ data: BlogResponseDto[]; message: string }> {
    const blogs = await this.blogsService.findAll();
    return {
      data: blogs,
      message: 'Blogs retrieved successfully',
    };
  }

  /**
   * Get Blog by ID
   *
   * Retrieves detailed information for a specific blog post.
   * Includes clinic information via clinic relation.
   * Excludes soft-deleted records.
   *
   * Path Parameters:
   * - id: Blog UUID
   *
   * Response Format:
   * - Returns BlogResponseDto with full blog details
   * - Includes clinic information
   *
   * Access Control:
   * - Public endpoint (no authentication required)
   *
   * Use Cases:
   * - Blog detail page
   * - Individual blog post view
   *
   * @param {string} id - Blog UUID
   * @returns {Promise<{data: BlogResponseDto, message: string}>} Blog details
   * @throws {NotFoundException} If blog not found
   *
   * @swagger
   * @response 200 - Successfully retrieved blog
   * @response 404 - Blog not found
   */
  @Get('/public/:id')
  @ApiOperation({ summary: 'Get blog by ID' })
  @ApiResponseData({
    type: BlogResponseDto,
    status: MESSAGES.statusCode.success,
    message: 'Blog retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Blog not found' })
  async findOnePublic(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ data: BlogResponseDto; message: string }> {
    const blog = await this.blogsService.findOne(id);
    return {
      data: blog,
      message: 'Blog retrieved successfully',
    };
  }

  /**
   * Get All Blogs by Clinic ID
   *
   * Retrieves all blog posts belonging to a specific clinic.
   * Returns blogs ordered by newest first.
   * Excludes soft-deleted records.
   *
   * @param {string} clinicId - Clinic UUID
   * @returns {Promise<{data: BlogResponseDto[], message: string}>} List of clinic blogs
   */
  @Get('clinic/:clinicId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get all blogs by clinic ID' })
  @ApiResponseData({
    type: BlogResponseDto,
    status: MESSAGES.statusCode.success,
    message: 'Blogs retrieved successfully',
    isArray: true,
  })
  async findByClinicId(
    @Param('clinicId', ParseUUIDPipe) clinicId: string,
  ): Promise<{ data: BlogResponseDto[]; message: string }> {
    const blogs = await this.blogsService.findByClinicId(clinicId);
    return {
      data: blogs,
      message: 'Blogs retrieved successfully',
    };
  }

  /**
   * Get Blogs by Patient ID
   *
   * Retrieves all blog notifications for a specific patient,
   * enriched with blog title, thumbnail, and createdAt from the blog table.
   *
   * @param {string} patientId - Patient UUID
   * @returns {Promise<{data: BlogNotificationResponseDto[], message: string}>}
   */
  @Get('patient/:patientId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get blogs by patient ID from blog notifications' })
  @ApiResponseData({
    type: BlogNotificationResponseDto,
    status: MESSAGES.statusCode.success,
    message: 'Patient blog notifications retrieved successfully',
    isArray: true,
  })
  async findBlogsByPatientId(
    @Param('patientId', ParseUUIDPipe) patientId: string,
  ): Promise<{ data: BlogNotificationResponseDto[]; message: string }> {
    const blogs = await this.blogsService.findBlogsByPatientId(patientId);
    return {
      data: blogs,
      message: 'Patient blog notifications retrieved successfully',
    };
  }

  /**
   * Mark Blog Notification as Read
   *
   * Updates the read status of a specific blog notification for the authenticated patient.
   *
   * @param {string} id - Notification UUID
   * @param {Account} user - Authenticated user
   * @returns {Promise<{data: BlogNotificationResponseDto, message: string}>}
   */
  @Patch('notifications/:id/read')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Mark a blog notification as read' })
  @ApiResponseData({
    type: BlogNotificationResponseDto,
    status: MESSAGES.statusCode.success,
    message: 'Blog notification marked as read successfully',
  })
  async markNotificationAsRead(
    @Param('id', ParseUUIDPipe) id: string,
    @User() user: Account,
  ): Promise<{ data: BlogNotificationResponseDto; message: string }> {
    const notification = await this.blogsService.markNotificationAsRead(
      id,
      user._id, // User's account ID acts as patient ID
    );
    return {
      data: notification,
      message: 'Blog notification marked as read successfully',
    };
  }

  /**
   * Get Blog by ID
   *
   * Retrieves detailed information for a specific blog post.
   * Includes clinic information via clinic relation.
   * Excludes soft-deleted records.
   *
   * Path Parameters:
   * - id: Blog UUID
   *
   * Response Format:
   * - Returns BlogResponseDto with full blog details
   * - Includes clinic information
   *
   * Access Control:
   * - Public endpoint (no authentication required)
   *
   * Use Cases:
   * - Blog detail page
   * - Individual blog post view
   *
   * @param {string} id - Blog UUID
   * @returns {Promise<{data: BlogResponseDto, message: string}>} Blog details
   * @throws {NotFoundException} If blog not found
   *
   * @swagger
   * @response 200 - Successfully retrieved blog
   * @response 404 - Blog not found
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get blog by ID' })
  @ApiResponseData({
    type: BlogResponseDto,
    status: MESSAGES.statusCode.success,
    message: 'Blog retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Blog not found' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ data: BlogResponseDto; message: string }> {
    const blog = await this.blogsService.findOne(id);
    return {
      data: blog,
      message: 'Blog retrieved successfully',
    };
  }

  /**
   * Create Blog
   *
   * Creates a new blog post.
   *
   * Access Control:
   * - Protected endpoint (JWT required)
   * - Restricted to CLINIC_ADMIN role
   *
   * @param {CreateBlogDto} createBlogDto - Blog creation data
   * @param {Account} user - Authenticated user
   * @returns {Promise<{data: BlogResponseDto, message: string}>} Created blog
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Create a new blog' })
  @ApiResponseData({
    type: BlogResponseDto,
    status: MESSAGES.statusCode.created,
    message: 'Blog created successfully',
  })
  async create(
    @Body() createBlogDto: CreateBlogDto,
    @User() user: Account,
  ): Promise<{ data: BlogResponseDto; message: string }> {
    const blog = await this.blogsService.create(createBlogDto, user);
    return {
      data: blog,
      message: 'Blog created successfully',
    };
  }

  /**
   * Update Blog
   *
   * Updates an existing blog post.
   *
   * Access Control:
   * - Protected endpoint (JWT required)
   * - Restricted to CLINIC_ADMIN role
   * - User must be the owner of the blog
   *
   * @param {string} id - Blog UUID
   * @param {UpdateBlogDto} updateBlogDto - Blog update data
   * @param {Account} user - Authenticated user
   * @returns {Promise<{data: BlogResponseDto, message: string}>} Updated blog
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Update a blog' })
  @ApiResponseData({
    type: BlogResponseDto,
    status: MESSAGES.statusCode.success,
    message: 'Blog updated successfully',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateBlogDto: UpdateBlogDto,
    @User() user: Account,
  ): Promise<{ data: BlogResponseDto; message: string }> {
    const blog = await this.blogsService.update(id, updateBlogDto, user);
    return {
      data: blog,
      message: 'Blog updated successfully',
    };
  }

  /**
   * Delete Blog
   *
   * Soft deletes a blog post.
   *
   * Access Control:
   * - Protected endpoint (JWT required)
   * - Restricted to CLINIC_ADMIN role
   * - User must be the owner of the blog
   *
   * @param {string} id - Blog UUID
   * @param {Account} user - Authenticated user
   * @returns {Promise<{message: string}>} Success message
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Delete a blog' })
  @ApiResponseData({
    type: null,
    status: MESSAGES.statusCode.success,
    message: 'Blog deleted successfully',
  })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @User() user: Account,
  ): Promise<{ message: string }> {
    await this.blogsService.remove(id, user);
    return {
      message: 'Blog deleted successfully',
    };
  }
}
