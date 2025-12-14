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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { PrescriptionsService } from './prescriptions.service';
import { CreateMedicineDto, UpdateMedicineDto } from './dto';
import { Medicine } from './entities/medicine.entity';
import { JwtAuthGuard } from '../auth/jwt.strategy';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../user/entities/user.entity';

/**
 * Prescriptions Controller
 * 
 * Handles HTTP requests for medicine management
 * Part of ERM & E-Prescriptions module
 */
@ApiTags('Medicines & Prescriptions')
@Controller('medicines')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PrescriptionsController {
  constructor(private readonly prescriptionsService: PrescriptionsService) {}

  /**
   * Create a new medicine
   * Admin only
   */
  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new medicine (Admin only)' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Medicine created successfully', type: Medicine })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Admin access required' })
  async create(@Body() createMedicineDto: CreateMedicineDto): Promise<Medicine> {
    return await this.prescriptionsService.create(createMedicineDto);
  }

  /**
   * Get all medicines
   */
  @Get()
  @ApiOperation({ summary: 'Get all medicines' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Medicines retrieved successfully', type: [Medicine] })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  async findAll(): Promise<Medicine[]> {
    return await this.prescriptionsService.findAll();
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
  @ApiResponse({ status: HttpStatus.OK, description: 'Search results retrieved successfully', type: [Medicine] })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  async search(@Query('name') name: string): Promise<Medicine[]> {
    return await this.prescriptionsService.searchByName(name);
  }

  /**
   * Get habit-forming medicines
   */
  @Get('habit-forming')
  @Roles(UserRole.DOCTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get habit-forming medicines (Doctor/Admin only)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Habit-forming medicines retrieved successfully', type: [Medicine] })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Doctor or Admin access required' })
  async getHabitForming(): Promise<Medicine[]> {
    return await this.prescriptionsService.findHabitForming();
  }

  /**
   * Get medicines by therapeutic class
   */
  @Get('therapeutic/:class')
  @ApiOperation({ summary: 'Get medicines by therapeutic class' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Medicines retrieved successfully', type: [Medicine] })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  async findByTherapeuticClass(@Param('class') therapeuticClass: string): Promise<Medicine[]> {
    return await this.prescriptionsService.findByTherapeuticClass(therapeuticClass);
  }

  /**
   * Get medicine by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get medicine by ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Medicine retrieved successfully', type: Medicine })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Medicine not found' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  async findOne(@Param('id') id: string): Promise<Medicine> {
    return await this.prescriptionsService.findOne(id);
  }

  /**
   * Update medicine
   * Admin only
   */
  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update medicine (Admin only)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Medicine updated successfully', type: Medicine })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Medicine not found' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Admin access required' })
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
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Soft delete medicine (Admin only)' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Medicine deleted successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Medicine not found' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Admin access required' })
  async remove(@Param('id') id: string): Promise<void> {
    return await this.prescriptionsService.remove(id);
  }

  /**
   * Restore soft-deleted medicine
   * Admin only
   */
  @Patch(':id/restore')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Restore soft-deleted medicine (Admin only)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Medicine restored successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Medicine not found' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Admin access required' })
  async restore(@Param('id') id: string): Promise<void> {
    return await this.prescriptionsService.restore(id);
  }
}
