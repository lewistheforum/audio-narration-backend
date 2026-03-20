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
import { ReportService } from './report.service';
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
  @Roles(AccountRole.PATIENT, AccountRole.CLINIC_STAFF, AccountRole.CLINIC_ADMIN, AccountRole.CLINIC_MANAGER)
  @ApiOperation({ summary: 'Create a new report (Patient & Staff)' })
  @ApiResponse({ status: 201, description: 'Report created successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid input data.' })
  @ApiResponse({ status: 403, description: 'Forbidden - Only patients and clinic staff can create reports.' })
  async createReport(@User() user: any, @Body() dto: CreateReportDto) {
    return this.reportService.createReport(user._id, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.ADMIN, AccountRole.CLINIC_ADMIN, AccountRole.CLINIC_MANAGER)
  @ApiOperation({ summary: 'Get a paginated list of reports' })
  @ApiResponse({ status: 200, description: 'Return paginated reports.' })
  async findAll(@Query() query: GetReportsDto) {
    return this.reportService.findAllReports(query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.ADMIN)
  @ApiOperation({ summary: 'Get a report by ID' })
  @ApiResponse({ status: 200, description: 'Return the report.' })
  @ApiResponse({ status: 404, description: 'Report not found.' })
  async findOne(@Param('id') id: string) {
    return this.reportService.findReportById(id);
  }

  @Post(':id/respond')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.ADMIN)
  @ApiOperation({ summary: 'Respond to a user report' })
  @ApiResponse({ status: 200, description: 'Report responded successfully.' })
  @ApiResponse({ status: 400, description: 'Report already responded to.' })
  @ApiResponse({ status: 404, description: 'Report not found.' })
  async respondToReport(
    @Param('id') id: string,
    @Body() dto: ResponseReportDto,
  ) {
    return this.reportService.respondToReport(id, dto);
  }
}
