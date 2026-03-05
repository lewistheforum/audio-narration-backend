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
} from '@nestjs/swagger';
import { ClinicRevenueService } from './clinic-revenue.service';
import {
  ClinicRevenueFilterDto,
  OverallRevenueReportResponseDto,
  BranchRevenueReportResponseDto,
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
   * Aggregates revenue data across all branches under the CLINIC_ADMIN
   * Provides comprehensive financial overview with multiple breakdowns
   *
   * @param user Authenticated CLINIC_ADMIN user
   * @param filterDto Query parameters for filtering revenue data
   * @returns Overall revenue report with aggregated statistics
   */
  @Get('overview')
  @ApiOperation({
    summary: 'Get overall revenue report across all branches',
    description:
      'Retrieves aggregated revenue data for all branches under the CLINIC_ADMIN. ' +
      'Includes total revenue, transaction counts, payment method breakdown, ' +
      'service category analysis, and revenue trends over time.',
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
   * Retrieves detailed revenue report for a specific branch (CLINIC_MANAGER)
   * Provides granular financial insights for individual branch analysis
   *
   * @param user Authenticated CLINIC_ADMIN user
   * @param managerId ID of the branch manager (CLINIC_MANAGER)
   * @param filterDto Query parameters for filtering revenue data
   * @returns Branch-specific revenue report with detailed statistics
   */
  @Get('branches/:managerId')
  @ApiOperation({
    summary: 'Get revenue report for a specific branch',
    description:
      'Retrieves detailed revenue data for a specific branch identified by manager ID. ' +
      'Includes branch-specific revenue summary, payment method breakdown, ' +
      'service category analysis, top services, and revenue trends.',
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
