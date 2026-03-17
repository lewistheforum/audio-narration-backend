import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
  ParseUUIDPipe,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { ClinicRevenueService } from './clinic-revenue.service';
import {
  ClinicRevenueFilterDto,
  OverallRevenueReportResponseDto,
  BranchRevenueReportResponseDto,
  RevenueGroupBy,
} from './dto';
import { ApiResponseData } from '../../../common/decorators/api-response.decorator';
import { JwtAuthGuard } from '../../auth/jwt.strategy';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AccountRole } from '../enums/account-role.enum';
import { User } from '../../../common/decorators/user.decorator';
import { Account } from '../entities/accounts.entity';

/**
 * Clinic Revenue Controller
 *
 * Provides revenue reporting endpoints for CLINIC_ADMIN accounts
 * Enables detailed financial analysis across all branches
 */
@ApiTags('Clinic Admin - Revenue Reports')
@Controller('api/clinic-admin/revenue')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
@Roles(AccountRole.CLINIC_ADMIN)
export class ClinicRevenueController {
  constructor(private readonly clinicRevenueService: ClinicRevenueService) {}

  /**
   * Get Overall Revenue Report
   *
   * Aggregates revenue data across ALL branches under the CLINIC_ADMIN
   * Provides comprehensive financial overview with multiple breakdowns
   *
   * @param user Authenticated CLINIC_ADMIN user
   * @param filterDto Query parameters for filtering revenue data (date range and grouping only)
   * @returns Overall revenue report with aggregated statistics across all branches
   */
  @Get('overview')
  @ApiOperation({
    summary: 'Get overall revenue report across ALL branches',
    description:
      'Retrieves aggregated revenue data for ALL branches under the CLINIC_ADMIN. ' +
      'Includes total revenue, transaction counts, payment method breakdown, ' +
      'service category analysis, and revenue trends over time. ' +
      'This endpoint does NOT filter by specific branch - use /branches/:managerId for that.',
  })
  @ApiQuery({
    name: 'startDate',
    type: String,
    required: true,
    description: 'Start date for revenue period (ISO 8601 format)',
    example: '2026-01-01',
  })
  @ApiQuery({
    name: 'endDate',
    type: String,
    required: true,
    description: 'End date for revenue period (ISO 8601 format)',
    example: '2026-03-31',
  })
  @ApiQuery({
    name: 'groupBy',
    enum: RevenueGroupBy,
    required: false,
    description: 'Group revenue trends by time period (day, week, or month)',
    example: RevenueGroupBy.DAY,
  })
  @ApiResponseData({
    type: OverallRevenueReportResponseDto,
    status: HttpStatus.OK,
    message: 'Overall revenue report retrieved successfully',
  })
  async getOverallRevenueReport(
    @User() user: Account,
    @Query() filterDto: ClinicRevenueFilterDto,
  ) {
    const report = await this.clinicRevenueService.getOverallRevenueReport(
      user._id,
      filterDto,
    );
    return {
      data: report,
      message: 'Overall revenue report retrieved successfully',
    };
  }

  /**
   * Get Branch Revenue Report
   *
   * Retrieves detailed revenue report for a SPECIFIC branch (CLINIC_MANAGER)
   * Provides granular financial insights for individual branch analysis
   *
   * @param user Authenticated CLINIC_ADMIN user
   * @param managerId ID of the branch manager (CLINIC_MANAGER) - from path parameter
   * @param filterDto Query parameters for filtering revenue data (date range and grouping only)
   * @returns Branch-specific revenue report with detailed statistics
   */
  @Get('branches/:managerId')
  @ApiOperation({
    summary: 'Get revenue report for a SPECIFIC branch',
    description:
      'Retrieves detailed revenue data for a SPECIFIC branch identified by manager ID (path parameter). ' +
      'Includes branch-specific revenue summary, payment method breakdown, ' +
      'service category analysis, top services, and revenue trends. ' +
      'The managerId is ONLY accepted as a path parameter, NOT as a query parameter.',
  })
  @ApiParam({
    name: 'managerId',
    type: String,
    required: true,
    description: 'UUID of the branch manager (CLINIC_MANAGER)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiQuery({
    name: 'startDate',
    type: String,
    required: true,
    description: 'Start date for revenue period (ISO 8601 format)',
    example: '2026-01-01',
  })
  @ApiQuery({
    name: 'endDate',
    type: String,
    required: true,
    description: 'End date for revenue period (ISO 8601 format)',
    example: '2026-03-31',
  })
  @ApiQuery({
    name: 'groupBy',
    enum: RevenueGroupBy,
    required: false,
    description: 'Group revenue trends by time period (day, week, or month)',
    example: RevenueGroupBy.DAY,
  })
  @ApiResponseData({
    type: BranchRevenueReportResponseDto,
    status: HttpStatus.OK,
    message: 'Branch revenue report retrieved successfully',
  })
  async getBranchRevenueReport(
    @User() user: Account,
    @Param('managerId', ParseUUIDPipe) managerId: string,
    @Query() filterDto: ClinicRevenueFilterDto,
  ) {
    const report = await this.clinicRevenueService.getBranchRevenueReport(
      user._id,
      managerId,
      filterDto,
    );
    return {
      data: report,
      message: 'Branch revenue report retrieved successfully',
    };
  }
}
