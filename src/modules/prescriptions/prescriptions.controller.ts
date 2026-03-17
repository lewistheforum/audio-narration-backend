import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpStatus,
  UseGuards,
  ValidationPipe,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { PrescriptionsService } from './prescriptions.service';
import {
  CreateMedicineDto,
  UpdateMedicineDto,
  PaginatedMedicinesResponseDto,
  SearchMedicinesQueryDto,
} from './dto';
import { Medicine } from './entities/medicine.entity';
import { JwtAuthGuard } from '../auth/jwt.strategy';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccountRole } from '../accounts/enums';

/**
 * Prescriptions Controller
 *
 * Handles HTTP requests for medicine management
 * Part of ERM & E-Prescriptions module
 */
@ApiTags('Medicines & Prescriptions')
@Controller('medicines')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class PrescriptionsController {
  constructor(private readonly prescriptionsService: PrescriptionsService) {}

  /**
   * Create a new medicine
   * Admin only
   */
  @Post()
  @Roles(AccountRole.ADMIN)
  @ApiOperation({ summary: 'Create a new medicine (Admin only)' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Medicine created successfully',
    type: Medicine,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Admin access required',
  })
  async create(
    @Body() createMedicineDto: CreateMedicineDto,
  ): Promise<Medicine> {
    return await this.prescriptionsService.create(createMedicineDto);
  }

  /**
   * Get all medicines
   */
  @Get()
  @ApiOperation({ summary: 'Get all medicines' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 20, max: 100)',
    example: 20,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Medicines retrieved successfully (paginated)',
    type: PaginatedMedicinesResponseDto,
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ): Promise<PaginatedMedicinesResponseDto> {
    const normalizedPage = page < 1 ? 1 : page;
    const normalizedLimit = limit < 1 ? 20 : Math.min(limit, 100);

    return await this.prescriptionsService.findAll(
      normalizedPage,
      normalizedLimit,
    );
  }

  /**
   * Search medicines by name
   */
  @Get('search')
  @ApiOperation({ summary: 'Search medicines by name' })
  @ApiQuery({
    name: 'name',
    required: true,
    description: 'Medicine name to search (partial match)',
    example: 'para',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 20, max: 100)',
    example: 20,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Search results retrieved successfully (paginated)',
    type: PaginatedMedicinesResponseDto,
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  async search(
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    query: SearchMedicinesQueryDto,
  ): Promise<PaginatedMedicinesResponseDto> {
    const normalizedPage = query.page;
    const normalizedLimit = query.limit;
    const normalizedName = query.name.trim();

    return await this.prescriptionsService.searchByName(
      normalizedName,
      normalizedPage,
      normalizedLimit,
    );
  }

  /**
   * Get habit-forming medicines
   */
  @Get('habit-forming')
  @Roles(AccountRole.DOCTOR, AccountRole.ADMIN)
  @ApiOperation({ summary: 'Get habit-forming medicines (Doctor/Admin only)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Habit-forming medicines retrieved successfully',
    type: [Medicine],
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Doctor or Admin access required',
  })
  async getHabitForming(): Promise<Medicine[]> {
    return await this.prescriptionsService.findHabitForming();
  }

  /**
   * Get medicines by therapeutic class
   */
  @Get('therapeutic/:class')
  @ApiOperation({ summary: 'Get medicines by therapeutic class' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Medicines retrieved successfully',
    type: [Medicine],
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  async findByTherapeuticClass(
    @Param('class') therapeuticClass: string,
  ): Promise<Medicine[]> {
    return await this.prescriptionsService.findByTherapeuticClass(
      therapeuticClass,
    );
  }

  /**
   * Get medicine by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get medicine by ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Medicine retrieved successfully',
    type: Medicine,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Medicine not found',
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  async findOne(@Param('id') id: string): Promise<Medicine> {
    return await this.prescriptionsService.findOne(id);
  }

  /**
   * Update medicine
   * Admin only
   */
  @Patch(':id')
  @Roles(AccountRole.ADMIN)
  @ApiOperation({ summary: 'Update medicine (Admin only)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Medicine updated successfully',
    type: Medicine,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Medicine not found',
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Admin access required',
  })
  async update(
    @Param('id') id: string,
    @Body() updateMedicineDto: UpdateMedicineDto,
  ): Promise<Medicine> {
    return await this.prescriptionsService.update(id, updateMedicineDto);
  }

  /**
   * Soft delete medicine
   * Admin only
   */
  @Delete(':id')
  @Roles(AccountRole.ADMIN)
  @ApiOperation({ summary: 'Soft delete medicine (Admin only)' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Medicine deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Medicine not found',
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Admin access required',
  })
  async remove(@Param('id') id: string): Promise<void> {
    return await this.prescriptionsService.remove(id);
  }

  /**
   * Restore soft-deleted medicine
   * Admin only
   */
  @Patch(':id/restore')
  @Roles(AccountRole.ADMIN)
  @ApiOperation({ summary: 'Restore soft-deleted medicine (Admin only)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Medicine restored successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Medicine not found',
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Admin access required',
  })
  async restore(@Param('id') id: string): Promise<void> {
    return await this.prescriptionsService.restore(id);
  }


}
