import {
    Body,
    Controller,
    HttpCode,
    HttpStatus,
    Post,
    Get,
    Query,
    Patch,
    Put,
    Delete,
    Param,
    UseGuards,
    Request,
    ForbiddenException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SchedulesService } from './schedules.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { GetSchedulesDto } from './dto/get-schedules.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { GetEmployeesDto } from './dto/get-employees.dto';
import { CopyScheduleDto } from './dto/copy-schedule.dto';
import { CreateClinicRoomDto } from './dto/create-clinic-room.dto';
import { UpdateClinicRoomDto } from './dto/update-clinic-room.dto';
import { ClinicRoomQueryDto } from './dto/clinic-room-query.dto';
import { JwtAuthGuard } from '../auth/jwt.strategy';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccountRole } from '../accounts/enums';

@ApiTags('Schedules')
@Controller('schedules')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class SchedulesController {
    constructor(private readonly schedulesService: SchedulesService) { }

    /**
     * Create Schedules
     * 
     * Creates new schedules for one or more doctors/staff.
     * Enforces that Clinic Managers can only create schedules for their own clinic.
     * Checks for conflicts before creating.
     * 
     * Roles: CLINIC_MANAGER
     */
    @Post()
    @HttpCode(HttpStatus.CREATED)
    @Roles(AccountRole.CLINIC_MANAGER)
    @ApiOperation({ summary: 'Create doctor schedule(s)' })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: 'Schedule created successfully',
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Invalid input',
    })
    @ApiResponse({
        status: HttpStatus.CONFLICT,
        description: 'Schedule already exists',
    })
    create(@Request() req, @Body() createScheduleDto: CreateScheduleDto) {
        const user = req.user;
        let clinicId = '';

        // Enforce Clinic ID for Manager
        if (user.role === AccountRole.CLINIC_MANAGER) {
            clinicId = user.parentId || user._id; // Fallback to ID if they are the clinic root
            if (!clinicId) throw new ForbiddenException('Clinic ID not found for this manager');
        } else {
            throw new ForbiddenException('Access denied');
        }

        return this.schedulesService.create(clinicId, createScheduleDto);
    }

    /**
     * Copy Schedule
     * 
     * Copies schedules from a list of source dates to a target start date (consecutive).
     * 
     * Roles: CLINIC_MANAGER
     */
    @Post('copy')
    @HttpCode(HttpStatus.BAD_REQUEST) // Default if empty? Or 200/201
    @ApiResponse({ status: HttpStatus.OK, description: 'Schedules copied' })
    @Roles(AccountRole.CLINIC_MANAGER)
    @ApiOperation({ summary: 'Copy schedules from list of dates' })
    copy(@Request() req, @Body() copyScheduleDto: CopyScheduleDto) {
        return this.schedulesService.copySchedule(req.user, copyScheduleDto);
    }

    /**
     * Get Clinic Shifts
     * 
     * Retrieves list of available shifts for a specific clinic.
     * Clinic ID is automatically resolved from the authenticated user's token.
     * Used for dropdown selections in UI.
     * 
     * Roles: CLINIC_MANAGER, CLINIC_STAFF, DOCTOR
     */
    @Get('options/shifts')
    @Roles(AccountRole.CLINIC_MANAGER, AccountRole.CLINIC_STAFF, AccountRole.DOCTOR)
    @ApiOperation({ summary: 'Get clinic shifts for dropdown' })
    async getShifts(@Request() req) {
        return this.schedulesService.getShifts(req.user);
    }

    /**
     * Get Clinic Rooms
     * 
     * Retrieves list of available rooms for a specific clinic.
     * Clinic ID is automatically resolved from the authenticated user's token.
     * Used for dropdown selections in UI.
     * 
     * Roles: CLINIC_MANAGER, CLINIC_STAFF, DOCTOR
     */
    @Get('options/rooms')
    @Roles(AccountRole.CLINIC_MANAGER, AccountRole.CLINIC_STAFF, AccountRole.DOCTOR)
    @ApiOperation({ summary: 'Get clinic rooms for dropdown' })
    async getRooms(@Request() req) {
        return this.schedulesService.getRooms(req.user);
    }

    /**
     * Get Clinic Employees
     * 
     * Retrieves list of employees for a specific clinic.
     * Clinic ID is automatically resolved from the authenticated user's token.
     * Used for dropdown selections in UI.
     * 
     * Roles: CLINIC_MANAGER, CLINIC_STAFF, DOCTOR
     */
    @Get('options/employees')
    @Roles(AccountRole.CLINIC_MANAGER, AccountRole.CLINIC_STAFF, AccountRole.DOCTOR)
    @ApiOperation({ summary: 'Get clinic employees (doctors/staff) for dropdown' })
    async getEmployees(
        @Request() req,
        @Query() query: GetEmployeesDto, // Use DTO for search param
    ) {
        return this.schedulesService.getEmployees(req.user, query.search);
    }

    /**
     * Find All Schedules
     * 
     * Retrieves a list of schedules based on filter criteria.
     * Implements role-based visibility logic provided by the service.
     * 
     * Roles: CLINIC_MANAGER, CLINIC_STAFF, DOCTOR
     */
    @Get()
    @Roles(AccountRole.CLINIC_MANAGER, AccountRole.CLINIC_STAFF, AccountRole.DOCTOR)
    @ApiOperation({ summary: 'Get schedules list' })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'List of schedules',
    })
    findAll(@Request() req, @Query() query: GetSchedulesDto) {
        return this.schedulesService.findAll(req.user, query);
    }

    /**
     * Update Schedule
     * 
     * Updates an existing schedule entry.
     * Allows changing date, shift, employee, or room.
     * Checks for conflicts before updating.
     * 
     * Roles: CLINIC_MANAGER
     */
    @Patch(':id')
    @Roles(AccountRole.CLINIC_MANAGER)
    @ApiOperation({ summary: 'Update schedule' })
    @ApiResponse({ status: HttpStatus.OK, description: 'Schedule updated' })
    update(
        @Param('id') id: string,
        @Body() updateScheduleDto: UpdateScheduleDto,
    ) {
        return this.schedulesService.update(id, updateScheduleDto);
    }

    /**
     * Delete Schedule
     * 
     * Soft deletes a schedule entry.
     * 
     * Roles: CLINIC_MANAGER
     */
    @Delete(':id')
    @Roles(AccountRole.CLINIC_MANAGER)
    @ApiOperation({ summary: 'Delete schedule' })
    @ApiResponse({ status: HttpStatus.OK, description: 'Schedule deleted' })
    remove(@Param('id') id: string) {
        return this.schedulesService.remove(id);
    }

    /**
     * -------------------------------------------------------------
     * CLINIC ROOM CRUD APIs
     * -------------------------------------------------------------
     */

    @Post('rooms')
    @Roles(AccountRole.CLINIC_MANAGER)
    @ApiOperation({ summary: 'Create a new clinic room' })
    @ApiResponse({ status: HttpStatus.CREATED, description: 'Room created successfully' })
    createRoom(@Request() req, @Body() dto: CreateClinicRoomDto) {
        return this.schedulesService.createClinicRoom(req.user, dto);
    }

    @Get('rooms')
    @Roles(AccountRole.CLINIC_MANAGER, AccountRole.CLINIC_STAFF, AccountRole.DOCTOR)
    @ApiOperation({ summary: 'Get paginated list of clinic rooms' })
    getRoomsPaginated(@Request() req, @Query() query: ClinicRoomQueryDto) {
        return this.schedulesService.getPaginatedClinicRooms(req.user, query);
    }

    @Get('rooms/:id')
    @Roles(AccountRole.CLINIC_MANAGER, AccountRole.CLINIC_STAFF, AccountRole.DOCTOR)
    @ApiOperation({ summary: 'Get details of a specific clinic room' })
    getRoomById(@Request() req, @Param('id') id: string) {
        return this.schedulesService.getClinicRoomById(id, req.user);
    }

    @Put('rooms/:id')
    @Roles(AccountRole.CLINIC_MANAGER)
    @ApiOperation({ summary: 'Update a clinic room' })
    updateRoom(@Request() req, @Param('id') id: string, @Body() dto: UpdateClinicRoomDto) {
        return this.schedulesService.updateClinicRoom(id, req.user, dto);
    }

    @Delete('rooms/:id')
    @Roles(AccountRole.CLINIC_MANAGER)
    @ApiOperation({ summary: 'Delete a clinic room' })
    deleteRoom(@Request() req, @Param('id') id: string) {
        return this.schedulesService.deleteClinicRoom(id, req.user);
    }
}
