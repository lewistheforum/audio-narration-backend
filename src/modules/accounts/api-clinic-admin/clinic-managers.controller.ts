import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ClinicManagersService } from './clinic-managers.service';
import { BanClinicManagerDto } from './dto/ban-clinic-manager.dto';
import { JwtAuthGuard } from '../../auth/jwt.strategy';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AccountRole } from '../enums/account-role.enum';

@ApiTags('Clinic Admin - Clinic Managers')
@Controller('clinic-admin/clinic-managers')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
@Roles(AccountRole.CLINIC_ADMIN) // Only clinic admins can use these APIs
export class ClinicManagersController {
  constructor(private readonly clinicManagersService: ClinicManagersService) {}

  @Post(':id/ban')
  @ApiOperation({
    summary: 'Ban a clinic manager (cascades to all linked doctors and staff)',
  })
  @ApiResponse({
    status: 200,
    description: 'Clinic manager banned successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Clinic manager not found or not owned by this admin',
  })
  async banClinicManager(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() banDto: BanClinicManagerDto,
  ) {
    return this.clinicManagersService.banClinicManager(
      req.user._id,
      id,
      banDto.description,
    );
  }

  @Post(':id/unban')
  @ApiOperation({
    summary:
      'Unban a clinic manager (cascades to all linked doctors and staff)',
  })
  @ApiResponse({
    status: 200,
    description: 'Clinic manager unbanned successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Clinic manager not found or not owned by this admin',
  })
  async unbanClinicManager(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.clinicManagersService.unbanClinicManager(req.user._id, id);
  }

  @Get(':id/ban-history')
  @ApiOperation({ summary: 'Get ban history of a clinic manager' })
  @ApiResponse({
    status: 200,
    description: 'Ban history list',
  })
  @ApiResponse({
    status: 404,
    description: 'Clinic manager not found or not owned by this admin',
  })
  async getBanHistory(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.clinicManagersService.getBanHistory(req.user._id, id);
  }
}
