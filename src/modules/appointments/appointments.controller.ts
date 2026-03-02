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
  ApiBody,
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
  QueryDoctorAppointmentDto,
  DoctorAppointmentListResponseDto,
  DoctorAppointmentDetailResponseDto,
  PendingServicesResponseDto,
  CompleteExaminationDto,
  CompleteExaminationResponseDto,
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
   * Get doctor's appointments (Step 1)
   *
   * Retrieves list of appointments assigned to the authenticated doctor
   * with optional filtering by date and status
   *
   * @param req - Request object containing authenticated doctor
   * @param queryDto - Query parameters (date, status)
   * @returns List of appointments with services and ERM status
   */
  @Get('doctor/me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.DOCTOR)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get doctor\'s appointments (Step 1 - ERM Flow)',
    description:
      'Retrieve list of appointments assigned to the authenticated doctor. ' +
      'Shows CHECKED_IN and IN_PROGRESS appointments by default. ' +
      'Can filter by specific date and status.',
  })
  @ApiResponse({
    status: 200,
    description: 'Appointments retrieved successfully',
    type: DoctorAppointmentListResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User is not a doctor',
  })
  @ApiQuery({
    name: 'date',
    required: false,
    type: String,
    description: 'Filter by appointment date (YYYY-MM-DD)',
    example: '2026-02-24',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['CHECKED_IN', 'IN_PROGRESS', 'CONFIRMED'],
    description: 'Filter by appointment status',
    example: 'CHECKED_IN',
  })
  async getDoctorAppointments(
    @Request() req: any,
    @Query() queryDto: QueryDoctorAppointmentDto,
  ): Promise<DoctorAppointmentListResponseDto> {
    const doctorId = req.user._id;
    return this.appointmentsService.getDoctorAppointments(doctorId, queryDto);
  }

  /**
   * Get appointment detail for doctor (Step 2)
   *
   * Retrieves complete appointment information including patient details
   * and all services. Automatically updates status from CHECKED_IN to IN_PROGRESS.
   *
   * @param req - Request object containing authenticated doctor
   * @param appointmentId - UUID of the appointment
   * @returns Complete appointment details with patient info and services
   */
  @Get('doctor/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.DOCTOR)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get appointment detail with auto-status update (Step 2 - ERM Flow)',
    description:
      'Retrieve complete appointment information including patient profile, ' +
      'medical history, and all services with ERM status. ' +
      'Automatically updates appointment status from CHECKED_IN to IN_PROGRESS ' +
      'when doctor first accesses the appointment.',
  })
  @ApiResponse({
    status: 200,
    description: 'Appointment details retrieved successfully',
    type: DoctorAppointmentDetailResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Appointment not assigned to this doctor',
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
  async getAppointmentDetailForDoctor(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) appointmentId: string,
  ): Promise<DoctorAppointmentDetailResponseDto> {
    const doctorId = req.user._id;
    return this.appointmentsService.getAppointmentDetailForDoctor(
      appointmentId,
      doctorId,
    );
  }

  /**
   * Get pending and in-progress services (Step 6)
   *
   * Returns list of services that:
   * - Do not have ERM yet (pending_services)
   * - Have ERM with IN_PROGRESS status (in_progress_services)
   *
   * Allows doctor to see which services still need to be completed
   * or are currently being worked on.
   *
   * @param req - Request object containing authenticated doctor
   * @param appointmentId - UUID of the appointment
   * @returns Pending and in-progress services
   */
  @Get('doctor/:id/pending-services')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.DOCTOR)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get pending and in-progress services (Step 6 - ERM Flow)',
    description:
      'Retrieve list of services for an appointment that either have no ERM yet ' +
      'or have ERM with IN_PROGRESS status. Helps doctor track which services ' +
      'still need to be completed or can be edited. Doctor can loop back to Step 3-5 ' +
      'for pending services or edit in-progress ERMs.',
  })
  @ApiResponse({
    status: 200,
    description: 'Pending services retrieved successfully',
    type: PendingServicesResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Appointment not assigned to this doctor',
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
  async getPendingServices(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) appointmentId: string,
  ): Promise<PendingServicesResponseDto> {
    const doctorId = req.user._id;
    return this.appointmentsService.getPendingServices(appointmentId, doctorId);
  }

  /**
   * Complete examination process (Step 8 - ERM Flow)
   *
   * Finalizes the examination after all ERMs are completed and prescription is created.
   * This endpoint validates all requirements, locks ERMs and prescription (immutable),
   * and determines appointment status based on payment logic.
   *
   * Validation requirements:
   * - All service_appointments must have ERM with IN_PROGRESS status
   * - If there's CONSULTATION ERM, e_prescription must exist
   * - Appointment status must be IN_PROGRESS
   *
   * After completion:
   * - All ERMs change from IN_PROGRESS to COMPLETED (immutable)
   * - E-prescription is locked (immutable)
   * - Appointment status is determined:
   *   * COMPLETED: if paid online AND no additional services (can export prescription)
   *   * AWAITING_PAYMENT: if not paid OR has additional services (go to payment)
   *
   * @param req - Request object containing authenticated doctor
   * @param appointmentId - Appointment UUID
   * @returns CompleteExaminationResponseDto with appointment status and next steps
   */
  @Post(':id/complete-examination')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.DOCTOR)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Complete examination process (Step 8 - ERM Flow)',
    description:
      'Finalize examination after all ERMs are completed and prescription is created. ' +
      'Validates all requirements, locks ERMs and prescription (immutable), ' +
      'and determines appointment status based on payment logic. ' +
      '\n\nValidation:\n' +
      '- All services must have ERM with IN_PROGRESS status\n' +
      '- CONSULTATION ERM requires e_prescription\n' +
      '\nAfter completion:\n' +
      '- All ERMs → COMPLETED (immutable)\n' +
      '- E-prescription locked (immutable)\n' +
      '- Appointment status determined by payment logic\n' +
      '\nPayment Logic:\n' +
      '- COMPLETED: paid online + no additional services (can export prescription)\n' +
      '- AWAITING_PAYMENT: not paid OR has additional services (proceed to payment)',
  })
  @ApiResponse({
    status: 200,
    description: 'Examination completed successfully',
    schema: {
      type: 'object',
      properties: {
        appointmentId: { type: 'string', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
        appointmentStatus: { type: 'string', enum: ['COMPLETED', 'AWAITING_PAYMENT'], example: 'COMPLETED' },
        paymentStatus: { type: 'string', enum: ['PAID', 'UNPAID', 'PARTIAL'], example: 'PAID' },
        completedAt: { type: 'string', format: 'date-time', example: '2026-02-25T10:30:00Z' },
        ermsSummary: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              serviceName: { type: 'string', example: 'Khám tư vấn' },
              ermId: { type: 'string', example: 'erm-uuid' },
              status: { type: 'string', example: 'COMPLETED' },
            },
          },
        },
        hasPrescription: { type: 'boolean', example: true },
        ePrescriptionId: { type: 'string', example: 'prescription-uuid' },
        hasAdditionalServices: { type: 'boolean', example: false },
        additionalAmount: { type: 'number', example: 0 },
        nextStep: { type: 'string', enum: ['EXPORT_PRESCRIPTION', 'PROCEED_TO_PAYMENT'], example: 'EXPORT_PRESCRIPTION' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Validation failed (missing ERMs, DRAFT ERMs, or missing prescription)',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Cannot complete examination' },
        missingRequirements: {
          type: 'array',
          items: { type: 'string' },
          example: ['Service (ID: xxx) does not have ERM', 'E-prescription not created (required when there is consultation ERM)'],
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Appointment not assigned to this doctor',
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
  async completeExamination(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) appointmentId: string,
  ): Promise<CompleteExaminationResponseDto> {
    const doctorId = req.user._id;
    return this.appointmentsService.completeExamination(
      appointmentId,
      doctorId,
    );
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
