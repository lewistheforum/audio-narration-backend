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
  Res,
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
import { BookingSessionService } from './booking-session.service';
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
  AddServiceDto,
  AddServiceResponseDto,
  PatientAppointmentDetailResponseDto,
  CreateBookingSessionDto,
  UpdateBookingSessionDto,
  CreateAppointmentFromSessionDto,
  WorkHistoryQueryDto,
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
 *
 * Patient Booking Flow:
 * - GET /patients/services - List available services
 * - GET /patients/clinics/:clinicId/working-days - Get available dates
 * - GET /patients/clinics/:clinicId/services/:serviceConfigId/slots - Get available slots
 * - GET /patients/me/appointments - Get patient's appointments
 * - POST /patients/booking-sessions - Create booking session
 * - PATCH /patients/booking-sessions/:sessionId - Update booking session
 * - POST /patients/appointments - Create appointment from session
 */
@ApiTags('Appointments')
@Controller('appointments')
export class AppointmentsController {
  constructor(
    private readonly appointmentsService: AppointmentsService,
    private readonly bookingSessionService: BookingSessionService,
  ) { }

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
   * Add additional service to appointment
   *
   * Allows doctor to add new services (e.g., X-ray, Lab tests) during examination.
   * The service will be marked as "additional" and require payment processing.
   *
   * API: POST /api/appointments/:id/add-service
   *
   * Business Rules:
   * - Only allowed when appointment status = IN_PROGRESS
   * - Service must not already exist in the appointment
   * - Service must belong to the current clinic
   * - Creates new AppointmentPackage with transactionId = null
   * - Creates new ServiceAppointment linked to the package
   *
   * @param req - Request object with authenticated doctor
   * @param appointmentId - UUID of the appointment
   * @param addServiceDto - DTO containing clinic service ID to add
   * @returns Created package and service appointment details
   */
  @Post(':id/add-service')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.DOCTOR)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add additional service to appointment (ERM Flow - Additional Service)',
    description:
      'Add new service during examination (e.g., X-ray, Lab tests). ' +
      'Only allowed when appointment is IN_PROGRESS. ' +
      'Creates new AppointmentPackage and ServiceAppointment. ' +
      'Service will require payment processing by clinic staff after examination.',
  })
  @ApiResponse({
    status: 201,
    description: 'Service added successfully',
    schema: {
      type: 'object',
      properties: {
        appointmentPackageId: { type: 'string', example: 'pkg-uuid' },
        serviceAppointmentId: { type: 'string', example: 'sa-uuid' },
        appointmentId: { type: 'string', example: 'appt-uuid' },
        clinicServiceId: { type: 'string', example: 'service-uuid' },
        serviceName: { type: 'string', example: 'X-ray Chest' },
        serviceType: { type: 'string', enum: ['CONSULTATION', 'XRAY', 'ULTRASOUND', 'LAB', 'BONE_DENSITY', 'PROCEDURE'], example: 'XRAY' },
        price: { type: 'number', example: 200000 },
        addedDuringExamination: { type: 'boolean', example: true },
        addedBy: { type: 'string', example: 'doctor-uuid' },
        createdAt: { type: 'string', format: 'date-time', example: '2026-03-02T10:30:00Z' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid status, service already exists, or validation failed',
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
    description: 'Not Found - Appointment or service not found',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Appointment UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({
    type: AddServiceDto,
    description: 'Service to add',
    examples: {
      xray: {
        summary: 'Add X-ray service',
        value: {
          clinicServiceId: '550e8400-e29b-41d4-a716-446655440000',
        },
      },
    },
  })
  async addServiceToAppointment(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) appointmentId: string,
    @Body() addServiceDto: AddServiceDto,
  ): Promise<AddServiceResponseDto> {
    const doctorId = req.user._id;
    return this.appointmentsService.addServiceToAppointment(
      appointmentId,
      doctorId,
      addServiceDto.clinicServiceId,
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
   * Add extra service to an existing appointment
   *
   * @param id - Appointment UUID
   * @param body - { clinicServiceConfigId: string }
   * @returns Created extra package and service link
   */
  @Post(':id/extra-service')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    AccountRole.CLINIC_STAFF,
    AccountRole.CLINIC_ADMIN,
    AccountRole.CLINIC_MANAGER,
  )
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add extra service to appointment',
    description:
      'Clinic staff can add more services to an existing appointment.',
  })
  @ApiParam({ name: 'id', description: 'Appointment ID' })
  @ApiResponse({ status: 201, description: 'Service added successfully' })
  async addExtraService(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { clinicServiceConfigId: string },
  ) {
    return await this.appointmentsService.addExtraService(
      id,
      body.clinicServiceConfigId,
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

  /**
   * Get doctor work history
   * 
   * Get paginated work history including revenue for a specific doctor
   * 
   * @param doctorId - Doctor UUID
   * @param queryDto - Filter options (dates, status, pagination)
   */
  @Get('doctors/:doctorId/work-history')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.DOCTOR, AccountRole.CLINIC_ADMIN, AccountRole.CLINIC_MANAGER)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get doctor work history',
    description: 'Get paginated work history including revenue calculation. Managers/Admins can only view doctors in their clinic.',
  })
  @ApiResponse({
    status: 200,
    description: 'Work history retrieved successfully',
    type: PaginatedAppointmentResponseDto,
  })
  async getDoctorWorkHistory(
    @Request() req,
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
    @Query() queryDto: WorkHistoryQueryDto,
  ): Promise<PaginatedAppointmentResponseDto> {
    return this.appointmentsService.getDoctorWorkHistory(
      req.user.accountId || req.user._id,
      doctorId,
      queryDto,
    );
  }

  /**
   * Export doctor work history to CSV
   * 
   * @param doctorId - Doctor UUID
   * @param queryDto - Filter options
   * @param res - Express response object for file download
   */
  @Get('doctors/:doctorId/work-history/export')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.DOCTOR, AccountRole.CLINIC_ADMIN, AccountRole.CLINIC_MANAGER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Export doctor work history',
    description: 'Download work history as a CSV file.',
  })
  @ApiResponse({
    status: 200,
    description: 'CSV file download',
  })
  async exportDoctorWorkHistoryCSV(
    @Request() req,
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
    @Query() queryDto: WorkHistoryQueryDto,
    @Res() res,
  ) {
    const csvContent = await this.appointmentsService.exportDoctorWorkHistoryCSV(
      req.user.accountId || req.user._id,
      doctorId,
      queryDto,
    );

    res.header('Content-Type', 'text/csv');
    res.attachment(`work-history-${doctorId}-${new Date().toISOString().split('T')[0]}.csv`);

    // Add BOM for Excel UTF-8 display
    res.write('\uFEFF');
    return res.end(csvContent);
  }

  // ========================================================================
  // PATIENT BOOKING FLOW ENDPOINTS
  // ========================================================================

  /**
   * Get available services (Step 1 - Option 1: Service-first)
   *
   * Returns list of active clinic services with calculated final price.
   * Supports pagination, search, and filtering by category/clinic.
   *
   * @param page - Page number for pagination
   * @param limit - Number of items per page
   * @param search - Search by service name (optional)
   * @param categoryId - Filter by category UUID (optional)
   * @param clinicId - Filter by clinic UUID (optional)
   * @returns Paginated list of available services
   */
  @Get('patients/services')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.PATIENT)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get available services for booking (Patient)',
    description:
      'List all active services across clinics with pricing. Supports search by name, filter by category and clinic.',
  })
  @ApiResponse({
    status: 200,
    description: 'Services retrieved successfully',
    schema: {
      example: {
        data: [
          {
            clinic_service_config_id: 'uuid',
            clinic_id: 'uuid',
            clinic_name: 'Phòng khám ABC',
            clinic_address: '123 Đường X, Q.1, TP.HCM',
            service_id: 'uuid',
            service_name: 'Khám Xương Khớp',
            category_id: 'uuid',
            category_name: 'Khám Chuyên Khoa',
            price: 300000,
            discount: 10,
            final_price: 270000,
            description: 'Khám và điều trị bệnh xương khớp',
          },
        ],
        meta: {
          total: 45,
          page: 1,
          limit: 20,
          total_pages: 3,
        },
      },
    },
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    example: 20,
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search by service name',
  })
  @ApiQuery({
    name: 'category_id',
    required: false,
    type: String,
    description: 'Filter by service category UUID',
  })
  @ApiQuery({
    name: 'clinic_id',
    required: false,
    type: String,
    description: 'Filter by clinic UUID',
  })
  async getAvailableServices(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('search') search?: string,
    @Query('category_id') categoryId?: string,
    @Query('clinic_id') clinicId?: string,
  ) {
    return this.appointmentsService.getAvailableServices({
      page: Number(page),
      limit: Number(limit),
      search,
      categoryId,
      clinicId,
    });
  }

  /**
   * Get working days for clinic (Step 2 - Option 1: Service-first)
   *
   * Returns available dates where clinic has doctors working
   * and slots are available. Can filter by service.
   *
   * @param clinicId - Clinic UUID
   * @param serviceConfigId - Service config UUID (optional)
   * @returns List of available dates with slot information
   */
  @Get('patients/clinics/:clinicId/working-days')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.PATIENT)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get available working days for clinic (Patient)',
    description:
      'Get list of dates where clinic has available appointments. Can filter by service.',
  })
  @ApiResponse({
    status: 200,
    description: 'Working days retrieved successfully',
    schema: {
      example: {
        data: [
          {
            date: '2026-02-25',
            week_day: 'THỨ BA',
            available_slots: 12,
            available_doctors: 3,
          },
          {
            date: '2026-02-26',
            week_day: 'THỨ TƯ',
            available_slots: 8,
            available_doctors: 2,
          },
        ],
      },
    },
  })
  @ApiParam({
    name: 'clinicId',
    type: String,
    description: 'Clinic UUID',
  })
  @ApiQuery({
    name: 'service_config_id',
    required: false,
    type: String,
    description: 'Filter by service config UUID (optional)',
  })
  async getWorkingDays(
    @Param('clinicId', ParseUUIDPipe) clinicId: string,
    @Query('service_config_id') serviceConfigId?: string,
  ) {
    return this.appointmentsService.getWorkingDays(clinicId, serviceConfigId);
  }

  /**
   * Get available slots (Step 3 - Option 1: Service-first)
   *
   * Returns doctors and their available time slots for a specific service
   * on a specific date, grouped by shift (morning, afternoon, evening).
   *
   * @param clinicId - Clinic UUID
   * @param serviceConfigId - Service config UUID
   * @param date - Appointment date (YYYY-MM-DD)
   * @returns Available slots grouped by shift
   */
  @Get('patients/clinics/:clinicId/services/:serviceConfigId/slots')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.PATIENT)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get available slots for service on date (Patient)',
    description:
      'Get available time slots with doctor information for a specific service and date. Grouped by shift (morning, afternoon, evening).',
  })
  @ApiResponse({
    status: 200,
    description: 'Slots retrieved successfully',
    schema: {
      example: {
        data: [
          {
            shift: 'MORNING',
            slots: [
              {
                doctor_shift_hour_id: 'uuid',
                doctor_id: 'uuid',
                doctor_name: 'BS. Nguyễn Văn A',
                doctor_specialty: 'Bác sĩ Xương Khớp',
                start_time: '08:00:00',
                end_time: '08:30:00',
                limit: 5,
                available_slots: 3,
                clinic_room: 'Phòng 101',
              },
            ],
          },
          {
            shift: 'AFTERNOON',
            slots: [],
          },
        ],
      },
    },
  })
  @ApiParam({
    name: 'clinicId',
    type: String,
    description: 'Clinic UUID',
  })
  @ApiParam({
    name: 'serviceConfigId',
    type: String,
    description: 'Service Config UUID',
  })
  @ApiQuery({
    name: 'date',
    required: true,
    type: String,
    description: 'Appointment date (YYYY-MM-DD)',
    example: '2026-02-25',
  })
  async getAvailableSlots(
    @Param('clinicId', ParseUUIDPipe) clinicId: string,
    @Param('serviceConfigId', ParseUUIDPipe) serviceConfigId: string,
    @Query('date') date: string,
  ) {
    return this.appointmentsService.getAvailableSlots(
      clinicId,
      serviceConfigId,
      date,
    );
  }

  /**
   * Get patient's appointments (Step 5 - Patient appointment history)
   *
   * Returns list of patient's appointments with pagination and filtering.
   * Includes clinic, doctor, and services information.
   * Supports UPCOMING/HISTORY tab filtering for better user experience.
   *
   * @param req - Request object containing authenticated user
   * @param page - Page number for pagination
   * @param limit - Number of items per page
   * @param tab - Filter by tab: UPCOMING or HISTORY (optional)
   * @param status - Filter by status (optional, overrides tab)
   * @param appointmentDate - Filter by appointment date (optional)
   * @returns Paginated list of patient's appointments
   */
  @Get('patients/me/appointments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.PATIENT)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get my appointments (Patient)',
    description:
      'Retrieve all appointments for the authenticated patient. Supports filtering by UPCOMING/HISTORY tabs, status, and date with pagination. UPCOMING tab shows active appointments (PENDING, CONFIRMED, CHECKED_IN, IN_PROGRESS) with dates >= today. HISTORY tab shows completed/cancelled appointments or past appointments.',
  })
  @ApiResponse({
    status: 200,
    description: 'Appointments retrieved successfully',
    schema: {
      example: {
        data: [
          {
            _id: '550e8400-e29b-41d4-a716-446655440000',
            clinic: {
              _id: '550e8400-e29b-41d4-a716-446655440001',
              name: 'Phòng khám ABC',
              address: '123 Đường ABC, Quận 1, TP.HCM',
            },
            doctor: {
              _id: '550e8400-e29b-41d4-a716-446655440002',
              name: 'BS. Nguyễn Văn A',
              profilePicture: 'https://example.com/doctor.jpg',
            },
            appointment_date: '2026-03-15',
            appointment_hour: '2026-03-15T08:00:00.000Z',
            status: 'PENDING',
            total: 270000,
            services: [
              {
                service_id: '550e8400-e29b-41d4-a716-446655440003',
                service_name: 'Khám Xương Khớp',
                price: 270000,
              },
            ],
          },
        ],
        meta: {
          total: 25,
          page: 1,
          limit: 10,
          total_pages: 3,
        },
      },
    },
  })
  @ApiQuery({
    name: 'tab',
    required: false,
    enum: ['UPCOMING', 'HISTORY'],
    description: 'Filter by tab: UPCOMING (active future appointments) or HISTORY (completed/past appointments)',
    example: 'UPCOMING',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    example: 10,
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: AppointmentStatus,
    description: 'Filter by specific appointment status (overrides tab filter)',
  })
  @ApiQuery({
    name: 'appointment_date',
    required: false,
    type: String,
    description: 'Filter by appointment date (YYYY-MM-DD)',
    example: '2026-03-15',
  })
  async getMyAppointments(
    @Request() req: any,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('tab') tab?: 'UPCOMING' | 'HISTORY',
    @Query('status') status?: string,
    @Query('appointment_date') appointmentDate?: string,
  ) {
    const patientId = req.user._id;
    return this.appointmentsService.getMyAppointments(patientId, {
      page: Number(page),
      limit: Number(limit),
      tab,
      status,
      appointmentDate,
    });
  }

  /**
   * Get My Appointment Detail (Patient)
   *
   * Returns comprehensive details of a specific appointment including:
   * - Clinic and doctor information
   * - Appointment packages with services
   * - ERM summaries for each service
   * - E-prescription summary (only when status is COMPLETED)
   * - Reject reason (only when status is CANCELLED)
   *
   * Security:
   * - JWT Authentication required
   * - PATIENT role only
   * - Strict ownership verification (appointment must belong to the authenticated patient)
   *
   * @param req - Request object with authenticated user
   * @param id - Appointment ID (UUID)
   * @returns PatientAppointmentDetailResponseDto
   */
  @Get('patients/me/appointments/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.PATIENT)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get appointment detail (Patient)',
    description:
      'Returns comprehensive details of a specific appointment for the authenticated patient. ' +
      'Includes clinic/doctor info, services, ERM summaries, and conditional fields based on appointment status.',
  })
  @ApiParam({
    name: 'id',
    description: 'Appointment ID (UUID)',
    example: 'a1a2b3c4-d5e6-7890-abcd-ef1234567890',
  })
  @ApiResponse({
    status: 200,
    description: 'Appointment details retrieved successfully',
    type: PatientAppointmentDetailResponseDto,
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
    status: 404,
    description: 'Not Found - Appointment not found or access denied',
  })
  async getMyAppointmentDetail(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const patientId = req.user._id;
    return this.appointmentsService.getMyAppointmentDetail(patientId, id);
  }

  /**
   * Get clinics by working date (Step 2a - Option 3: Date-first)
   *
   * Returns clinics that have available appointments on the specified date.
   * Supports pagination, search by clinic name, and filter by district.
   *
   * @param queryDto - Query parameters (working_date, pagination, filters)
   * @returns Paginated list of clinics with availability information
   */
  @Get('patients/clinics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.PATIENT)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get clinics by working date (Patient)',
    description:
      'Get list of clinics that have available slots on a specific date. Used for Option 3: Date-first booking. Supports search and district filtering.',
  })
  @ApiResponse({
    status: 200,
    description: 'Clinics retrieved successfully',
    schema: {
      example: {
        data: [
          {
            clinic_id: 'uuid',
            clinic_name: 'Phòng khám Đa khoa Medicare',
            clinic_address: '123 Đường X, Quận 1, TP.HCM',
            district: 'Quận 1',
            available_slots: 15,
            available_doctors: 3,
          },
        ],
        meta: {
          total: 10,
          page: 1,
          limit: 20,
          total_pages: 1,
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid working date or out of range',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiQuery({
    name: 'working_date',
    required: true,
    type: String,
    description: 'Working date in YYYY-MM-DD format',
    example: '2026-02-25',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    example: 20,
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search by clinic name',
  })
  @ApiQuery({
    name: 'district',
    required: false,
    type: String,
    description: 'Filter by district',
  })
  async getClinicsByWorkingDate(
    @Query('working_date') workingDate: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('search') search?: string,
    @Query('district') district?: string,
  ) {
    return this.appointmentsService.getClinicsByWorkingDate({
      working_date: workingDate,
      page: Number(page),
      limit: Number(limit),
      search,
      district,
    });
  }

  // ========================================================================
  // BOOKING SESSION ENDPOINTS (PATIENT ROLE)
  // ========================================================================

  /**
   * Create booking session (Step 1)
   *
   * Initialize a new booking session for Option 1 (service-first),
   * Option 2 (doctor-first), or Option 3 (date-first).
   * Session is stored in Redis with 30-minute TTL.
   *
   * @param req - Request object containing authenticated user
   * @param createDto - Booking option and initial data
   * @returns Session ID and initial session data
   */
  @Post('patients/booking-sessions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.PATIENT)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create booking session (Patient)',
    description:
      'Initialize a new booking session with initial data based on the selected booking option (service, doctor, or date). Session expires in 30 minutes.',
  })
  @ApiResponse({
    status: 201,
    description: 'Booking session created successfully',
    schema: {
      example: {
        message: 'Phiên đặt lịch được tạo thành công',
        data: {
          session_id: '123e4567-e89b-12d3-a456-426614174000',
          booking_option: 'service',
          current_step: 1,
          expires_at: '2026-02-25T11:30:00.000Z',
          booking_data: {
            clinic_service_config_id: '123e4567-e89b-12d3-a456-426614174001',
            clinic_id: '123e4567-e89b-12d3-a456-426614174002',
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid initial data or inactive service/clinic',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User is not a patient',
  })
  async createBookingSession(
    @Request() req: any,
    @Body() createDto: CreateBookingSessionDto,
  ): Promise<any> {
    const patientId = req.user._id;
    const result = await this.bookingSessionService.createSession(
      patientId,
      createDto,
    );
    return {
      message: 'Phiên đặt lịch được tạo thành công',
      data: result,
    };
  }

  /**
   * Update booking session (Steps 2-4)
   *
   * Update the booking session with additional data step-by-step.
   * - Step 2: Add appointment_date
   * - Step 3: Add doctor_shift_hour_id and doctor_id
   * - Step 4: Add patient_note (optional)
   *
   * @param req - Request object containing authenticated user
   * @param sessionId - Session UUID
   * @param updateDto - Step number and data to update
   * @returns Updated session data
   */
  @Patch('patients/booking-sessions/:sessionId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.PATIENT)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update booking session (Patient)',
    description:
      'Update the booking session with additional data based on the current step. Steps must be executed in order (2, 3, 4).',
  })
  @ApiResponse({
    status: 200,
    description: 'Booking session updated successfully',
    schema: {
      example: {
        message: 'Cập nhật phiên đặt lịch thành công',
        data: {
          session_id: '123e4567-e89b-12d3-a456-426614174000',
          current_step: 2,
          booking_data: {
            clinic_service_config_id: '123e4567-e89b-12d3-a456-426614174001',
            clinic_id: '123e4567-e89b-12d3-a456-426614174002',
            appointment_date: '2026-02-25',
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid step sequence or data',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Session does not belong to user',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Session not found or expired',
  })
  @ApiParam({
    name: 'sessionId',
    type: String,
    description: 'Booking session UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  async updateBookingSession(
    @Request() req: any,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() updateDto: UpdateBookingSessionDto,
  ): Promise<any> {
    const patientId = req.user._id;
    const result = await this.bookingSessionService.updateSession(
      sessionId,
      patientId,
      updateDto,
    );
    return {
      message: 'Cập nhật phiên đặt lịch thành công',
      data: result,
    };
  }

  /**
   * Create appointment from session (Final step)
   *
   * Finalize the booking by creating an appointment from the completed session.
   * This endpoint:
   * - Reads session data from Redis
   * - Validates all business rules
   * - Creates appointment with pessimistic locking
   * - Deletes Redis session on success
   * - Sends email notifications
   *
   * IMPORTANT: Only supports online payment. COD is not available.
   *
   * @param req - Request object containing authenticated user
   * @param createDto - Session ID and payment method
   * @returns Created appointment details
   */
  @Post('patients/appointments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.PATIENT)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create appointment from session (Patient)',
    description:
      'Finalize booking by creating an appointment from a completed session. Requires session_id and payment_method (must be "online"). Session will be deleted after successful creation.',
  })
  @ApiResponse({
    status: 201,
    description: 'Appointment created successfully',
    schema: {
      example: {
        message: 'Đặt lịch hẹn thành công',
        data: {
          appointment_id: '123e4567-e89b-12d3-a456-426614174000',
          clinic_id: '123e4567-e89b-12d3-a456-426614174002',
          service_name: 'Khám Xương Khớp',
          appointment_date: '2026-02-25',
          appointment_hour: '2026-02-25T08:00:00.000Z',
          start_time: '08:00:00',
          end_time: '08:30:00',
          total: 270000,
          status: 'PENDING',
          payment_type: 'online',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Incomplete session, slot full, or invalid payment method',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Session does not belong to user',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Session not found or expired',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Duplicate appointment at this time',
  })
  async createAppointmentFromSession(
    @Request() req: any,
    @Body() createDto: CreateAppointmentFromSessionDto,
  ): Promise<any> {
    const patientId = req.user._id;
    const result = await this.appointmentsService.createAppointmentFromSession(
      createDto.session_id,
      patientId,
      createDto.payment_method,
    );
    return {
      message: 'Đặt lịch hẹn thành công',
      data: result,
    };
  }

  // ========================================================================
  // OPTION 2: DOCTOR-FIRST BOOKING FLOW ENDPOINTS (PATIENT ROLE)
  // ========================================================================

  /**
   * Get available doctors (Step 1a - Option 2: Doctor-first)
   *
   * Returns list of active doctors with their clinics.
   * Supports pagination, search, and filtering by specialization/clinic.
   *
   * @param page - Page number for pagination
   * @param limit - Number of items per page
   * @param search - Search by doctor full name (optional)
   * @param specialization - Filter by specialization (optional)
   * @param clinicId - Filter by clinic UUID (optional)
   * @returns Paginated list of available doctors
   */
  @Get('patients/doctors')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.PATIENT)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get available doctors for booking (Patient)',
    description:
      'List all active doctors with their clinics. Supports search by name, filter by specialization and clinic.',
  })
  @ApiResponse({
    status: 200,
    description: 'Doctors retrieved successfully',
    schema: {
      example: {
        data: [
          {
            doctor_id: 'uuid',
            full_name: 'BS. Nguyễn Văn A',
            specialization: 'Bác sĩ Xương Khớp',
            clinics: [
              {
                clinic_id: 'uuid',
                clinic_name: 'Phòng khám ABC',
                clinic_address: '123 Đường X, Q.1, TP.HCM',
              },
            ],
          },
        ],
        meta: {
          total: 25,
          page: 1,
          limit: 20,
          total_pages: 2,
        },
      },
    },
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    example: 20,
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search by doctor full name',
  })
  @ApiQuery({
    name: 'specialization',
    required: false,
    type: String,
    description: 'Filter by specialization',
  })
  @ApiQuery({
    name: 'clinic_id',
    required: false,
    type: String,
    description: 'Filter by clinic UUID',
  })
  async getDoctors(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('search') search?: string,
    @Query('specialization') specialization?: string,
    @Query('clinic_id') clinicId?: string,
  ) {
    return this.appointmentsService.getDoctors({
      page: Number(page),
      limit: Number(limit),
      search,
      specialization,
      clinic_id: clinicId,
    });
  }

  /**
   * Get working days for doctor (Step 2a - Option 2: Doctor-first)
   *
   * Returns available dates where doctor is working and has available slots.
   * Can be filtered by clinic if doctor works at multiple clinics.
   *
   * @param doctorId - Doctor UUID
   * @param clinicId - Clinic UUID (optional)
   * @returns List of available working days for doctor
   */
  @Get('patients/doctors/:doctorId/working-days')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.PATIENT)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get available working days for doctor (Patient)',
    description:
      'Get list of dates where doctor has available appointments. Can filter by clinic if doctor works at multiple locations.',
  })
  @ApiResponse({
    status: 200,
    description: 'Working days retrieved successfully',
    schema: {
      example: {
        data: [
          {
            date: '2026-02-25',
            week_day: 'THỨ BA',
            clinic_id: 'uuid',
            clinic_name: 'Phòng khám ABC',
            available_slots: 12,
          },
          {
            date: '2026-02-26',
            week_day: 'THỨ TƯ',
            clinic_id: 'uuid',
            clinic_name: 'Phòng khám ABC',
            available_slots: 8,
          },
        ],
      },
    },
  })
  @ApiParam({
    name: 'doctorId',
    type: String,
    description: 'Doctor UUID',
  })
  @ApiQuery({
    name: 'clinic_id',
    required: false,
    type: String,
    description: 'Filter by clinic UUID (optional if doctor works at multiple clinics)',
  })
  async getDoctorWorkingDays(
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
    @Query('clinic_id') clinicId?: string,
  ) {
    return this.appointmentsService.getDoctorWorkingDays(doctorId, clinicId);
  }

  /**
   * Get available slots and services for doctor (Step 3a - Option 2: Doctor-first)
   *
   * Returns doctor's available time slots and services they can provide
   * on a specific date at a specific clinic, grouped by shift (morning, afternoon, evening).
   *
   * @param doctorId - Doctor UUID
   * @param date - Appointment date (YYYY-MM-DD)
   * @param clinicId - Clinic UUID
   * @returns Available slots and services for doctor on specified date
   */
  @Get('patients/doctors/:doctorId/slots')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.PATIENT)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get available slots and services for doctor on date (Patient)',
    description:
      'Get available time slots and services that the doctor can provide on a specific date at a specific clinic. Grouped by shift (morning, afternoon, evening).',
  })
  @ApiResponse({
    status: 200,
    description: 'Slots and services retrieved successfully',
    schema: {
      example: {
        slots: [
          {
            shift: 'MORNING',
            slots: [
              {
                doctor_shift_hour_id: 'uuid',
                start_time: '08:00:00',
                end_time: '08:30:00',
                limit: 5,
                available_slots: 3,
                clinic_room: 'Phòng 101',
              },
            ],
          },
          {
            shift: 'AFTERNOON',
            slots: [],
          },
        ],
        available_services: [
          {
            clinic_service_config_id: 'uuid',
            service_id: 'uuid',
            service_name: 'Khám Xương Khớp',
            category_name: 'Khám Chuyên Khoa',
            price: 300000,
            discount: 10,
            final_price: 270000,
            description: 'Khám và tư vấn về xương khớp',
          },
        ],
      },
    },
  })
  @ApiParam({
    name: 'doctorId',
    type: String,
    description: 'Doctor UUID',
  })
  @ApiQuery({
    name: 'date',
    required: true,
    type: String,
    description: 'Appointment date (YYYY-MM-DD)',
    example: '2026-02-25',
  })
  @ApiQuery({
    name: 'clinic_id',
    required: true,
    type: String,
    description: 'Clinic UUID',
  })
  async getDoctorSlots(
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
    @Query('date') date: string,
    @Query('clinic_id', ParseUUIDPipe) clinicId: string,
  ) {
    return this.appointmentsService.getDoctorSlots(doctorId, date, clinicId);
  }
}
