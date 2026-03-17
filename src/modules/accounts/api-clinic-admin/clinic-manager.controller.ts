import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt.strategy';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AccountRole } from '../enums/account-role.enum';
import { ClinicManagerService } from './clinic-manager.service';
import {
  CreateClinicManagerDto,
  UpdateManagerProfileDto,
  UpdateManagerLocationDto,
  UpdateManagerLegalDocumentsDto,
  ManagerListResponseDto,
  ManagerDetailResponseDto,
  GetManagerListQueryDto,
} from '../dto';
import { ApiResponseData } from '../../../common/decorators/api-response.decorator';

/**
 * Clinic Manager Controller
 * 
 * Endpoints for CLINIC_ADMIN to manage CLINIC_MANAGER accounts.
 * All endpoints require JWT authentication and CLINIC_ADMIN role.
 */
@Controller('clinic-managers')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('Clinic Admin - Manager Management')
@ApiBearerAuth('JWT-auth')
export class ClinicManagerController {
  constructor(
    private readonly clinicManagerService: ClinicManagerService,
  ) {}

  /**
   * FLOW 1: Get Manager List
   * GET /api/clinic-managers
   */
  @Get()
  @Roles(AccountRole.CLINIC_ADMIN)
  @ApiOperation({ 
    summary: 'Get all managers under clinic admin',
    description: 'Returns paginated list of all managers with filtering support for all columns'
  })
  @ApiResponseData({
    type: ManagerListResponseDto,
    status: 200,
    message: 'Manager list retrieved successfully',
  })
  async getManagerList(
    @Req() req: any,
    @Query() query: GetManagerListQueryDto,
  ): Promise<{ data: ManagerListResponseDto; message: string }> {
    const clinicAdminId = req.user._id;
    
    const result = await this.clinicManagerService.getManagerList(
      clinicAdminId,
      query,
    );

    return {
      data: result,
      message: 'Manager list retrieved successfully',
    };
  }

  /**
   * FLOW 2: Get Manager Detail
   * GET /api/clinic-managers/:managerId
   */
  @Get(':managerId')
  @Roles(AccountRole.CLINIC_ADMIN)
  @ApiOperation({ 
    summary: 'Get manager details',
    description: 'Returns complete information including personnel list'
  })
  @ApiParam({ name: 'managerId', description: 'Manager account UUID' })
  @ApiResponseData({
    type: ManagerDetailResponseDto,
    status: 200,
    message: 'Manager details retrieved successfully',
  })
  async getManagerDetail(
    @Req() req: any,
    @Param('managerId', ParseUUIDPipe) managerId: string,
  ): Promise<{ data: ManagerDetailResponseDto; message: string }> {
    const clinicAdminId = req.user._id;
    
    const result = await this.clinicManagerService.getManagerDetail(
      clinicAdminId,
      managerId,
    );

    return {
      data: result,
      message: 'Manager details retrieved successfully',
    };
  }

  /**
   * FLOW 3: Create Manager
   * POST /api/clinic-managers
   */
  @Post()
  @Roles(AccountRole.CLINIC_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: 'Create new manager account',
    description: 'Creates manager with PENDING_APPROVAL status. Legal documents uploaded separately.'
  })
  @ApiBody({ type: CreateClinicManagerDto })
  @ApiResponseData({
    status: 201,
    message: 'Manager created successfully',
  })
  async createManager(
    @Req() req: any,
    @Body() dto: CreateClinicManagerDto,
  ): Promise<{ data: { managerId: string }; message: string }> {
    const clinicAdminId = req.user._id;
    
    const result = await this.clinicManagerService.createManager(
      clinicAdminId,
      dto,
    );

    return {
      data: { managerId: result.managerId },
      message: result.message,
    };
  }

  /**
   * FLOW 4 & 6.3: Update Legal Documents
   * PUT /api/clinic-managers/:managerId/legal-documents
   * 
   * CRITICAL: Only CLINIC_ADMIN can access this endpoint.
   * CLINIC_MANAGER role is blocked by RolesGuard (403 Forbidden).
   */
  @Put(':managerId/legal-documents')
  @Roles(AccountRole.CLINIC_ADMIN) // RBAC: Only Admin
  @ApiOperation({ 
    summary: 'Update manager legal documents (Admin only)',
    description: 'Updates legal docs and resets status to PENDING_APPROVAL. Manager role is blocked.'
  })
  @ApiParam({ name: 'managerId', description: 'Manager account UUID' })
  @ApiBody({ type: UpdateManagerLegalDocumentsDto })
  @ApiResponseData({
    status: 200,
    message: 'Legal documents updated successfully',
  })
  async updateLegalDocuments(
    @Req() req: any,
    @Param('managerId', ParseUUIDPipe) managerId: string,
    @Body() dto: UpdateManagerLegalDocumentsDto,
  ): Promise<{ message: string }> {
    const clinicAdminId = req.user._id;
    
    return await this.clinicManagerService.updateLegalDocuments(
      clinicAdminId,
      managerId,
      dto,
    );
  }

  /**
   * FLOW 6.1: Update Manager Profile
   * PATCH /api/clinic-managers/:managerId/profile
   * 
   * Accessible by CLINIC_ADMIN or Manager themselves.
   */
  @Patch(':managerId/profile')
  @Roles(AccountRole.CLINIC_ADMIN, AccountRole.CLINIC_MANAGER)
  @ApiOperation({ 
    summary: 'Update manager profile',
    description: 'Update name, gender, DOB, picture. No status changes.'
  })
  @ApiParam({ name: 'managerId', description: 'Manager account UUID' })
  @ApiBody({ type: UpdateManagerProfileDto })
  @ApiResponseData({
    status: 200,
    message: 'Profile updated successfully',
  })
  async updateProfile(
    @Req() req: any,
    @Param('managerId', ParseUUIDPipe) managerId: string,
    @Body() dto: UpdateManagerProfileDto,
  ): Promise<{ message: string }> {
    const requesterId = req.user._id;
    const requesterRole = req.user.role;
    
    return await this.clinicManagerService.updateManagerProfile(
      requesterId,
      requesterRole,
      managerId,
      dto,
    );
  }

  /**
   * FLOW 6.2: Update Manager Location
   * PATCH /api/clinic-managers/:managerId/location
   * 
   * Accessible by CLINIC_ADMIN or Manager themselves.
   */
  @Patch(':managerId/location')
  @Roles(AccountRole.CLINIC_ADMIN, AccountRole.CLINIC_MANAGER)
  @ApiOperation({ 
    summary: 'Update manager location',
    description: 'Update address and Google Maps iframe'
  })
  @ApiParam({ name: 'managerId', description: 'Manager account UUID' })
  @ApiBody({ type: UpdateManagerLocationDto })
  @ApiResponseData({
    status: 200,
    message: 'Location updated successfully',
  })
  async updateLocation(
    @Req() req: any,
    @Param('managerId', ParseUUIDPipe) managerId: string,
    @Body() dto: UpdateManagerLocationDto,
  ): Promise<{ message: string }> {
    const requesterId = req.user._id;
    const requesterRole = req.user.role;
    
    return await this.clinicManagerService.updateManagerLocation(
      requesterId,
      requesterRole,
      managerId,
      dto,
    );
  }

  /**
   * FLOW 7: Disable Manager
   * PUT /api/clinic-managers/:managerId/disable
   */
  @Put(':managerId/disable')
  @Roles(AccountRole.CLINIC_ADMIN)
  @ApiOperation({ 
    summary: 'Disable manager account',
    description: 'Sets status to MANAGER_DISABLED. Cascades login block to all personnel.'
  })
  @ApiParam({ name: 'managerId', description: 'Manager account UUID' })
  @ApiResponseData({
    status: 200,
    message: 'Manager disabled successfully',
  })
  async disableManager(
    @Req() req: any,
    @Param('managerId', ParseUUIDPipe) managerId: string,
  ): Promise<{ message: string }> {
    const clinicAdminId = req.user._id;
    
    return await this.clinicManagerService.disableManager(
      clinicAdminId,
      managerId,
    );
  }

  /**
   * FLOW 8: Enable Manager
   * PUT /api/clinic-managers/:managerId/enable
   */
  @Put(':managerId/enable')
  @Roles(AccountRole.CLINIC_ADMIN)
  @ApiOperation({ 
    summary: 'Enable manager account',
    description: 'Changes status from MANAGER_DISABLED to ACTIVE. Restores personnel access.'
  })
  @ApiParam({ name: 'managerId', description: 'Manager account UUID' })
  @ApiResponseData({
    status: 200,
    message: 'Manager enabled successfully',
  })
  async enableManager(
    @Req() req: any,
    @Param('managerId', ParseUUIDPipe) managerId: string,
  ): Promise<{ message: string }> {
    const clinicAdminId = req.user._id;
    
    return await this.clinicManagerService.enableManager(
      clinicAdminId,
      managerId,
    );
  }

  /**
   * EDGE CASE: Soft Delete Manager
   * DELETE /api/clinic-managers/:managerId
   */
  @Delete(':managerId')
  @Roles(AccountRole.CLINIC_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Soft delete manager account',
    description: 'Deletes manager if status is PENDING_APPROVAL or MANAGER_DISABLED'
  })
  @ApiParam({ name: 'managerId', description: 'Manager account UUID' })
  @ApiResponseData({
    status: 200,
    message: 'Manager deleted successfully',
  })
  async deleteManager(
    @Req() req: any,
    @Param('managerId', ParseUUIDPipe) managerId: string,
  ): Promise<{ message: string }> {
    const clinicAdminId = req.user._id;
    
    return await this.clinicManagerService.softDeleteManager(
      clinicAdminId,
      managerId,
    );
  }
}
