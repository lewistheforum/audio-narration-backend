import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Delete,
  ParseUUIDPipe,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ClinicServicesService } from './clinic-services.service';
import { CreateClinicServiceCategoryDto } from './dto/create-clinic-service-category.dto';
import { UpdateClinicServiceStatusDto } from './dto/update-clinic-service-status.dto';
import { UpdateClinicServiceCategoryDto } from './dto/update-clinic-service-category.dto';
import { ClinicServiceCategoryResponseDto } from './dto/clinic-service-category-response.dto';
import { ClinicServiceCategory } from './entities';

@ApiTags('Clinic Services')
@Controller('clinic-services')
export class ClinicServicesController {
  constructor(private readonly clinicServicesService: ClinicServicesService) {}

  @Post('/categories')
  @ApiOperation({ summary: 'Create a new clinic service category' })
  @ApiResponse({
    status: 201,
    description: 'The category has been successfully created.',
    type: ClinicServiceCategory,
  })
  @UsePipes(new ValidationPipe({ whitelist: true }))
  createCategory(
    @Body() createClinicServiceCategoryDto: CreateClinicServiceCategoryDto,
  ): Promise<ClinicServiceCategory> {
    return this.clinicServicesService.createCategory(
      createClinicServiceCategoryDto,
    );
  }

  @Get('/categories')
  @ApiOperation({ summary: 'Get all clinic service categories' })
  @ApiResponse({
    status: 200,
    description: 'List of all clinic service categories',
    type: [ClinicServiceCategoryResponseDto],
  })
  async getAllCategories(): Promise<ClinicServiceCategoryResponseDto[]> {
    const categories = await this.clinicServicesService.getAllCategories();
    return categories.map(
      (category) => new ClinicServiceCategoryResponseDto(category),
    );
  }

  @Get('/categories/:id')
  @ApiOperation({ summary: 'Get a clinic service category by ID' })
  @ApiResponse({
    status: 200,
    description: 'The category has been successfully retrieved.',
    type: ClinicServiceCategoryResponseDto,
  })
  async getCategoryById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ClinicServiceCategoryResponseDto> {
    const category = await this.clinicServicesService.getCategoryById(id);
    const clinicUsage =
      await this.clinicServicesService.getClinicsUsingCategory(id);
    const clinicCount = clinicUsage.length;

    return new ClinicServiceCategoryResponseDto(
      category,
      clinicCount,
      clinicUsage,
    );
  }

  @Put('/categories/:id')
  @ApiOperation({ summary: 'Update a clinic service category' })
  @ApiResponse({
    status: 200,
    description: 'The category has been successfully updated.',
    type: ClinicServiceCategoryResponseDto,
  })
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async updateCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateClinicServiceCategoryDto: UpdateClinicServiceCategoryDto,
  ): Promise<ClinicServiceCategoryResponseDto> {
    const category = await this.clinicServicesService.updateCategory(
      id,
      updateClinicServiceCategoryDto,
    );
    return new ClinicServiceCategoryResponseDto(category);
  }

  @Delete('/categories/:id')
  @ApiOperation({ summary: 'Delete a clinic service category' })
  @ApiResponse({
    status: 200,
    description: 'The category has been successfully deleted.',
  })
  async deleteCategory(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.clinicServicesService.deleteCategory(id);
  }

  @Patch('/categories/:id/status')
  @ApiOperation({ summary: 'Update a clinic service category status' })
  @ApiResponse({
    status: 200,
    description: 'The category status has been successfully updated.',
    type: ClinicServiceCategory,
  })
  @UsePipes(new ValidationPipe({ whitelist: true }))
  updateCategoryStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateClinicServiceStatusDto: UpdateClinicServiceStatusDto,
  ): Promise<ClinicServiceCategory> {
    return this.clinicServicesService.updateCategoryStatus(
      id,
      updateClinicServiceStatusDto.isActive,
    );
  }
}
