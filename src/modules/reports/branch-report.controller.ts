import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { BranchReportService } from './branch-report.service';
import { BranchReportQueryDto } from './dto';
import { JwtAuthGuard } from '../auth/jwt.strategy';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { User } from '../../common/decorators/user.decorator';
import { AccountRole } from '../accounts/enums';

@ApiTags('Branch Reports (Manager)')
@ApiBearerAuth('JWT-auth')
@Controller('reports/branch')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(AccountRole.CLINIC_MANAGER)
export class BranchReportController {
  constructor(private readonly branchReportService: BranchReportService) {}

  @Get('customers')
  @ApiOperation({ summary: 'Get total customer statistics by period' })
  @ApiResponse({ status: 200, description: 'Success' })
  async getCustomerStats(@User() user: any, @Query() query: BranchReportQueryDto) {
    return this.branchReportService.getCustomerStats(user._id, query);
  }

  @Get('doctors-feedback')
  @ApiOperation({ summary: 'Get list of doctors working in a day and their feedback' })
  @ApiResponse({ status: 200, description: 'Success' })
  async getDoctorsWorkingAndFeedback(
    @User() user: any,
    @Query() query: BranchReportQueryDto,
  ) {
    return this.branchReportService.getDoctorsWorkingAndFeedback(user._id, query.date);
  }

  @Get('services-stats')
  @ApiOperation({ summary: 'Get statistics for services (registrations and revenue)' })
  @ApiResponse({ status: 200, description: 'Success' })
  async getServiceStats(@User() user: any, @Query() query: BranchReportQueryDto) {
    return this.branchReportService.getServiceStats(user._id, query);
  }
}
