import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { ServiceConfigsService } from './service-configs.service';
import { JwtAuthGuard } from '../auth/jwt.strategy';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccountRole } from '../accounts/enums';
import {
  GetClinicServicesQueryDto,
  ClinicServicesResponseDto,
} from './dto';

/**
 * Service Configs Controller
 *
 * RESTful API controller for managing clinic service configurations
 * Provides endpoints for clinic staff to view available services
 */
@ApiTags('Service Configs (Staff)')
@Controller('staff/clinic-services')
export class ServiceConfigsController {
  constructor(
    private readonly serviceConfigsService: ServiceConfigsService,
  ) {}

  /**
   * Get Clinic Services (Staff Only)
   *
   * Retrieves list of services for the clinic where staff is working
   * Includes pricing, duration, discount, and other configuration
   *
   * Query Parameters:
   * - isActive: Filter by active status (default: true)
   * - search: Search by service name (fuzzy search)
   * - page: Page number (default: 1)
   * - limit: Items per page (default: 50, max: 100)
   *
   * Response Format:
   * - Returns list of services with pagination
   * - Includes clinic info
   * - Final price calculated from price and discount
   *
   * Access Control:
   * - Requires CLINIC_STAFF role
   * - Requires valid JWT authentication
   * - Automatically detects clinic from staff JWT
   *
   * Use Cases:
   * - Staff viewing available services for booking
   * - Service selection during appointment creation
   * - Price lookup
   *
   * @param {any} req - Request object with authenticated user
   * @param {GetClinicServicesQueryDto} query - Query parameters
   * @returns {Promise<{data: ClinicServicesResponseDto, message: string}>} Services with pagination
   *
   * @swagger
   * @security JWT-auth
   * @response 200 - Successfully retrieved services
   * @response 401 - Unauthorized - Missing or invalid JWT token
   * @response 403 - Forbidden - Requires CLINIC_STAFF role
   * @response 404 - Not Found - Clinic not found or staff not associated with clinic
   */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.CLINIC_STAFF)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get clinic services (Staff only)',
    description:
      'Retrieves list of services for the clinic where staff is working with pricing and configuration',
  })
  @ApiResponse({
    status: 200,
    description: 'Services retrieved successfully',
    type: ClinicServicesResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User is not a clinic staff member',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Clinic not found or staff not associated with clinic',
  })
  @ApiQuery({
    name: 'isActive',
    required: false,
    type: Boolean,
    description: 'Filter by active status (default: true)',
    example: true,
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search by service name (fuzzy search)',
    example: 'Khám',
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
    description: 'Items per page (default: 50, max: 100)',
    example: 50,
  })
  async getClinicServices(
    @Request() req: any,
    @Query() query: GetClinicServicesQueryDto,
  ): Promise<{ data: ClinicServicesResponseDto; message: string }> {
    // Get clinic ID from staff JWT token
    // Get staff's clinic ID from accounts.parent_id
    const staffAccountId = req.user._id;
    
    // Get staff's clinic ID from accounts table (parent_id)
    const staffAccount = await this.serviceConfigsService['dataSource']
      .createQueryBuilder()
      .select('a.parent_id')
      .from('accounts', 'a')
      .where('a._id = :staffAccountId', { staffAccountId })
      .andWhere('a.role = :role', { role: 'CLINIC_STAFF' })
      .andWhere('a.deleted_at IS NULL')
      .getRawOne();

    if (!staffAccount || !staffAccount.parent_id) {
      throw new Error('Staff is not associated with any clinic');
    }

    const clinicId = staffAccount.parent_id;

    const data = await this.serviceConfigsService.getClinicServices(
      clinicId,
      query,
    );

    return {
      data,
      message: 'Services retrieved successfully',
    };
  }
}
