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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiQuery,
} from '@nestjs/swagger';
import { SchedulesService } from './schedules.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { GetSchedulesDto } from './dto/get-schedules.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { GetEmployeesDto } from './dto/get-employees.dto';
import { CopyScheduleDto } from './dto/copy-schedule.dto';
import { CreateClinicRoomDto } from './dto/create-clinic-room.dto';
import { UpdateClinicRoomDto } from './dto/update-clinic-room.dto';
import { ClinicRoomQueryDto } from './dto/clinic-room-query.dto';
import {
  GetDoctorSchedulesQueryDto,
  DoctorSchedulesResponseDto,
  GetDoctorSchedulesByDateQueryDto,
  DoctorSchedulesByDateResponseDto,
  ClinicRoomsShiftHoursResponseDto,
  GetRoomsShiftHoursQueryDto,
} from './dto';
import { JwtAuthGuard } from '../auth/jwt.strategy';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccountRole } from '../accounts/enums';

@ApiTags('Schedules')
@Controller('schedules')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

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

    // Enforce Clinic ID for Manager — Manager IS the clinic branch
    if (user.role === AccountRole.CLINIC_MANAGER) {
      clinicId = user._id; // Manager._id = clinic branch ID
      if (!clinicId)
        throw new ForbiddenException('Clinic ID not found for this manager');
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
  @Roles(
    AccountRole.CLINIC_MANAGER,
    AccountRole.CLINIC_STAFF,
    AccountRole.DOCTOR,
  )
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
  @Roles(
    AccountRole.CLINIC_MANAGER,
    AccountRole.CLINIC_STAFF,
    AccountRole.DOCTOR,
  )
  @ApiOperation({ summary: 'Get clinic rooms for dropdown' })
  async getRooms(@Request() req) {
    return this.schedulesService.getRooms(req.user);
  }

  /**
   * Get Clinic Rooms by Staff ID
   *
   * Retrieves list of available rooms for a specific clinic by a staff member's ID.
   *
   * Roles: ADMIN, CLINIC_ADMIN, CLINIC_MANAGER, CLINIC_STAFF
   */
  @Get('options/rooms/staff/:staffId')
  @Roles(
    AccountRole.ADMIN,
    AccountRole.CLINIC_ADMIN,
    AccountRole.CLINIC_MANAGER,
    AccountRole.CLINIC_STAFF,
  )
  @ApiOperation({ summary: 'Get clinic rooms list by staff ID' })
  async getRoomsByManagerId(@Param('staffId') staffId: string) {
    return this.schedulesService.getRoomsByStaffId(staffId);
  }

  /**
   * Get Clinic Rooms by Staff ID
   *
   * Retrieves list of available rooms for a specific clinic by staff ID.
   *
   * Roles: ANY
   */
  @Get('options/rooms/staff-account/:staffId')
  @ApiOperation({ summary: 'Get clinic rooms for dropdown by staff ID' })
  async getRoomsByStaffIdRoute(@Param('staffId') staffId: string) {
    return this.schedulesService.getRoomsByStaffId(staffId);
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
  @Roles(
    AccountRole.CLINIC_MANAGER,
    AccountRole.CLINIC_STAFF,
    AccountRole.DOCTOR,
  )
  @ApiOperation({
    summary: 'Get clinic employees (doctors/staff) for dropdown',
  })
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
  @Roles(
    AccountRole.CLINIC_MANAGER,
    AccountRole.CLINIC_STAFF,
    AccountRole.DOCTOR,
  )
  @ApiOperation({ summary: 'Get schedules list' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of schedules',
  })
  findAll(@Request() req, @Query() query: GetSchedulesDto) {
    return this.schedulesService.findAll(req.user, query);
  }

  /**
   * Find Schedules of Clinic
   *
   * Retrieves a list of schedules based on filter criteria.
   * Implements role-based visibility logic provided by the service.
   *
   * Roles: CLINIC_MANAGER, CLINIC_STAFF, DOCTOR
   */
  @Get('clinic-schedules/:clinicId')
  @Roles(
    AccountRole.CLINIC_MANAGER,
    AccountRole.CLINIC_STAFF,
    AccountRole.DOCTOR,
  )
  @ApiOperation({ summary: 'Get doctor schedules list' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of schedules',
  })
  findClinicSchedules(
    @Request() req,
    @Param('clinicId') clinicId: string,
    @Query() query: GetSchedulesDto,
  ) {
    return this.schedulesService.findClinicSchedules(clinicId, req.user, query);
  }

  /**
   * Find All Schedules of Doctor in Clinic
   *
   * Retrieves a list of schedules based on filter criteria.
   * Implements role-based visibility logic provided by the service.
   *
   * Roles: CLINIC_MANAGER, CLINIC_STAFF, DOCTOR
   */
  @Get('doctor-schedules/:clinicId')
  @Roles(
    AccountRole.CLINIC_MANAGER,
    AccountRole.CLINIC_STAFF,
    AccountRole.DOCTOR,
  )
  @ApiOperation({ summary: 'Get doctor schedules list' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of schedules',
  })
  findDoctorSchedulesByClinic(
    @Request() req,
    @Param('clinicId') clinicId: string,
    @Query() query: GetSchedulesDto,
  ) {
    return this.schedulesService.findDoctorSchedulesByClinic(
      clinicId,
      req.user,
      query,
    );
  }

  /**
   * Find detail work schedule hour of Doctor in Clinic
   *
   * Retrieves a list of schedules based on filter criteria.
   * Implements role-based visibility logic provided by the service.
   *
   * Roles: CLINIC_MANAGER, CLINIC_STAFF, DOCTOR
   */
  @Get('doctor-schedules/hours/:clinicId')
  @Roles(
    AccountRole.CLINIC_MANAGER,
    AccountRole.CLINIC_STAFF,
    AccountRole.DOCTOR,
  )
  @ApiOperation({ summary: 'Get doctor schedules list' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of schedules',
  })
  findDoctorScheduleHoursByClinic(
    @Request() req,
    @Param('clinicId') clinicId: string,
    @Query() query: GetSchedulesDto,
  ) {
    return this.schedulesService.findDoctorScheduleHoursByClinic(
      clinicId,
      req.user,
      query,
    );
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
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Room created successfully',
  })
  createRoom(@Request() req, @Body() dto: CreateClinicRoomDto) {
    return this.schedulesService.createClinicRoom(req.user, dto);
  }

  @Get('rooms')
  @Roles(
    AccountRole.CLINIC_MANAGER,
    AccountRole.CLINIC_STAFF,
    AccountRole.DOCTOR,
  )
  @ApiOperation({ summary: 'Get paginated list of clinic rooms' })
  getRoomsPaginated(@Request() req, @Query() query: ClinicRoomQueryDto) {
    return this.schedulesService.getPaginatedClinicRooms(req.user, query);
  }

  @Get('rooms/staff/:staffId')
  @Roles(
    AccountRole.ADMIN,
    AccountRole.CLINIC_ADMIN,
    AccountRole.CLINIC_MANAGER,
    AccountRole.CLINIC_STAFF,
  )
  @ApiOperation({ summary: 'Get paginated list of clinic rooms by staff ID' })
  getPaginatedRoomsByManagerId(
    @Param('staffId') staffId: string,
    @Query() query: ClinicRoomQueryDto,
  ) {
    return this.schedulesService.getPaginatedClinicRoomsByStaffId(staffId, query);
  }

  @Get('rooms/:id')
  @Roles(
    AccountRole.CLINIC_MANAGER,
    AccountRole.CLINIC_STAFF,
    AccountRole.DOCTOR,
  )
  @ApiOperation({ summary: 'Get details of a specific clinic room' })
  getRoomById(@Request() req, @Param('id') id: string) {
    return this.schedulesService.getClinicRoomById(id, req.user);
  }

  @Put('rooms/:id')
  @Roles(AccountRole.CLINIC_MANAGER)
  @ApiOperation({ summary: 'Update a clinic room' })
  updateRoom(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateClinicRoomDto,
  ) {
    return this.schedulesService.updateClinicRoom(id, req.user, dto);
  }

  @Delete('rooms/:id')
  @Roles(AccountRole.CLINIC_MANAGER)
  @ApiOperation({ summary: 'Delete a clinic room' })
  deleteRoom(@Request() req, @Param('id') id: string) {
    return this.schedulesService.deleteClinicRoom(id, req.user);
  }

  /**
   * Get Clinic Rooms with Shift Hours (Staff Only)
   *
   * Retrieves all clinic rooms with their shift hours based on employee schedules
   * Used by staff to view available rooms and time slots
   *
   * Response includes:
   * - List of clinic rooms with nested shift hours
   * - Each room shows shift hours where employees are scheduled
   *
   * Query Parameters:
   * - date: Optional filter by work date (YYYY-MM-DD)
   *
   * Roles: CLINIC_STAFF
   */
  @Get('staff/rooms-shift-hours')
  @Roles(AccountRole.CLINIC_STAFF)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get clinic rooms with shift hours (Staff only)',
    description:
      'Retrieves all clinic rooms with their shift hours based on employee schedules. Optionally filter by specific work date.',
  })
  @ApiResponse({
    status: 200,
    description: 'Rooms and shift hours retrieved successfully',
    type: ClinicRoomsShiftHoursResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User is not a clinic staff member',
  })
  @ApiResponse({
    status: 404,
    description:
      'Not Found - Clinic not found or staff not associated with clinic',
  })
  @ApiQuery({
    name: 'date',
    required: false,
    type: String,
    description: 'Filter shift hours by work date (YYYY-MM-DD format)',
    example: '2024-03-15',
  })
  getRoomsWithShiftHours(
    @Request() req,
    @Query() query: GetRoomsShiftHoursQueryDto,
  ) {
    return this.schedulesService.getClinicRoomsWithShiftHours(
      req.user,
      query.date,
    );
  }

  /**
   * Get Doctor Schedules (Staff Only)
   *
   * Retrieves list of doctors with their available schedules for appointment booking
   * Automatically detects clinic from staff JWT token
   * Returns doctors with time slots, rooms, and availability
   *
   * Query Parameters:
   * - serviceConfigId: Filter doctors who can perform this service
   * - shiftType: Filter by shift (morning, afternoon, evening)
   *
   * Response includes:
   * - List of doctors with their schedules
   * - Time slots with availability
   * - Room assignments
   * - Clinic information
   * - Date range (today + 60 days)
   *
   * Use Cases:
   * - Appointment booking flow - Step 3
   * - Staff selecting doctor and time slot
   * - Viewing doctor availability
   *
   * Roles: CLINIC_STAFF
   */
  @Get('staff/doctors')
  @Roles(AccountRole.CLINIC_STAFF)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get doctor schedules (Staff only)',
    description:
      'Retrieves list of doctors with available schedules for appointment booking',
  })
  @ApiResponse({
    status: 200,
    description: 'Schedules retrieved successfully',
    type: DoctorSchedulesResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User is not a clinic staff member',
  })
  @ApiResponse({
    status: 404,
    description:
      'Not Found - Clinic not found or staff not associated with clinic',
  })
  @ApiQuery({
    name: 'serviceConfigId',
    required: false,
    type: String,
    description: 'Filter doctors who can perform this service',
  })
  @ApiQuery({
    name: 'shiftType',
    required: false,
    enum: ['morning', 'afternoon', 'evening'],
    description: 'Filter by shift type',
  })
  async getDoctorSchedules(
    @Request() req: any,
    @Query() query: GetDoctorSchedulesQueryDto,
  ): Promise<{ data: DoctorSchedulesResponseDto; message: string }> {
    // Get staff's clinic ID from accounts.parent_id
    const staffAccountId = req.user._id;

    const staffAccount = await this.schedulesService['dataSource']
      .createQueryBuilder()
      .select('a.parent_id')
      .from('accounts', 'a')
      .where('a._id = :staffAccountId', { staffAccountId })
      .andWhere('a.role = :role', { role: 'CLINIC_STAFF' })
      .andWhere('a.deleted_at IS NULL')
      .getRawOne();

    if (!staffAccount || !staffAccount.parent_id) {
      throw new ForbiddenException('Staff is not associated with any clinic');
    }

    const clinicId = staffAccount.parent_id;

    const data = await this.schedulesService.getDoctorSchedules(clinicId, {
      serviceConfigId: query.serviceConfigId,
      shiftType: query.shiftType,
    });

    return {
      data,
      message: 'Doctor schedules retrieved successfully',
    };
  }

  /**
   * Get doctor schedules by specific date
   * Optimized for single date query with detailed slot information
   */
  @Get('staff/doctors/schedules/by-date')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.CLINIC_STAFF)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get doctor schedules by specific date (Staff)',
    description:
      'Get detailed doctor schedules for a specific date with available and booked time slots',
  })
  @ApiResponse({
    status: 200,
    description: 'Schedules retrieved successfully',
    type: DoctorSchedulesByDateResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid date format or date in past',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User is not a clinic staff',
  })
  async getDoctorSchedulesByDate(
    @Request() req: any,
    @Query() query: GetDoctorSchedulesByDateQueryDto,
  ): Promise<{ data: DoctorSchedulesByDateResponseDto; message: string }> {
    // Get staff's clinic ID from accounts.parent_id
    const staffAccountId = req.user._id;

    const staffAccount = await this.schedulesService['dataSource']
      .createQueryBuilder()
      .select('a.parent_id')
      .from('accounts', 'a')
      .where('a._id = :staffAccountId', { staffAccountId })
      .andWhere('a.role = :role', { role: 'CLINIC_STAFF' })
      .andWhere('a.deleted_at IS NULL')
      .getRawOne();

    if (!staffAccount || !staffAccount.parent_id) {
      throw new ForbiddenException('Staff is not associated with any clinic');
    }

    const clinicId = staffAccount.parent_id;

    const data = await this.schedulesService.getDoctorSchedulesByDate(
      clinicId,
      {
        date: query.date,
        doctorId: query.doctorId,
        shiftType: query.shiftType,
        serviceConfigId: query.serviceConfigId,
      },
    );

    return {
      data,
      message: 'Schedules by date retrieved successfully',
    };
  }
}
