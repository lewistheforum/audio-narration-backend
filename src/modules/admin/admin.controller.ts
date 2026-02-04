import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.strategy';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccountRole } from '../accounts/enums/account-role.enum';
import { AdminService } from './admin.service';
import { ApiResponseData } from '../../common/decorators/api-response.decorator';
import {
  RegistrationListResponseDto,
  RegistrationDetailResponseDto,
  AdminApprovalDto,
} from './dto';

/**
 * Admin Controller
 *
 * Endpoints for admin to approve/reject clinic registrations
 */
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('Admin')
@ApiBearerAuth('JWT-auth')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /**
   * Get all pending registrations
   *
   * Returns paginated list of clinic registrations awaiting admin approval
   */
  @Get('registrations')
  @Roles(AccountRole.ADMIN)
  @ApiOperation({ summary: 'Get all pending clinic registrations' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponseData({
    type: RegistrationListResponseDto,
    status: 200,
    message: 'Registrations retrieved successfully',
  })
  async getRegistrations(
    @Query('page', ParseIntPipe, new DefaultValuePipe(1)) page: number,
    @Query('limit', ParseIntPipe, new DefaultValuePipe(10)) limit: number,
  ): Promise<{ data: RegistrationListResponseDto; message: string }> {
    const result = await this.adminService.getPendingApprovals(page, limit);
    return {
      data: result,
      message: 'Registrations retrieved successfully',
    };
  }

  /**
   * Get registration details by ID
   *
   * Returns full registration details for a specific clinic
   */
  @Get('registrations/:id')
  @Roles(AccountRole.ADMIN)
  @ApiOperation({ summary: 'Get registration details by clinic admin ID' })
  @ApiResponseData({
    type: RegistrationDetailResponseDto,
    status: 200,
    message: 'Registration details retrieved successfully',
  })
  async getRegistrationById(
    @Param('id') id: string,
  ): Promise<{ data: RegistrationDetailResponseDto; message: string }> {
    const result = await this.adminService.getRegistrationById(id);
    return {
      data: result,
      message: 'Registration details retrieved successfully',
    };
  }

  /**
   * Approve a clinic registration
   *
   * Approves the legal documents and transitions subscription to PENDING_PAYMENT
   */
  @Post('registrations/:id/approve')
  @Roles(AccountRole.ADMIN)
  @ApiOperation({ summary: 'Approve a clinic registration' })
  @ApiResponseData({
    type: null,
    status: 200,
    message: 'Registration approved successfully',
  })
  async approveRegistration(
    @Param('id') id: string,
  ): Promise<{ data: null; message: string }> {
    await this.adminService.approveRegistration(id);
    return {
      data: null,
      message: 'Registration approved successfully',
    };
  }

  /**
   * Reject a clinic registration
   *
   * Rejects the legal documents and stores rejection reason
   */
  @Post('registrations/:id/reject')
  @Roles(AccountRole.ADMIN)
  @ApiOperation({ summary: 'Reject a clinic registration' })
  @ApiResponseData({
    type: null,
    status: 200,
    message: 'Registration rejected successfully',
  })
  async rejectRegistration(
    @Param('id') id: string,
    @Body() dto: AdminApprovalDto,
  ): Promise<{ data: null; message: string }> {
    await this.adminService.rejectRegistration(id);
    return {
      data: null,
      message: 'Registration rejected successfully',
    };
  }
}
