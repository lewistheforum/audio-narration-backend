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
import { GetReportsDto, ResponseReportDto } from './dto';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get()
  @ApiOperation({ summary: 'Get a paginated list of reports' })
  @ApiResponse({ status: 200, description: 'Return paginated reports.' })
  async findAll(@Query() query: GetReportsDto) {
    return this.reportService.findAllReports(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a report by ID' })
  @ApiResponse({ status: 200, description: 'Return the report.' })
  @ApiResponse({ status: 404, description: 'Report not found.' })
  async findOne(@Param('id') id: string) {
    return this.reportService.findReportById(id);
  }

  @Post(':id/respond')
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
