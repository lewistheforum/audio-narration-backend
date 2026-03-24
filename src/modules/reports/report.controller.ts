import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ReportService, UserContext } from './report.service';
import { CreateReportDto, GetReportsDto, ResponseReportDto } from './dto';
import { JwtAuthGuard } from '../auth/jwt.strategy';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { User } from '../../common/decorators/user.decorator';
import { AccountRole } from '../accounts/enums';

@ApiTags('Reports')
@ApiBearerAuth('JWT-auth')
@Controller('reports')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    AccountRole.PATIENT,
    AccountRole.CLINIC_STAFF,
    AccountRole.CLINIC_ADMIN,
    AccountRole.CLINIC_MANAGER,
    AccountRole.DOCTOR,
  )
  @ApiOperation({
    summary: 'Create a new report (Patient, Staff, Doctor)',
    description:
      'Creates a new report. The logged-in user ID is automatically attached as the creator. Admin users cannot create user reports.',
  })
  @ApiResponse({ status: 201, description: 'Report created successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid input data.' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin users cannot create user reports.',
  })
  async createReport(@User() user: any, @Body() dto: CreateReportDto) {
    return this.reportService.createReport(user._id, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    AccountRole.PATIENT,
    AccountRole.CLINIC_STAFF,
    AccountRole.CLINIC_ADMIN,
    AccountRole.CLINIC_MANAGER,
    AccountRole.DOCTOR,
    AccountRole.ADMIN,
  )
  @ApiOperation({
    summary: 'Get a paginated list of reports',
    description:
      'Returns paginated reports. Admins can see all reports. Non-admin users can only see their own reports.',
  })
  @ApiResponse({ status: 200, description: 'Return paginated reports.' })
  async findAll(@User() user: any, @Query() query: GetReportsDto) {
    const userContext: UserContext = {
      _id: user._id,
      role: user.role,
    };
    return this.reportService.findAllReports(query, userContext);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    AccountRole.PATIENT,
    AccountRole.CLINIC_STAFF,
    AccountRole.CLINIC_ADMIN,
    AccountRole.CLINIC_MANAGER,
    AccountRole.DOCTOR,
    AccountRole.ADMIN,
  )
  @ApiOperation({
    summary: 'Get a report by ID',
    description:
      'Returns a single report. Admins can view any report. Non-admin users can only view their own reports. The admin_reply field is included in the response.',
  })
  @ApiResponse({ status: 200, description: 'Return the report.' })
  @ApiResponse({ status: 403, description: 'Forbidden - You do not have permission to access this report.' })
  @ApiResponse({ status: 404, description: 'Report not found.' })
  async findOne(@User() user: any, @Param('id') id: string) {
    const userContext: UserContext = {
      _id: user._id,
      role: user.role,
    };
    return this.reportService.findReportById(id, userContext);
  }

  @Post(':id/respond')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.ADMIN)
  @ApiOperation({
    summary: 'Respond to a user report (Admin only)',
    description:
      'Allows administrators to reply to a user report. Updates the admin_reply field (responseDescription) and marks the report as resolved.',
  })
  @ApiResponse({ status: 200, description: 'Report responded successfully.' })
  @ApiResponse({ status: 400, description: 'Report already responded to.' })
  @ApiResponse({ status: 404, description: 'Report not found.' })
  async respondToReport(@Param('id') id: string, @Body() dto: ResponseReportDto) {
    return this.reportService.respondToReport(id, dto);
  }
}
