import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { AppointmentsService } from './appointments.service';
import {
  QueryAppointmentDto,
  PaginatedAppointmentResponseDto,
  CreateAppointmentDto,
  StaffCreateAppointmentDto,
  CancelAppointmentDto,
  AppointmentResponseDto,
  RescheduleAppointmentDto,
  CheckInDto,
  AcceptAppointmentDto,
  DeclineAppointmentDto,
  UpdateAppointmentStatusDto,
  AppointmentDetailResponseDto,
} from './dto';
import { JwtAuthGuard } from '../auth/jwt.strategy';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccountRole } from '../accounts/enums';
import { AppointmentStatus } from './enums';

/**
 * Appointments Controller
 *
 * Handles HTTP requests for appointment management
 *
 * Endpoints:
 * - GET /appointments/staff - View all clinic appointments (Staff only)
 * - GET /appointments/:id/detail - View appointment detail (Staff only)
 * - POST /appointments/staff/create - Staff create appointment with services (Staff only)
 * - POST /appointments - Create new appointment (Patient only)
 * - PATCH /appointments/:id/cancel - Cancel appointment (Staff/Patient)
 * - PATCH /appointments/:id/reschedule - Reschedule appointment (Staff/Patient)
 * - PATCH /appointments/:id/check-in - Check in patient (Staff only)
 * - PATCH /appointments/:id/accept - Accept appointment (Doctor only)
 * - PATCH /appointments/:id/decline - Decline appointment (Doctor only)
 * - PATCH /appointments/:id/status - Update appointment status (Admin/Staff)
 */
@ApiTags('Appointments')
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  /**
   * Get all appointments for staff's clinic
   *
   * Allows clinic staff to view all appointments of their clinic
   * with optional filtering by status and date, plus pagination
   *
   * @param req - Request object containing authenticated user
   * @param queryDto - Query parameters for filtering and pagination
   * @returns Paginated list of appointments
   */
  @Get('staff')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.CLINIC_STAFF)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get all appointments for staff clinic',
    description:
      'Retrieve all appointments of the clinic where the staff member works. Supports filtering by status and date, with pagination.',
  })
  @ApiResponse({
    status: 200,
    description: 'Appointments retrieved successfully',
    type: PaginatedAppointmentResponseDto,
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
    description: 'Not Found - Staff information not found',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: AppointmentStatus,
    description: 'Filter by appointment status',
  })
  @ApiQuery({
    name: 'appointmentDate',
    required: false,
    type: String,
    description: 'Filter by appointment date (YYYY-MM-DD)',
    example: '2026-01-20',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number for pagination',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of items per page',
    example: 10,
  })
  async getAppointmentsForStaff(
    @Request() req: any,
    @Query() queryDto: QueryAppointmentDto,
  ): Promise<PaginatedAppointmentResponseDto> {
    const staffAccountId = req.user._id;
    return this.appointmentsService.getAppointmentsForStaff(
      staffAccountId,
      queryDto,
    );
  }

  /**
   * Get appointment detail
   *
   * Allows clinic staff to view complete appointment details
   * including patient info, doctor info, services, and payment
   *
   * @param req - Request object containing authenticated user
   * @param id - Appointment UUID
   * @returns Complete appointment details
   */
  @Get(':id/detail')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.CLINIC_STAFF)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get appointment detail (Staff only)',
    description:
      'Retrieve complete appointment information including patient profile, doctor profile, services, and payment details. Staff can only view appointments from their clinic.',
  })
  @ApiResponse({
    status: 200,
    description: 'Appointment details retrieved successfully',
    type: AppointmentDetailResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description:
      'Forbidden - User is not a clinic staff member or appointment belongs to different clinic',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Appointment not found',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Appointment UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  async getAppointmentDetail(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AppointmentDetailResponseDto> {
    const staffAccountId = req.user._id;
    return this.appointmentsService.getAppointmentDetail(id, staffAccountId);
  }

  /**
   * Staff create appointment with services
   *
   * Allows clinic staff to create appointments for existing patients
   * with selected services. This will create records in 3 tables:
   * appointments, appointment_package, and service_appointments
   *
   * @param req - Request object containing authenticated user
   * @param createDto - Appointment creation data with services
   * @returns Created appointment details
   */
  @Post('staff/create')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.CLINIC_STAFF)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create appointment for patient (Staff only)',
    description:
      'Staff creates an appointment for an existing patient with selected clinic services. This operation creates records in appointments, appointment_package, and service_appointments tables within a transaction to ensure data consistency.',
  })
  @ApiResponse({
    status: 201,
    description: 'Appointment created successfully',
    type: AppointmentResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid input data',
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
    description: 'Not Found - Staff information or patient not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Appointment time already booked',
  })
  async staffCreateAppointment(
    @Request() req: any,
    @Body() createDto: StaffCreateAppointmentDto,
  ): Promise<AppointmentResponseDto> {
    const staffAccountId = req.user._id;
    return this.appointmentsService.staffCreateAppointment(
      staffAccountId,
      createDto,
    );
  }

  /**
   * Create a new appointment
   *
   * Allows patients to create appointments with clinics
   *
   * @param createDto - Appointment creation data
   * @returns Created appointment details
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.CLINIC_STAFF)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create new appointment',
    description:
      'Create a new appointment with a clinic. Patient can optionally select a specific doctor.',
  })
  @ApiResponse({
    status: 201,
    description: 'Appointment created successfully',
    type: AppointmentResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid input data',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User is not a patient',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Time slot already booked',
  })
  async createAppointment(
    @Body() createDto: CreateAppointmentDto,
  ): Promise<AppointmentResponseDto> {
    return this.appointmentsService.createAppointment(createDto);
  }

  /**
   * Cancel an appointment
   *
   * Allows staff or patients to cancel appointments
   *
   * @param id - Appointment UUID
   * @param cancelDto - Cancellation data (reject reason)
   * @returns Updated appointment details
   */
  @Patch(':id/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.CLINIC_STAFF, AccountRole.PATIENT)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel appointment',
    description:
      'Cancel an existing appointment. Requires a reason for cancellation.',
  })
  @ApiResponse({
    status: 200,
    description: 'Appointment cancelled successfully',
    type: AppointmentResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Appointment cannot be cancelled',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User does not have permission',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Appointment not found',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Appointment UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  async cancelAppointment(
    @Param('id') id: string,
    @Body() cancelDto: CancelAppointmentDto,
  ): Promise<AppointmentResponseDto> {
    return this.appointmentsService.cancelAppointment(id, cancelDto);
  }

  /**
   * Reschedule an appointment
   *
   * Allows staff or patients to reschedule appointments to a new date/time
   *
   * @param id - Appointment UUID
   * @param rescheduleDto - Reschedule data (new date and shift hour)
   * @returns Updated appointment details
   */
  @Patch(':id/reschedule')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.CLINIC_STAFF, AccountRole.PATIENT)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reschedule appointment',
    description:
      'Reschedule an existing appointment to a new date and/or doctor shift hour.',
  })
  @ApiResponse({
    status: 200,
    description: 'Appointment rescheduled successfully',
    type: AppointmentResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Appointment cannot be rescheduled',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User does not have permission',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Appointment not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - New time slot already booked',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Appointment UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  async rescheduleAppointment(
    @Param('id') id: string,
    @Body() rescheduleDto: RescheduleAppointmentDto,
  ): Promise<AppointmentResponseDto> {
    return this.appointmentsService.rescheduleAppointment(id, rescheduleDto);
  }

  /**
   * Check in patient for appointment
   *
   * Allows clinic staff to check in a patient when they arrive at the clinic
   * Changes appointment status from PENDING or CONFIRMED to CHECKED_IN
   *
   * @param id - Appointment UUID
   * @param checkInDto - Empty DTO (endpoint does not require body)
   * @returns Updated appointment details
   */
  @Patch(':id/check-in')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.CLINIC_STAFF)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Check in patient for appointment',
    description:
      'Check in a patient when they arrive at the clinic. Changes status from PENDING or CONFIRMED to CHECKED_IN.',
  })
  @ApiResponse({
    status: 200,
    description: 'Patient checked in successfully',
    type: AppointmentResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Appointment status is not PENDING or CONFIRMED',
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
    description: 'Not Found - Appointment not found',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Appointment UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  async checkInPatient(
    @Param('id') id: string,
    @Body() checkInDto: CheckInDto,
  ): Promise<AppointmentResponseDto> {
    return this.appointmentsService.checkInPatient(id, checkInDto);
  }

  /**
   * Accept appointment (Staff/Doctor)
   *
   * Allows clinic staff or doctor to accept a pending appointment
   * Changes appointment status from PENDING to CONFIRMED
   *
   * @param req - Request object containing authenticated user
   * @param id - Appointment UUID
   * @param acceptDto - Empty DTO (endpoint does not require body)
   * @returns Updated appointment details
   */
  @Patch(':id/accept')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.CLINIC_STAFF, AccountRole.DOCTOR)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Accept appointment (Staff/Doctor)',
    description:
      'Staff or doctor accepts a pending appointment. Changes status from PENDING to CONFIRMED.',
  })
  @ApiResponse({
    status: 200,
    description: 'Appointment accepted successfully',
    type: AppointmentResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Appointment status is not PENDING',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description:
      'Forbidden - User is not a clinic staff or doctor',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Appointment not found',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Appointment UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  async acceptAppointment(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() acceptDto: AcceptAppointmentDto,
  ): Promise<AppointmentResponseDto> {
    const userAccountId = req.user._id;
    return this.appointmentsService.acceptAppointment(
      id,
      userAccountId,
      acceptDto,
    );
  }

  /**
   * Decline appointment (Staff/Doctor)
   *
   * Allows clinic staff or doctor to decline a pending appointment
   * Changes appointment status from PENDING to CANCELLED with reject reason
   *
   * @param req - Request object containing authenticated user
   * @param id - Appointment UUID
   * @param declineDto - Reject reason (required)
   * @returns Updated appointment details
   */
  @Patch(':id/decline')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.CLINIC_STAFF, AccountRole.DOCTOR)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Decline appointment (Staff/Doctor)',
    description:
      'Staff or doctor declines a pending appointment. Changes status from PENDING to CANCELLED with reject reason.',
  })
  @ApiResponse({
    status: 200,
    description: 'Appointment declined successfully',
    type: AppointmentResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Appointment status is not PENDING',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description:
      'Forbidden - User is not a clinic staff or doctor',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Appointment not found',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Appointment UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  async declineAppointment(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() declineDto: DeclineAppointmentDto,
  ): Promise<AppointmentResponseDto> {
    const userAccountId = req.user._id;
    return this.appointmentsService.declineAppointment(
      id,
      userAccountId,
      declineDto,
    );
  }

  /**
   * Update appointment status (Generic - Admin/Staff)
   *
   * Allows admin or clinic staff to manually change appointment status
   * Validates transitions and enforces business rules
   *
   * @param id - Appointment UUID
   * @param updateStatusDto - New status and optional reason
   * @returns Updated appointment details
   */
  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.ADMIN, AccountRole.CLINIC_STAFF, AccountRole.CLINIC_MANAGER)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update appointment status ',
    description:
      'Manually update appointment status to any valid state. Validates status transitions and requires reason for certain statuses (CANCELLED, PAYMENT_FAILED, etc.).',
  })
  @ApiResponse({
    status: 200,
    description: 'Appointment status updated successfully',
    type: AppointmentResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid status transition or missing reason',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User is not admin or staff',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Appointment not found',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Appointment UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  async updateAppointmentStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateStatusDto: UpdateAppointmentStatusDto,
  ): Promise<AppointmentResponseDto> {
    return this.appointmentsService.updateAppointmentStatus(
      id,
      updateStatusDto,
    );
  }
}
