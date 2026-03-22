import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ClinicShiftHoursService } from './clinic-shift-hours.service';

import { ConfigureShiftDto } from './dto/configure-shift.dto';
import { JwtAuthGuard } from '../auth/jwt.strategy';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccountRole } from '../accounts/enums';

@ApiTags('Clinic Shift Hours')
@Controller('clinic-shift-hours')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class ClinicShiftHoursController {
    constructor(private readonly hoursService: ClinicShiftHoursService) { }

    @Get()
    @Roles(AccountRole.CLINIC_MANAGER, AccountRole.CLINIC_STAFF, AccountRole.DOCTOR)
    @ApiOperation({ summary: 'Get hours for a shift' })
    findAll(@Request() req, @Query('shiftId') shiftId: string) {
        return this.hoursService.findAll(req.user, shiftId);
    }

    @Post('config')
    @Roles(AccountRole.CLINIC_MANAGER, AccountRole.CLINIC_STAFF, AccountRole.DOCTOR)
    @ApiOperation({ summary: 'Configure shift hours (Split slots) - Create/Overwrite' })
    configure(@Request() req, @Body() configDto: ConfigureShiftDto) {
        return this.hoursService.applyConfiguration(req.user, configDto);
    }

    @Patch('config')
    @Roles(AccountRole.CLINIC_MANAGER, AccountRole.CLINIC_STAFF, AccountRole.DOCTOR)
    @ApiOperation({ summary: 'Update configuration (Overwrite)' })
    updateConfig(@Request() req, @Body() configDto: ConfigureShiftDto) {
        return this.hoursService.applyConfiguration(req.user, configDto);
    }

    @Get('history/:shiftType')
    @Roles(AccountRole.CLINIC_MANAGER, AccountRole.CLINIC_STAFF, AccountRole.DOCTOR)
    @ApiOperation({ summary: 'Get configuration history by shift type' })
    getHistory(@Request() req, @Param('shiftType') shiftType: string) {
        return this.hoursService.getHistory(req.user, shiftType);
    }

    @Delete(':id')
    @Roles(AccountRole.CLINIC_MANAGER, AccountRole.CLINIC_STAFF, AccountRole.DOCTOR)
    @ApiOperation({ summary: 'Delete a shift hour slot' })
    remove(@Request() req, @Param('id') id: string) {
        return this.hoursService.remove(req.user, id);
    }
}
