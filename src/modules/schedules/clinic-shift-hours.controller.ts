import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ClinicShiftHoursService } from './clinic-shift-hours.service';
import { CreateClinicShiftHourDto } from './dto/create-clinic-shift-hour.dto';
import { UpdateClinicShiftHourDto } from './dto/update-clinic-shift-hour.dto';
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

    @Post()
    @Roles(AccountRole.CLINIC_MANAGER)
    @ApiOperation({ summary: 'Create a new shift hour slot' })
    create(@Request() req, @Body() createDto: CreateClinicShiftHourDto) {
        return this.hoursService.create(req.user, createDto);
    }

    @Get()
    @Roles(AccountRole.CLINIC_MANAGER, AccountRole.CLINIC_STAFF, AccountRole.DOCTOR)
    @ApiOperation({ summary: 'Get hours for a shift' })
    findAll(@Request() req, @Query('shiftId') shiftId: string) {
        return this.hoursService.findAll(req.user, shiftId);
    }



    @Post('config')
    @Roles(AccountRole.CLINIC_MANAGER)
    @ApiOperation({ summary: 'Configure shift hours (Split slots) - Create/Overwrite' })
    configure(@Request() req, @Body() configDto: ConfigureShiftDto) {
        return this.hoursService.applyConfiguration(req.user, configDto);
    }

    @Patch('config')
    @Roles(AccountRole.CLINIC_MANAGER)
    @ApiOperation({ summary: 'Update configuration (Overwrite)' })
    updateConfig(@Request() req, @Body() configDto: ConfigureShiftDto) {
        return this.hoursService.applyConfiguration(req.user, configDto);
    }

    @Get('history/:shiftId')
    @Roles(AccountRole.CLINIC_MANAGER)
    @ApiOperation({ summary: 'Get configuration history' })
    getHistory(@Request() req, @Param('shiftId') shiftId: string) {
        return this.hoursService.getHistory(req.user, shiftId);
    }

    @Patch(':id')
    @Roles(AccountRole.CLINIC_MANAGER)
    @ApiOperation({ summary: 'Update a shift hour slot' })
    update(@Request() req, @Param('id') id: string, @Body() updateDto: UpdateClinicShiftHourDto) {
        return this.hoursService.update(req.user, id, updateDto);
    }

    @Delete(':id')
    @Roles(AccountRole.CLINIC_MANAGER)
    @ApiOperation({ summary: 'Delete a shift hour slot' })
    remove(@Request() req, @Param('id') id: string) {
        return this.hoursService.remove(req.user, id);
    }
}
