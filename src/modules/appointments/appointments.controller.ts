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
  ApiNotFoundResponse,
  ApiForbiddenResponse,
  ApiProduces,
} from '@nestjs/swagger';
import { Response } from 'express';
import { getDateString } from 'src/common/utils/date.util';
import { AppointmentsService } from './appointments.service';
import { BookingSessionService } from './booking-session.service';
import {
  QueryAppointmentDto,
  PaginatedAppointmentResponseDto,
  CreateAppointmentDto,
  StaffCreateAppointmentDto,
  StaffCancelAppointmentDto,
  PatientCancelAppointmentDto,
  AppointmentResponseDto,
  StaffRescheduleAppointmentDto,
  AcceptAppointmentDto,
  DeclineAppointmentDto,
  UpdateAppointmentStatusDto,
  AppointmentDetailResponseDto,
  QueryDoctorAppointmentDto,
  DoctorAppointmentListResponseDto,
  DoctorAppointmentsResponseDto,
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
  DoctorPatientHistoryQueryDto,
  DoctorPatientHistoryResponseDto,
  DoctorPatientAppointmentsQueryDto,
  DoctorPatientDetailResponseDto,
  DoctorAppointmentHistoryDetailResponseDto,
  AvailableDoctorsResponseDto,
} from './dto';
import { JwtAuthGuard } from '../auth/jwt.strategy';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccountRole } from '../accounts/enums';
import { AppointmentStatus } from './enums';
import { AiCreateAppointmentDto } from './dto/ai-create-appointment.dto';

/**
 * Appointments Controller
 *
 * Handles HTTP requests for appointment management
 *
 * Endpoints:
 * - GET /appointments/staff - View all clinic appointments without extra_hour (Staff only)
 * - GET /appointments/staff/extra-hours - View all clinic appointments with extra_hour (Staff only)
 * - GET /appointments/staff/:id/detail - View appointment detail (Staff only)
 * - POST /appointments/staff/create - Staff create appointment with services (Staff only)
 * - PATCH /appointments/staff/:id/cancel - Staff cancel appointment (Staff only)
 * - PATCH /appointments/staff/:id/reschedule - Staff reschedule appointment (Staff only)
 * - PATCH /appointments/staff/:id/assign-to-doctor - Assign appointment to doctor (PENDING → PENDING_DOCTOR) (Staff only)
 * - PATCH /appointments/staff/:id/check-in - Check in patient (Staff only)
 * - GET /appointments/staff/:id/packages - Get payment packages (Staff only)
 * - POST /appointments/staff/:id/packages/:packageId/confirm-cash-payment - Confirm cash payment (Staff only)
 * - POST /appointments - Create new appointment (Patient only)
 * - PATCH /appointments/patient/:id/cancel - Patient cancel their own appointment (Patient only)
 * - PATCH /appointments/:id/accept - Accept appointment (Doctor only)
 * - PATCH /appointments/:id/decline - Decline appointment (Doctor only)
 * - PATCH /appointments/:id/status - Update appointment status (Admin/Staff)
 *
 * Patient Booking Flow (VERSION 4.5):
 * - GET /patients/services - List available services
 * - GET /patients/clinics - Get clinics with available slots (optional working_date filter for Option 3)
 * - GET /patients/clinics/:clinicId/schedules - Get schedules (merged dates + shifts + slots, supports working_date query)
 * - GET /patients/clinics/:clinicId/services - Get clinic services (used by Option 1, 2, and 3)
 * - GET /patients/doctors/:doctorId/schedules - Get doctor schedules
 * - GET /patients/me/appointments - Get patient's appointments
 * - POST /patients/booking-sessions - Create booking session
 * - PATCH /patients/booking-sessions/:sessionId - Update booking session
 * - POST /patients/appointments - Create appointment from session
 */
import { PrescriptionsService } from '../prescriptions/prescriptions.service';
import {
  PatientEPrescriptionDetailResponseDto,
  PatientERMDetailResponseDto,
} from '../prescriptions/dto';

@ApiTags('Appointments')
@Controller('appointments')
export class AppointmentsController {
  constructor(
    private readonly appointmentsService: AppointmentsService,
    private readonly bookingSessionService: BookingSessionService,
    private readonly prescriptionsService: PrescriptionsService,
  ) {}

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
   * Get all appointments with extra_hour for staff's clinic
   *
   * Allows clinic staff to view appointments that have extra_hour
   * with optional filtering by status and date, plus pagination
   *
   * @param req - Request object containing authenticated user
   * @param queryDto - Query parameters for filtering and pagination
   * @returns Paginated list of appointments with extra_hour
   */
  @Get('staff/extra-hours')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.CLINIC_STAFF)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get appointments with extra_hour for staff clinic',
    description:
      'Retrieve appointments with extra_hour from the clinic where the staff member works. Supports filtering by status and date, with pagination.',
  })
  @ApiResponse({
    status: 200,
    description: 'Appointments with extra_hour retrieved successfully',
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
  async getAppointmentsWithExtraHourForStaff(
    @Request() req: any,
    @Query() queryDto: QueryAppointmentDto,
  ): Promise<PaginatedAppointmentResponseDto> {
    const staffAccountId = req.user._id;
    return this.appointmentsService.getAppointmentsWithExtraHourForStaff(
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
  @Get('staff/:id/detail')
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
    summary: "Get doctor's appointments (Step 1 - ERM Flow)",
    description:
      'Retrieve list of appointments assigned to the authenticated doctor. ' +
      'Shows CHECKED_IN and IN_PROGRESS appointments by default. ' +
      'Can filter by specific date and status.',
  })
  @ApiResponse({
    status: 200,
    description: 'Appointments retrieved successfully',
    type: DoctorAppointmentsResponseDto,
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
  ): Promise<DoctorAppointmentsResponseDto> {
    const doctorId = req.user._id;
    return this.appointmentsService.getDoctorAppointments(doctorId, queryDto);
  }

  /**
   * Get pending extra-hour appointments for doctor
   *
   * Retrieves list of appointments that have extra_hour and are in PENDING_DOCTOR or CONFIRMED status.
   * These include appointments waiting for doctor confirmation or already confirmed extra hour appointments.
   *
   * @param req - Request object containing authenticated doctor
   * @returns List of appointments with extra hour in pending or confirmed status
   */
  @Get('doctor/me/extra-hour-pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.DOCTOR)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get appointments with extra hour (PENDING_DOCTOR or CONFIRMED)',
    description:
      'Retrieve list of appointments that have extra_hour and are in PENDING_DOCTOR or CONFIRMED status. ' +
      'Includes both appointments awaiting doctor confirmation and confirmed extra hour appointments.',
  })
  @ApiResponse({
    status: 200,
    description: 'Extra hour pending appointments retrieved successfully',
    type: DoctorAppointmentsResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User is not a doctor',
  })
  async getPendingExtraHourAppointments(
    @Request() req: any,
  ): Promise<DoctorAppointmentsResponseDto> {
    const doctorId = req.user._id;
    return this.appointmentsService.getPendingExtraHourAppointments(doctorId);
  }

  /**
   * Get doctor's patient history
   *
   * Retrieves list of all patients who have been examined by the doctor
   * with summary statistics and last diagnosis
   *
   * @param req - Request object containing authenticated doctor
   * @param queryDto - Query parameters (search, pagination, sorting)
   * @returns Paginated list of patients with visit summary
   */
  @Get('doctor/me/patients')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.DOCTOR)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Get doctor's patient history",
    description:
      'Retrieve list of all patients who have been examined by the authenticated doctor. ' +
      'Includes patient information, visit statistics, and last diagnosis.',
  })
  @ApiResponse({
    status: 200,
    description: 'Patient history retrieved successfully',
    type: DoctorPatientHistoryResponseDto,
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
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of records per page (default: 20)',
    example: 20,
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search by patient name, phone, or email',
    example: 'Nguyễn Văn A',
  })
  @ApiQuery({
    name: 'sort_by',
    required: false,
    enum: ['last_visit_date', 'patient_name', 'total_visits'],
    description: 'Sort by field (default: last_visit_date)',
    example: 'last_visit_date',
  })
  @ApiQuery({
    name: 'order',
    required: false,
    enum: ['ASC', 'DESC'],
    description: 'Sort order (default: DESC)',
    example: 'DESC',
  })
  async getDoctorPatientHistory(
    @Request() req: any,
    @Query() queryDto: DoctorPatientHistoryQueryDto,
  ): Promise<DoctorPatientHistoryResponseDto> {
    const doctorId = req.user._id;
    return this.appointmentsService.getDoctorPatientHistory(doctorId, queryDto);
  }

  /**
   * Get doctor's patient detail with appointment history (Step 2)
   *
   * Retrieves detailed information about a specific patient including personal
   * information, visit statistics, and paginated appointment history.
   *
   * Access Control: Only doctors who have examined this patient (COMPLETED appointments)
   * can view their details. Returns 403 Forbidden otherwise.
   *
   * @param req - Request object containing authenticated doctor
   * @param patientId - UUID of the patient
   * @param queryDto - Query parameters for filtering appointments
   * @returns Patient detail with statistics and appointment history
   */
  @Get('doctor/me/patients/:patient_id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.DOCTOR)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: "Get doctor's patient detail with appointment history",
    description: `
      Retrieves comprehensive patient information for doctors who have examined this patient.
      Includes:
      - Patient personal information with address
      - Visit statistics (first visit, last visit, total visits, services used)
      - Paginated appointment history with services and diagnosis
      - Filtering by appointment status and date range
      
      Access Control:
      - Only doctors who have COMPLETED appointments with this patient can access
      - Returns 403 Forbidden if doctor has never examined the patient
    `,
  })
  @ApiParam({
    name: 'patient_id',
    type: String,
    description: 'Patient account UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['ALL', 'COMPLETED', 'CANCELLED', 'NO_SHOW'],
    description: 'Filter by appointment status (default: ALL)',
    example: 'COMPLETED',
  })
  @ApiQuery({
    name: 'from_date',
    required: false,
    type: Date,
    description: 'Filter appointments from this date (YYYY-MM-DD)',
    example: '2024-01-01',
  })
  @ApiQuery({
    name: 'to_date',
    required: false,
    type: Date,
    description: 'Filter appointments until this date (YYYY-MM-DD)',
    example: '2024-12-31',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number for appointment history (default: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of appointments per page (default: 10)',
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: 'Patient detail retrieved successfully',
    schema: {
      example: {
        patient: {
          patient_id: '123e4567-e89b-12d3-a456-426614174000',
          full_name: 'Nguyễn Văn A',
          phone: '0901234567',
          email: 'patient@example.com',
          gender: 'male',
          date_of_birth: '1990-05-15',
          age: 34,
          address: '123 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM',
        },
        statistics: {
          first_visit: '2023-06-15',
          last_visit: '2024-01-20',
          total_visits: 5,
          services_used: 3,
        },
        appointment_history: {
          total: 5,
          page: 1,
          limit: 10,
          appointments: [
            {
              appointment_id: '456e4567-e89b-12d3-a456-426614174000',
              appointment_date: '2024-01-20',
              appointment_hour: '2024-01-20T09:00:00Z',
              status: 'COMPLETED',
              services: [
                {
                  service_name: 'Khám tổng quát',
                  service_type: 'general',
                },
              ],
            },
          ],
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Doctor has never examined this patient',
  })
  @ApiResponse({
    status: 404,
    description: 'Patient not found',
  })
  async getDoctorPatientDetail(
    @Request() req: any,
    @Param('patient_id') patientId: string,
    @Query() queryDto: DoctorPatientAppointmentsQueryDto,
  ): Promise<DoctorPatientDetailResponseDto> {
    const doctorId = req.user._id;
    return this.appointmentsService.getDoctorPatientDetail(
      doctorId,
      patientId,
      queryDto,
    );
  }

  /**
   * Get doctor's appointment history detail (Step 3)
   *
   * Retrieves complete appointment information including:
   * - Patient and doctor details with full information
   * - Clinic and shift hour information
   * - All services with pricing (price, discount) and ERM status
   * - Clinic rooms assignment
   * - Payment package details
   * - All ERMs created
   * - Prescription with medicines (if exists)
   *
   * @param req - Request object containing authenticated doctor
   * @param appointmentId - UUID of the appointment
   * @returns Complete appointment detail including ERMs and prescription
   */
  @Get('doctor/me/appointments/:appointment_id/history')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.DOCTOR)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get complete appointment detail from patient history',
    description: `
      Retrieves comprehensive appointment information for doctor's patient history view.
      
      Includes:
      - Patient personal information with profile image and addresses
      - Doctor information with academic degree and position  
      - Clinic details and shift hour information
      - All services with price, discount, and ERM status
      - Clinic rooms where doctor works
      - Payment package with transaction details
      - All ERMs (bệnh án) created during appointment
      - Complete prescription with medicines list (if exists)
      
      Access Control:
      - Only the doctor who owns this appointment can access
      - Returns 403 Forbidden if appointment belongs to another doctor
    `,
  })
  @ApiParam({
    name: 'appointment_id',
    type: String,
    description: 'Appointment UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Appointment detail retrieved successfully',
    type: DoctorAppointmentHistoryDetailResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Appointment belongs to another doctor',
  })
  @ApiResponse({
    status: 404,
    description: 'Appointment not found',
  })
  async getDoctorAppointmentHistoryDetail(
    @Request() req: any,
    @Param('appointment_id') appointmentId: string,
  ): Promise<DoctorAppointmentHistoryDetailResponseDto> {
    const doctorId = req.user._id;
    return this.appointmentsService.getDoctorAppointmentHistoryDetail(
      doctorId,
      appointmentId,
    );
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
    summary:
      'Get appointment detail with auto-status update (Step 2 - ERM Flow)',
    description:
      'Retrieve complete appointment information including patient profile, ' +
      'medical history, and all services with ERM status. ' +
      'Automatically updates appointment status from CHECKED_IN to IN_PROGRESS ' +
      'when doctor first accesses the appointment.',
  })
  @ApiResponse({
    status: 200,
    description: 'Appointment details retrieved successfully',
    type: AppointmentResponseDto,
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
  ): Promise<AppointmentResponseDto> {
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
        appointmentId: {
          type: 'string',
          example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        },
        appointmentStatus: {
          type: 'string',
          enum: ['COMPLETED', 'AWAITING_PAYMENT'],
          example: 'COMPLETED',
        },
        paymentStatus: {
          type: 'string',
          enum: ['PAID', 'UNPAID', 'PARTIAL'],
          example: 'PAID',
        },
        completedAt: {
          type: 'string',
          format: 'date-time',
          example: '2026-02-25T10:30:00Z',
        },
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
        nextStep: {
          type: 'string',
          enum: ['EXPORT_PRESCRIPTION', 'PROCEED_TO_PAYMENT'],
          example: 'EXPORT_PRESCRIPTION',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad Request - Validation failed (missing ERMs, DRAFT ERMs, or missing prescription)',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Cannot complete examination' },
        missingRequirements: {
          type: 'array',
          items: { type: 'string' },
          example: [
            'Service (ID: xxx) does not have ERM',
            'E-prescription not created (required when there is consultation ERM)',
          ],
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
    summary:
      'Add additional service to appointment (ERM Flow - Additional Service)',
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
        serviceType: {
          type: 'string',
          enum: [
            'CONSULTATION',
            'XRAY',
            'ULTRASOUND',
            'LAB',
            'BONE_DENSITY',
            'PROCEDURE',
          ],
          example: 'XRAY',
        },
        price: { type: 'number', example: 200000 },
        discount: {
          type: 'number',
          example: 10,
          description: 'Discount percentage (%)',
        },
        amount: {
          type: 'number',
          example: 180000,
          description: 'Final amount after discount',
        },
        addedDuringExamination: { type: 'boolean', example: true },
        addedBy: { type: 'string', example: 'doctor-uuid' },
        createdAt: {
          type: 'string',
          format: 'date-time',
          example: '2026-03-02T10:30:00Z',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad Request - Invalid status, service already exists, or validation failed',
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
   * Staff cancel an appointment
   *
   * Allows staff to cancel appointments on behalf of patients
   *
   * @param id - Appointment UUID
   * @param cancelDto - Cancellation data (optional patient note)
   * @returns Updated appointment details
   */
  @Patch('staff/:id/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.CLINIC_STAFF)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Staff cancel appointment',
    description:
      'Cancel an appointment  as clinic staff. Optional patient note can be added.',
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
  async staffCancelAppointment(
    @Param('id') id: string,
    @Body() cancelDto: StaffCancelAppointmentDto,
  ): Promise<AppointmentResponseDto> {
    return this.appointmentsService.staffCancelAppointment(id, cancelDto);
  }

  /**
   * Patient cancel their own appointment
   *
   * Allows patients to cancel their own appointments
   *
   * @param req - Request object containing authenticated user
   * @param id - Appointment UUID
   * @param cancelDto - Cancellation data (optional patient note)
   * @returns Updated appointment details
   */
  @Patch('patient/:id/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.PATIENT)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Patient cancel appointment',
    description:
      'Cancel own appointment as patient. Optional note about cancellation can be added.',
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
    description: 'Forbidden - User is not the patient of this appointment',
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
  async patientCancelAppointment(
    @Request() req: any,
    @Param('id') id: string,
    @Body() cancelDto: PatientCancelAppointmentDto,
  ): Promise<AppointmentResponseDto> {
    const patientId = req.user._id;
    return this.appointmentsService.patientCancelAppointment(
      id,
      patientId,
      cancelDto,
    );
  }

  /**
   * Staff reschedule an appointment
   *
   * Allows staff to reschedule appointments to a new date/time
   * All fields are optional. If clinicShiftHourId is provided, appointment date will be auto-updated.
   *
   * @param id - Appointment UUID
   * @param rescheduleDto - Reschedule data (new date, shift hour, or extra hour)
   * @returns Updated appointment details
   */
  @Patch('staff/:id/reschedule')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.CLINIC_STAFF)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Staff reschedule appointment',
    description:
      'Reschedule an appointment to a new date, shift hour, or extra hour. All fields are optional. If clinicShiftHourId is provided, appointment date will be automatically updated from the shift hour work date.',
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
    description: 'Forbidden - User is not a clinic staff member',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Appointment or shift hour not found',
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
  async staffRescheduleAppointment(
    @Param('id') id: string,
    @Body() rescheduleDto: StaffRescheduleAppointmentDto,
  ): Promise<AppointmentResponseDto> {
    return this.appointmentsService.staffRescheduleAppointment(
      id,
      rescheduleDto,
    );
  }

  /**
   * Staff assign appointment to doctor (PENDING → PENDING_DOCTOR)
   *
   * Moves pending appointments with extra_hour to PENDING_DOCTOR status.
   * This is for out-of-hours appointment requests that need doctor approval.
   *
   * @param id - Appointment UUID
   * @returns Updated appointment details
   */
  @Patch('staff/:id/assign-to-doctor')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.CLINIC_STAFF)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Assign appointment to doctor for approval',
    description:
      'Change appointment status from PENDING to PENDING_DOCTOR. Only for appointments with extra_hour (out-of-hours requests) that require doctor approval.',
  })
  @ApiResponse({
    status: 200,
    description: 'Appointment assigned to doctor successfully',
    type: AppointmentResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad Request - Appointment is not PENDING or does not have extra_hour',
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
  async staffAssignToDoctor(
    @Param('id') id: string,
  ): Promise<AppointmentResponseDto> {
    return this.appointmentsService.staffAssignToDoctor(id);
  }

  /**
   * Check in patient for appointment
   *
   * Allows clinic staff to check in a patient when they arrive at the clinic
   * Changes appointment status from PENDING or CONFIRMED to CHECKED_IN
   *
   * @param id - Appointment UUID
   * @returns Updated appointment details
   */
  @Patch('staff/:id/check-in')
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
  ): Promise<AppointmentResponseDto> {
    return this.appointmentsService.checkInPatient(id);
  }

  /**
   * Accept extra-hour appointment (Doctor only)
   *
   * Allows doctor to accept an extra-hour appointment
   * Changes appointment status from PENDING_DOCTOR to CONFIRMED
   * Only works for appointments with extra_hour set
   *
   * @param req - Request object containing authenticated doctor
   * @param id - Appointment UUID
   * @param acceptDto - Empty DTO (endpoint does not require body)
   * @returns Updated appointment details
   */
  @Patch(':id/accept')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.DOCTOR)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Accept extra-hour appointment (Doctor only)',
    description:
      'Doctor accepts an extra-hour appointment. Changes status from PENDING_DOCTOR to CONFIRMED. ' +
      'Only works for appointments with extra_hour set.',
  })
  @ApiResponse({
    status: 200,
    description: 'Extra-hour appointment accepted successfully',
    type: AppointmentResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad Request - Appointment has no extra_hour or status is not PENDING_DOCTOR',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description:
      'Forbidden - User is not a doctor or appointment not assigned to this doctor',
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
    const doctorId = req.user._id;
    return this.appointmentsService.acceptAppointment(id, doctorId, acceptDto);
  }

  /**
   * Decline extra-hour appointment (Doctor only)
   *
   * Allows doctor to decline an extra-hour appointment
   * Changes appointment status to CANCELLED with reject reason
   * Only works for appointments with extra_hour set
   *
   * @param req - Request object containing authenticated doctor
   * @param id - Appointment UUID
   * @param declineDto - Reject reason (required)
   * @returns Updated appointment details
   */
  @Patch(':id/decline')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.DOCTOR)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Decline extra-hour appointment (Doctor only)',
    description:
      'Doctor declines an extra-hour appointment. Changes status to CANCELLED with reject reason. ' +
      'Only works for appointments with extra_hour set.',
  })
  @ApiResponse({
    status: 200,
    description: 'Extra-hour appointment declined successfully',
    type: AppointmentResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad Request - Appointment has no extra_hour or status is not PENDING_DOCTOR',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description:
      'Forbidden - User is not a doctor or appointment not assigned to this doctor',
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
    const doctorId = req.user._id;
    return this.appointmentsService.declineAppointment(
      id,
      doctorId,
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
  @Roles(
    AccountRole.ADMIN,
    AccountRole.CLINIC_STAFF,
    AccountRole.CLINIC_MANAGER,
  )
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
  @Roles(
    AccountRole.DOCTOR,
    AccountRole.CLINIC_ADMIN,
    AccountRole.CLINIC_MANAGER,
  )
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get doctor work history',
    description:
      'Get paginated work history including revenue calculation. Managers/Admins can only view doctors in their clinic.',
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
  @Roles(
    AccountRole.DOCTOR,
    AccountRole.CLINIC_ADMIN,
    AccountRole.CLINIC_MANAGER,
  )
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
    const csvContent =
      await this.appointmentsService.exportDoctorWorkHistoryCSV(
        req.user.accountId || req.user._id,
        doctorId,
        queryDto,
      );

    res.header('Content-Type', 'text/csv');
    res.attachment(`work-history-${doctorId}-${getDateString()}.csv`);

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
   * Get clinic schedules (VERSION 4.5 - Option 1 & Option 3)
   *
   * Gộp 2 API cũ (working-days + slots) thành 1 API duy nhất.
   * Returns nested structure: Dates -> Shifts -> Slots with Doctor info.
   *
   * VERSION 4.5: Thêm query parameter working_date
   * - Nếu có working_date: Trả về lịch của ngày cụ thể (Option 3)
   * - Nếu không có working_date: Trả về lịch 60 ngày tới (Option 1)
   *
   * @param clinicId - Clinic UUID
   * @param workingDate - Optional date filter (YYYY-MM-DD)
   * @returns Nested schedule structure
   */
  @Get('patients/clinics/:clinicId/schedules')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.PATIENT)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get clinic schedules (Patient) - VERSION 4.5',
    description:
      'Get all available schedules for a clinic in nested structure: Dates -> Shifts -> Slots. Supports optional working_date query parameter for filtering by specific date.',
  })
  @ApiResponse({
    status: 200,
    description: 'Schedules retrieved successfully',
    schema: {
      example: {
        data: [
          {
            date: '2026-03-09',
            week_day: 'Monday',
            shifts: [
              {
                shift: 'MORNING',
                slots: [
                  {
                    clinic_shift_hour_id: 'uuid',
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
          {
            date: '2026-03-10',
            week_day: 'Tuesday',
            shifts: [
              {
                shift: 'MORNING',
                slots: [
                  {
                    clinic_shift_hour_id: 'uuid2',
                    doctor_id: 'uuid2',
                    doctor_name: 'BS. Trần Thị B',
                    doctor_specialty: 'Bác sĩ Tim Mạch',
                    start_time: '09:00:00',
                    end_time: '09:30:00',
                    limit: 4,
                    available_slots: 4,
                    clinic_room: 'Phòng 102',
                  },
                ],
              },
            ],
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
    name: 'working_date',
    required: false,
    type: String,
    description: 'Filter by specific date (YYYY-MM-DD, optional)',
  })
  async getClinicSchedules(
    @Param('clinicId', ParseUUIDPipe) clinicId: string,
    @Query('working_date') workingDate?: string,
  ) {
    return this.appointmentsService.getClinicSchedules(clinicId, workingDate);
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
            status: 'COMPLETED',
            total: 270000,
            services: [
              {
                service_id: '550e8400-e29b-41d4-a716-446655440003',
                service_name: 'Khám Xương Khớp',
                price: 270000,
              },
            ],
            feedbacks: [
              {
                id: '550e8400-e29b-41d4-a716-446655440004',
                rating: 5,
                description: 'Bác sĩ rất tận tâm',
                type: 'DOCTOR',
                createdAt: '2026-03-16T10:00:00.000Z',
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
    description:
      'Filter by tab: UPCOMING (active future appointments) or HISTORY (completed/past appointments)',
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
   * Get Patient E-Prescription Detail
   * Patient only - nested under appointment route
   *
   * Retrieves electronic prescription for a specific appointment
   * Only accessible when appointment status is COMPLETED
   */
  @Get('patients/me/appointments/:id/e-prescription')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.PATIENT)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get E-Prescription for a specific appointment',
    description:
      'Retrieves the electronic prescription details including all prescribed medicines. Only available for completed appointments.',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'Appointment ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'E-Prescription retrieved successfully',
    type: PatientEPrescriptionDetailResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Appointment or E-Prescription not found',
  })
  @ApiForbiddenResponse({
    description: 'E-Prescription only available for completed appointments',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  async getPatientEPrescription(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
  ): Promise<PatientEPrescriptionDetailResponseDto> {
    const patientId = req.user._id;
    return await this.prescriptionsService.getPatientEPrescription(
      patientId,
      id,
    );
  }

  /**
   * Export Patient E-Prescription as PDF
   * Patient only - generates downloadable PDF document
   *
   * Exports the electronic prescription in a medical-compliant PDF format
   * with clinic, doctor, and patient information headers
   */
  @Get('patients/me/appointments/:id/e-prescription/export/pdf')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.PATIENT)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Export E-Prescription as PDF',
    description:
      'Downloads the electronic prescription as a professionally formatted PDF document with clinic letterhead, doctor information, and all prescribed medicines. Only available for completed appointments.',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'Appointment ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiProduces('application/pdf')
  @ApiResponse({
    status: 200,
    description: 'PDF file generated and downloaded successfully',
    schema: {
      type: 'string',
      format: 'binary',
    },
  })
  @ApiNotFoundResponse({
    description: 'Appointment or E-Prescription not found',
  })
  @ApiForbiddenResponse({
    description: 'E-Prescription only available for completed appointments',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  async exportEPrescriptionPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
    @Res() res: Response,
  ): Promise<void> {
    const patientId = req.user._id;

    // Generate PDF buffer
    const pdfBuffer = await this.prescriptionsService.generateEPrescriptionPdf(
      patientId,
      id,
    );

    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="prescription-${id}.pdf"`,
    );
    res.setHeader('Content-Length', pdfBuffer.length.toString());

    // Send PDF buffer
    res.send(pdfBuffer);
  }

  /**
   * Get Patient ERMs List
   * Retrieves summary of all ERM records linked to the appointment
   */
  @Get('patients/me/appointments/:id/erms')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.PATIENT)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get ERM records summary for a specific appointment',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'Appointment ID',
  })
  async getPatientERMsList(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
  ) {
    const patientId = req.user._id;
    return this.appointmentsService.getPatientERMsList(patientId, id);
  }

  /**
   * Get Patient ERM Detail (Polymorphic Retrieval)
   * Patient only - retrieves specific ERM record
   *
   * Returns ERM details with polymorphic child data based on record_type
   * Enforces strict 3-layer linkage validation and visibility rules
   */
  @Get('patients/me/appointments/:id/erms/:ermId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.PATIENT)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get ERM record details for a specific appointment',
    description:
      'Retrieves Electronic Record Management (ERM) details including polymorphic child records (X-ray, Lab, Ultrasound, Consultation, Bone Density, Procedure). Only COMPLETED records are accessible to patients. Enforces strict ownership validation (patient -> appointment -> ERM).',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'Appointment ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiParam({
    name: 'ermId',
    type: 'string',
    format: 'uuid',
    description: 'ERM record ID',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @ApiResponse({
    status: 200,
    description: 'ERM record retrieved successfully',
  })
  @ApiNotFoundResponse({
    description: 'Appointment, ERM, or child record not found',
  })
  @ApiForbiddenResponse({
    description: 'ERM record not available (status must be COMPLETED)',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  async getPatientERMDetail(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('ermId', ParseUUIDPipe) ermId: string,
    @Request() req: any,
  ) {
    const patientId = req.user._id;
    return this.appointmentsService.getPatientERMDetail(patientId, id, ermId);
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
    summary: 'Get clinics by working date (Patient) - Nested Structure',
    description:
      'Get list of clinic systems (CLINIC_ADMIN) with their branches (CLINIC_MANAGER). ' +
      'Returns a nested/grouped structure where each clinic system contains its branches. ' +
      'If working_date is provided, returns clinics with slots on that specific date (Option 3: Date-first booking). ' +
      'If working_date is omitted, returns all clinics with any available slots (Option 1 & 2). ' +
      '⚠️ IMPORTANT: Use branch clinic_id (CLINIC_MANAGER._id) for booking, NOT admin_id. ' +
      'Display name format: "Parent Clinic Name - Branch Name". Supports search and district filtering.',
  })
  @ApiResponse({
    status: 200,
    description: 'Clinic systems with branches retrieved successfully',
    schema: {
      example: {
        data: [
          {
            admin_id: 'admin-uuid-1',
            system_name: 'Phòng khám Đa khoa Hoàn Mỹ',
            logo: 'https://example.com/logo.png',
            description: 'Hệ thống phòng khám đa khoa uy tín',
            branches: [
              {
                clinic_id: 'branch-uuid-1', // ⚠️ Use this ID for booking
                branch_name: 'Phòng khám Đa khoa Hoàn Mỹ - Chi nhánh Quận 1',
                address: '123 Đường X, Quận 1, TP.HCM',
                district: 'Quận 1',
                available_slots: 25,
                available_doctors: 5,
              },
              {
                clinic_id: 'branch-uuid-2',
                branch_name: 'Phòng khám Đa khoa Hoàn Mỹ - Chi nhánh Quận 2',
                address: '456 Đường Y, Quận 2, TP.HCM',
                district: 'Quận 2',
                available_slots: 15,
                available_doctors: 3,
              },
            ],
          },
          {
            admin_id: 'admin-uuid-2',
            system_name: 'Phòng khám Đa khoa Medlatec',
            logo: null,
            description: null,
            branches: [
              {
                clinic_id: 'branch-uuid-3',
                branch_name: 'Phòng khám Đa khoa Medlatec - Chi nhánh Quận 3',
                address: '789 Đường Z, Quận 3, TP.HCM',
                district: 'Quận 3',
                available_slots: 10,
                available_doctors: 2,
              },
            ],
          },
        ],
        meta: {
          total_systems: 2,
          total_branches: 3,
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
    required: false,
    type: String,
    description:
      'Optional working date in YYYY-MM-DD format. If provided, filters clinics with slots on this date. If omitted, returns all clinics with any available slots.',
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
    @Query('working_date') workingDate?: string,
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
    description:
      'Bad Request - Invalid initial data or inactive service/clinic',
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
   * - Step 3: Add clinic_shift_hour_id and doctor_id
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
   * VERSION 4.0: Finalize booking by creating appointment from completed session.
   *
   * This endpoint:
   * - Reads session data from Redis
   * - Validates all business rules
   * - Branches based on payment method stored in session:
   *   * COD: Creates appointment immediately with pessimistic locking, deletes session
   *   * ONLINE: Creates payment request (placeholder), keeps session for webhook
   * - Returns appointment data (COD) or payment URL (ONLINE)
   *
   * Payment methods are selected in Step 4 of the booking flow and stored in Redis.
   *
   * @param req - Request object containing authenticated user
   * @param createDto - Session ID (payment method already in session)
   * @returns Created appointment details (COD) or payment URL (ONLINE)
   */
  @Post('patients/appointments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.PATIENT)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create appointment from session (Patient)',
    description:
      'Finalize booking by creating appointment from completed session. Payment method (COD/ONLINE) is already stored in session from Step 4. Session will be deleted after successful COD creation, or kept for ONLINE payment webhook processing.',
  })
  @ApiResponse({
    status: 201,
    description:
      'Appointment created successfully (COD) or payment initiated (ONLINE)',
    schema: {
      oneOf: [
        {
          // COD Response
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
              payment_type: 'cod',
            },
          },
        },
        {
          // ONLINE Response (Placeholder)
          example: {
            message: 'Vui lòng thanh toán để hoàn tất đặt lịch',
            data: {
              payment_url:
                'https://sandbox.payment-gateway.com/pay?order_id=xyz',
              payment_reference_id: 'uuid',
              amount: 270000,
              expires_at: '2026-03-07T15:30:00.000Z',
            },
          },
        },
      ],
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad Request - Incomplete session, slot full, or invalid payment method',
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
    );

    // Return result directly - it's either appointment data (COD) or payment URL (ONLINE)
    // The result already includes appropriate message from service layer
    return result.message
      ? result
      : {
          message: 'Đặt lịch hẹn thành công',
          data: result,
        };
  }

  @Post('patients/appointments/:sessionId/payment-qr')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.PATIENT)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Lấy mã QR thanh toán từ Redis session (Patient)',
    description:
      'Tạo mã QR Seepay từ thông tin booking session đang lưu trên Redis. ' +
      'Chỉ dùng cho phương thức thanh toán ONLINE. ' +
      'sessionId phải thuộc về bệnh nhân đang đăng nhập. ' +
      'Dữ liệu appointment chỉ được ghi vào DB sau khi Seepay callback xác nhận thanh toán thành công.',
  })
  @ApiParam({
    name: 'sessionId',
    description: 'Session ID nhận được từ bước tạo booking session (step 4/updateBookingSession)',
    type: String,
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Mã QR được tạo thành công',
    schema: {
      example: {
        message: 'Vui lòng thanh toán để hoàn tất đặt lịch',
        data: {
          qr_code_url: 'https://qr.sepay.vn/img?acc=...&bank=...&amount=270000&des=sessionId',
          qr_payload: '{"acc":"...","bank":"...","amount":270000,"des":"sessionId"}',
          session_id: '123e4567-e89b-12d3-a456-426614174000',
          amount: 270000,
          currency: 'VND',
          expires_at: '2026-03-10T14:45:00.000Z',
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Session không phải thanh toán online hoặc đã hết hạn' })
  @ApiResponse({ status: 403, description: 'Session không thuộc về bệnh nhân này' })
  @ApiResponse({ status: 404, description: 'Session không tồn tại' })
  async getOnlinePaymentQr(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Request() req: any,
  ): Promise<any> {
    const patientId = req.user._id;
    return this.appointmentsService.getOnlinePaymentQr(sessionId, patientId);
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
   * Get doctor schedules (VERSION 4.4 - Option 2: Doctor-first - Step 2)
   *
   * TÁCH RỜI LỊCH KHÁM VÀ DỊCH VỤ
   * API này CHỈ trả về lịch khám (nested structure).
   * KHÔNG trả về services - services được lấy từ endpoint riêng.
   *
   * @param doctorId - Doctor UUID
   * @param clinicId - Clinic UUID (REQUIRED)
   * @returns Nested schedule structure only (no services)
   */
  @Get('patients/doctors/:doctorId/schedules')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.PATIENT)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get doctor schedules (Patient) - VERSION 4.4',
    description:
      'Get all available schedules for a doctor in nested structure: Dates -> Shifts -> Slots. Does NOT include services (use separate /services endpoint).',
  })
  @ApiResponse({
    status: 200,
    description: 'Schedules retrieved successfully',
    schema: {
      example: {
        data: [
          {
            date: '2026-03-09',
            week_day: 'Monday',
            shifts: [
              {
                shift: 'MORNING',
                slots: [
                  {
                    clinic_shift_hour_id: 'uuid',
                    start_time: '08:00:00',
                    end_time: '08:30:00',
                    limit: 5,
                    available_slots: 3,
                    clinic_room: 'Phòng 101',
                  },
                ],
              },
            ],
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
    required: true,
    type: String,
    description: 'Clinic UUID (required)',
  })
  async getDoctorSchedules(
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
    @Query('clinic_id', ParseUUIDPipe) clinicId: string,
  ) {
    return this.appointmentsService.getDoctorSchedules(doctorId, clinicId);
  }

  /**
   * Get all payment packages for an appointment (Clinic Staff)
   *
   * Returns list of all payment packages associated with the appointment,
   * including their services and payment status.
   */
  @Get('staff/:id/packages')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.CLINIC_STAFF)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get all payment packages for appointment (Clinic Staff)',
    description:
      'Returns list of all payment packages with their services and payment status for the specified appointment.',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment packages retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        appointmentId: {
          type: 'string',
          example: '550e8400-e29b-41d4-a716-446655440000',
        },
        packages: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              packageId: { type: 'string' },
              appointmentId: { type: 'string' },
              paymentTransactionId: { type: 'string', nullable: true },
              amount: { type: 'number' },
              status: { type: 'string', enum: ['pending_payment', 'paid'] },
              paymentType: {
                type: 'string',
                enum: ['online', 'cod'],
                nullable: true,
              },
              services: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    serviceAppointmentId: { type: 'string' },
                    clinicServiceId: { type: 'string' },
                    serviceName: { type: 'string' },
                    servicePrice: { type: 'number' },
                  },
                },
              },
            },
          },
        },
        summary: {
          type: 'object',
          properties: {
            totalPackages: { type: 'number' },
            totalAmount: { type: 'number' },
            paidAmount: { type: 'number' },
            pendingAmount: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Appointment not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Staff does not belong to the clinic of this appointment',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Appointment UUID',
  })
  async getAppointmentPackages(
    @Param('id', ParseUUIDPipe) appointmentId: string,
    @Request() req: any,
  ) {
    const staffAccountId = req.user._id;
    return this.appointmentsService.getAppointmentPackages(
      appointmentId,
      staffAccountId,
    );
  }

  /**
   * Confirm cash payment for a specific package (Clinic Staff)
   *
   * Updates a specific payment package status to PAID with payment type COD.
   * If all packages are paid, the appointment status will be updated to COMPLETED.
   */
  @Post('staff/:id/packages/:packageId/confirm-cash-payment')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.CLINIC_STAFF)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirm cash payment for specific package (Clinic Staff)',
    description:
      'Confirms cash payment for a specific package. Updates package status to PAID and payment type to COD. If all packages are paid, appointment status becomes COMPLETED.',
  })
  @ApiResponse({
    status: 200,
    description: 'Cash payment confirmed successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Xác nhận thanh toán tiền mặt thành công',
        },
        appointmentId: { type: 'string' },
        package: {
          type: 'object',
          properties: {
            packageId: { type: 'string' },
            amount: { type: 'number' },
            status: { type: 'string', enum: ['paid'] },
            paymentType: { type: 'string', enum: ['cod'] },
            paymentTransactionId: { type: 'null' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        appointmentStatus: {
          type: 'string',
          enum: ['in_progress', 'need_final_payment', 'completed'],
        },
        allPackagesPaid: { type: 'boolean' },
        remainingPendingPackages: { type: 'number' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Package or appointment not found',
  })
  @ApiResponse({
    status: 400,
    description:
      'Package is not in PENDING_PAYMENT status or does not belong to this appointment',
  })
  @ApiResponse({
    status: 403,
    description: 'Staff does not belong to the clinic of this appointment',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Appointment UUID',
  })
  @ApiParam({
    name: 'packageId',
    type: String,
    description: 'Payment Package UUID',
  })
  async confirmCashPayment(
    @Param('id', ParseUUIDPipe) appointmentId: string,
    @Param('packageId', ParseUUIDPipe) packageId: string,
    @Request() req: any,
  ) {
    const staffAccountId = req.user._id;
    return this.appointmentsService.confirmCashPayment(
      appointmentId,
      packageId,
      staffAccountId,
    );
  }

  /**
   * Get available doctors for out-of-hours booking (Option 4)
   *
   * Returns list of doctors who are working at the clinic on the specified date
   * and are NOT busy at the requested extra hour time.
   *
   * @param clinicId - Clinic UUID
   * @param appointmentDate - Appointment date (YYYY-MM-DD)
   * @param extraHour - Extra hour timestamp (ISO 8601 with timezone)
   * @returns List of available doctors with metadata
   */
  @Get('clinics/:clinicId/available-doctors')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get available doctors for out-of-hours booking (Option 4)',
    description:
      'Returns list of doctors who are scheduled to work at the clinic on the specified date ' +
      'and are NOT busy at the requested time. ' +
      'Checks against both appointment_hour and extra_hour to avoid double booking.',
  })
  @ApiResponse({
    status: 200,
    description: 'Available doctors retrieved successfully',
    type: AvailableDoctorsResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid parameters',
  })
  @ApiParam({
    name: 'clinicId',
    type: String,
    description: 'Clinic UUID',
    example: '550e8400-e29b-41d4-a716-446655440010',
  })
  @ApiQuery({
    name: 'appointment_date',
    type: String,
    description: 'Appointment date in YYYY-MM-DD format',
    example: '2026-03-15',
  })
  @ApiQuery({
    name: 'extra_hour',
    type: String,
    description: 'Extra hour timestamp in ISO 8601 format with timezone',
    example: '2026-03-15T14:30:00+07:00',
  })
  async getAvailableDoctorsForOutOfHours(
    @Param('clinicId', ParseUUIDPipe) clinicId: string,
    @Query('appointment_date') appointmentDate: string,
    @Query('extra_hour') extraHour: string,
  ): Promise<AvailableDoctorsResponseDto> {
    return this.appointmentsService.getAvailableDoctorsForOutOfHours(
      clinicId,
      appointmentDate,
      extraHour,
    );
  }
}
