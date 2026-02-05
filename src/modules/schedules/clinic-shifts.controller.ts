import { Controller, Get, Post, Body, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ClinicShiftsService } from './clinic-shifts.service';
import { CreateClinicShiftDto } from './dto/create-clinic-shift.dto';
import { JwtAuthGuard } from '../auth/jwt.strategy';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccountRole } from '../accounts/enums';

@ApiTags('Clinic Shifts')
@Controller('clinic-shifts')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class ClinicShiftsController {
    constructor(private readonly shiftsService: ClinicShiftsService) { }

    @Post()
    @Roles(AccountRole.CLINIC_MANAGER)
    @ApiOperation({ summary: 'Create a new clinic shift' })
    @ApiResponse({ status: 201, description: 'Shift created' })
    @ApiResponse({ status: 409, description: 'Shift already exists' })
    create(@Request() req, @Body() createDto: CreateClinicShiftDto) {
        return this.shiftsService.create(req.user, createDto);
    }

    @Get()
    @Roles(AccountRole.CLINIC_MANAGER, AccountRole.CLINIC_STAFF, AccountRole.DOCTOR)
    @ApiOperation({ summary: 'Get all shifts for this clinic' })
    findAll(@Request() req) {
        return this.shiftsService.findAll(req.user);
    }

    @Delete(':id')
    @Roles(AccountRole.CLINIC_MANAGER)
    @ApiOperation({ summary: 'Delete a clinic shift' })
    remove(@Request() req, @Param('id') id: string) {
        return this.shiftsService.remove(req.user, id);
    }
}
