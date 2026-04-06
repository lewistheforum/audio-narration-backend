import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Patch,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiExtraModels,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AccountsService } from './accounts.service';
import { JwtAuthGuard } from '../auth/jwt.strategy';

import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  UpdateAccountDto,
  AccountResponseDto,
  UpdatePasswordDto,
  BanAccountDto,
  UpdateClinicAdminProfileDto,
  PublicDoctorDetailResponseDto,
  PublicDoctorDetailData,
  PublicDoctorWorkingSchedulesResponseDto,
  PublicDoctorInfo,
  PublicClinicInfo,
  CancelRegistrationResponseDto,
  CancelSubscriptionDto,
  CancelSubscriptionResponseDto,
  GetStaffListDto,
  GetDoctorListDto,
  StaffListResponseDto,
  DoctorListResponseDto,
  SearchPatientQueryDto,
  PatientSearchResponseDto,
  GetEmployeesByClinicDto,
  UploadLegalDocumentDto,
  UpdateLegalDocumentsDto,
  GetClinicDetailQueryDto,
} from './dto';

import { MESSAGES } from 'src/common/message';
import { ApiResponseData } from 'src/common/decorators/api-response.decorator';
import { AccountRole } from './enums';
import { UsernameEmailListDto } from './dto/username-email-list.dto';
import { ClinicListResponseDto } from './dto/clinic-list-response.dto';
import { ClinicDetailResponseDto } from './dto/clinic-detail-response.dto';

/**
 * Accounts Management Controller
 *
 * RESTful API controller for managing user accounts in the Bonix system.
 * Provides comprehensive CRUD operations and account lifecycle management.
 *
 * Features:
 * - Account retrieval (individual and bulk)
 * - Profile updates
 * - Password management
 * - Account soft delete and restoration
 * - Account banning and unbanning (admin)
 * - Username/email availability checking
 *
 * Security:
 * - All endpoints require JWT authentication
 * - Role-based access control via RolesGuard
 * - Admin-only operations clearly marked
 *
 * Note on Account Creation:
 * - Patient registration is handled by AuthController (public endpoint)
 * - OAuth registration is handled by AuthController
 * - This controller focuses on account management post-creation
 *
 * @controller
 * @tags Accounts management
 */
@ApiTags('Accounts management')
@Controller('accounts')
@ApiExtraModels(
  AccountResponseDto,
  ClinicListResponseDto,
  ClinicDetailResponseDto,
  UpdateClinicAdminProfileDto,
  PublicDoctorDetailResponseDto,
  PublicDoctorDetailData,
  PublicDoctorWorkingSchedulesResponseDto,
  PublicDoctorInfo,
  PublicClinicInfo,
  PatientSearchResponseDto,
)
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post(':id/keys/generate')
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(AccountRole.ADMIN, AccountRole.CLINIC_STAFF, AccountRole.DOCTOR) // Restrict who can generate keys if needed, or keep public if for dev
  // @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Generate digital signature keys for an account' })
  @ApiResponse({ status: 201, description: 'Keys generated successfully' })
  async generateKeys(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.accountsService.generateUserKeys(id);
    return {
      message: 'Digital signature keys generated successfully',
      data,
    };
  }

  /**
   * Get All Accounts (Admin Only)
   *
   * Retrieves a comprehensive list of all registered accounts in the system.
   * Supports optional inclusion of soft-deleted accounts for audit purposes.
   *
   * Query Parameters:
   * - includeDeleted: Set to 'true' to include soft-deleted accounts
   *
   * Response Format:
   * - Returns array of AccountResponseDto objects
   * - Sensitive data (passwords, tokens) are excluded
   * - Combines Account and GeneralAccount data
   *
   * Access Control:
   * - Requires ADMIN role
   * - Requires valid JWT authentication
   *
   * Use Cases:
   * - Admin dashboard user management
   * - User analytics and reporting
   * - Audit trails and compliance
   *
   * @param {string} [includeDeleted] - Query parameter to include soft-deleted accounts ('true'/'false')
   * @returns {Promise<{data: AccountResponseDto[], message: string}>} List of all accounts
   *
   * @swagger
   * @security JWT-auth
   * @response 200 - Successfully retrieved accounts
   * @response 401 - Unauthorized - Missing or invalid JWT token
   * @response 403 - Forbidden - Requires ADMIN role
   */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(AccountRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get all accounts (Admin only)' })
  @ApiQuery({
    name: 'includeDeleted',
    required: false,
    type: Boolean,
    description: 'Include soft-deleted accounts in results',
  })
  @ApiResponseData({
    type: AccountResponseDto,
    status: MESSAGES.statusCode.success,
    message: MESSAGES.successMessage.userFetchSuccess,
    isArray: true,
  })
  async findAll(
    @Query('includeDeleted') includeDeleted?: string,
  ): Promise<{ data: AccountResponseDto[]; message: string }> {
    const shouldIncludeDeleted = includeDeleted === 'true';
    const accounts = await this.accountsService.findAll(shouldIncludeDeleted);
    return {
      data: accounts,
      message: MESSAGES.successMessage.userFetchSuccess,
    };
  }

  /**
   * Get Username and Email List (Public)
   *
   * Retrieves comprehensive lists of all registered usernames and emails.
   * Useful for client-side validation during registration to check availability.
   *
   * Response Format:
   * - username: Array of all usernames in the system
   * - email: Array of all email addresses in the system
   *
   * Access Control:
   * - Public endpoint (no authentication required)
   * - Consider rate limiting in production
   *
   * Use Cases:
   * - Real-time username availability checking during registration
   * - Email duplicate prevention on client side
   * - Admin reporting and analytics
   *
   * Security Considerations:
   * - Exposes all usernames and emails (consider implications)
   * - May want to restrict to authenticated users in production
   * - Implement rate limiting to prevent scraping
   *
   * @returns {Promise<{data: UsernameEmailListDto, message: string}>} Lists of usernames and emails
   *
   * @swagger
   * @response 200 - Successfully retrieved username/email lists
   */
  @Get('username-email-list')
  @ApiOperation({ summary: 'Get full list of usernames and emails (Public)' })
  @ApiResponseData({
    type: UsernameEmailListDto,
    status: MESSAGES.statusCode.success,
    message: MESSAGES.successMessage.userFetchSuccess,
  })
  async getUsernameEmailList() {
    const data = await this.accountsService.getUsernamesAndEmails();
    return {
      message: 'Successfully retrieved the list of usernames and emails',
      data,
    };
  }

  /**
   * Get All Clinics Manager (Admin)
   *
   * Retrieves a paginated list of all active clinics.
   * Only returns accounts with role: CLINIC_MANAGER and status: ACTIVE
   * Excludes soft-deleted records (deletedAt is null)
   *
   * Query Parameters:
   * - page: Page number (default: 1)
   * - limit: Items per page (default: 10)
   *
   * Response Format:
   * - Returns ClinicListResponseDto with clinics array and pagination metadata
   * - Combines data from accounts + clinic_manager_information + addresses tables
   *
   * Access Control:
   * - Admin endpoint (authentication required)
   *
   * Use Cases:
   * - Clinic directory listing
   * - Clinic search results
   * - Clinic browsing
   *
   * @param {number} page - Page number
   * @param {number} limit - Items per page
   * @returns {Promise<{data: ClinicListResponseDto, message: string}>} Clinics with pagination
   *
   * @swagger
   * @response 200 - Successfully retrieved clinics
   */
  @Get('clinics')
  @ApiOperation({
    summary: 'Get all clinics with pagination, search and filters',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 10)',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description:
      'Search keyword to match clinic name or description (case-insensitive)',
  })
  @ApiQuery({
    name: 'province',
    required: false,
    type: String,
    description: 'Filter clinics by province name or code',
  })
  @ApiQuery({
    name: 'specialty',
    required: false,
    type: String,
    description: 'Filter clinics by medical specialization',
  })
  @ApiResponseData({
    type: ClinicListResponseDto,
    status: MESSAGES.statusCode.success,
    message: 'Clinics retrieved successfully',
  })
  async getAllClinicsManager(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('search') search?: string,
    @Query('province') province?: string,
    @Query('specialty') specialty?: string,
  ): Promise<{ data: ClinicListResponseDto; message: string }> {
    const result = await this.accountsService.findAllClinicsManager(
      page,
      limit,
      search,
      province,
      specialty,
    );
    return {
      data: result,
      message: 'Clinics retrieved successfully',
    };
  }

  /**
   * Get All Clinics Admin (Admin)
   *
   * Retrieves a paginated list of all active clinics.
   * Only returns accounts with role: CLINIC_MANAGER and status: ACTIVE
   * Excludes soft-deleted records (deletedAt is null)
   *
   * Query Parameters:
   * - page: Page number (default: 1)
   * - limit: Items per page (default: 10)
   *
   * Response Format:
   * - Returns ClinicListResponseDto with clinics array and pagination metadata
   * - Combines data from accounts + clinic_manager_information + addresses tables
   *
   * Access Control:
   * - Public endpoint (no authentication required)
   *
   * Use Cases:
   * - Clinic directory listing
   * - Clinic search results
   * - Clinic browsing
   *
   * @param {number} page - Page number
   * @param {number} limit - Items per page
   * @returns {Promise<{data: ClinicListResponseDto, message: string}>} Clinics with pagination
   *
   * @swagger
   * @response 200 - Successfully retrieved clinics
   */
  @Get('clinics-admin')
  @ApiOperation({
    summary: 'Get all clinics with pagination, search and filters',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 10)',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description:
      'Search keyword to match clinic name or description (case-insensitive)',
  })
  @ApiQuery({
    name: 'province',
    required: false,
    type: String,
    description: 'Filter clinics by province name or code',
  })
  @ApiQuery({
    name: 'specialty',
    required: false,
    type: String,
    description: 'Filter clinics by medical specialization',
  })
  @ApiResponseData({
    type: ClinicListResponseDto,
    status: MESSAGES.statusCode.success,
    message: 'Clinics retrieved successfully',
  })
  async getAllClinicsAdmin(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('search') search?: string,
    @Query('province') province?: string,
    @Query('specialty') specialty?: string,
  ): Promise<{ data: ClinicListResponseDto; message: string }> {
    const result = await this.accountsService.findAllClinicsAdmin(
      page,
      limit,
      search,
      province,
      specialty,
    );
    return {
      data: result,
      message: 'Clinics retrieved successfully',
    };
  }

  /**
   * Get Clinic Details by ID (Public)
   *
   * Retrieves detailed information for a specific clinic.
   * Includes addresses, doctors, and subscription information.
   *
   * Path Parameters:
   * - id: Clinic account UUID
   *
   * Response Format:
   * - Returns ClinicDetailResponseDto with full clinic details
   * - Includes addresses array with Google maps
   * - Includes doctors array
   * - Includes subscription information
   *
   * Access Control:
   * - Public endpoint (no authentication required)
   *
   * Use Cases:
   * - Clinic profile page
   * - Clinic details view
   * - Booking interface clinic information
   *
   * @param {string} id - Clinic account UUID
   * @returns {Promise<{data: ClinicDetailResponseDto, message: string}>} Full clinic details
   * @throws {NotFoundException} If clinic not found or not active
   *
   * @swagger
   * @response 200 - Successfully retrieved clinic details
   * @response 404 - Clinic not found
   */
  @Get('clinics/:id')
  @ApiOperation({ summary: 'Get clinic details by ID' })
  @ApiQuery({
    name: 'doctorSearch',
    required: false,
    type: String,
    description: 'Search doctors in this clinic by full name or position',
  })
  @ApiResponseData({
    type: ClinicDetailResponseDto,
    status: MESSAGES.statusCode.success,
    message: 'Clinic details retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Clinic not found' })
  async getClinicById(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: GetClinicDetailQueryDto,
  ): Promise<{ data: ClinicDetailResponseDto; message: string }> {
    const clinic = await this.accountsService.findClinicById(
      id,
      query.doctorSearch,
    );
    return {
      data: clinic,
      message: 'Clinic details retrieved successfully',
    };
  }

  /**
   * Get Doctor Details by ID (Public)
   *
   * Retrieves detailed information for a specific doctor.
   * Includes account info, doctor profile, and clinic information.
   *
   * Security Controls:
   * - Only returns doctors with role='DOCTOR' and status='ACTIVE'
   * - Excludes soft-deleted records
   * - Uses allowlist approach for encrypted fields:
   *   - professional_license (allowed)
   *   - certificate_practical_training (allowed)
   *   - medical_license (allowed)
   * - identity_number, place_identity_card, identity_date (excluded)
   * - bank_number, bank_name, bank_branch (excluded)
   *
   * Path Parameters:
   * - id: Doctor account UUID
   *
   * Response Format:
   * - Returns PublicDoctorDetailResponseDto with full doctor details
   * - Includes account information (username, email, phone, etc.)
   * - Includes doctor profile (experience, education, etc.)
   * - Includes clinic information (parent clinic)
   *
   * Access Control:
   * - Public endpoint (no authentication required)
   *
   * Use Cases:
   * - Doctor profile page
   * - Doctor details view
   * - Booking interface doctor information
   *
   * @param {string} id - Doctor account UUID
   * @returns {Promise<PublicDoctorDetailResponseDto>} Full doctor details with security controls
   * @throws {NotFoundException} If doctor not found or not eligible
   *
   * @swagger
   * @response 200 - Successfully retrieved doctor details
   * @response 404 - Doctor not found
   */
  @Get('doctors/:id')
  @ApiOperation({ summary: 'Get doctor details by ID' })
  @ApiResponseData({
    type: PublicDoctorDetailData,
    status: MESSAGES.statusCode.success,
    message: 'Doctor details retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Doctor not found' })
  async getDoctorById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PublicDoctorDetailData> {
    return this.accountsService.getPublicDoctorById(id);
  }

  @Get('doctors/doctor-detail-schedule/:id')
  @ApiOperation({ summary: 'Get doctor details by ID' })
  @ApiResponseData({
    type: PublicDoctorWorkingSchedulesResponseDto,
    status: MESSAGES.statusCode.success,
    message: 'Doctor details retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Doctor not found' })
  async getDoctorDetailScheduleById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PublicDoctorWorkingSchedulesResponseDto> {
    const workingSchedules =
      await this.accountsService.getPublicDoctorDetailScheduleById(id);
    return new PublicDoctorWorkingSchedulesResponseDto(workingSchedules);
  }

  @Get('staff')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.CLINIC_MANAGER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: "Get list of staff for the manager's clinic" })
  @ApiResponseData({
    type: StaffListResponseDto,
    status: 200,
    message: 'Staff list retrieved successfully',
  })
  async getStaffList(
    @Request() req: any,
    @Query() query: GetStaffListDto,
  ): Promise<{ data: StaffListResponseDto; message: string }> {
    const managerId = req.user._id;
    const result = await this.accountsService.findAllStaffByManager(
      managerId,
      query.page || 1,
      query.limit || 10,
      query.search,
      undefined,
      query.fromDate,
      query.toDate,
    );
    return {
      data: result,
      message: 'Staff list retrieved successfully',
    };
  }

  @Get('staff/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.CLINIC_MANAGER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get staff details by ID' })
  @ApiResponseData({
    type: AccountResponseDto,
    status: 200,
    message: 'Staff details retrieved successfully',
  })
  async getStaffDetails(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ data: AccountResponseDto; message: string }> {
    const managerId = req.user._id;
    const result = await this.accountsService.findStaffById(id, managerId);
    return {
      data: result,
      message: 'Staff details retrieved successfully',
    };
  }

  @Get('doctors-management')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.CLINIC_MANAGER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: "Get list of doctors for the manager's clinic" })
  @ApiResponseData({
    type: DoctorListResponseDto,
    status: 200,
    message: 'Doctor list retrieved successfully',
  })
  async getDoctorListManagement(
    @Request() req: any,
    @Query() query: GetDoctorListDto,
  ): Promise<{ data: DoctorListResponseDto; message: string }> {
    const managerId = req.user._id;
    const result = await this.accountsService.findAllDoctorsByManager(
      managerId,
      query.page || 1,
      query.limit || 10,
      query.search,
      query.academicDegree,
      query.fromDate,
      query.toDate,
    );
    return {
      data: result,
      message: 'Doctor list retrieved successfully',
    };
  }

  @Get('clinic/:clinicId/employees')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.CLINIC_MANAGER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get employees (doctors/staff) of a specific clinic',
  })
  @ApiResponseData({
    type: AccountResponseDto,
    status: 200,
    message: 'Employees retrieved successfully',
    isArray: true,
  })
  async getEmployeesByClinic(
    @Param('clinicId', ParseUUIDPipe) clinicId: string,
    @Query() query: GetEmployeesByClinicDto,
  ): Promise<{ data: AccountResponseDto[]; message: string }> {
    const result = await this.accountsService.findAllEmployeesByClinic(
      clinicId,
      query,
    );
    return {
      data: result,
      message: 'Employees retrieved successfully',
    };
  }

  /**
   * Get Account by ID
   *
   * Retrieves detailed information for a specific account.
   * All authenticated users can access this endpoint to view account profiles.
   *
   * Path Parameters:
   * - id: Account UUID (validated as UUID format)
   *
   * Response Format:
   * - Returns AccountResponseDto with sensitive data excluded
   * - Includes data from both Account and GeneralAccount entities
   *
   * Access Control:
   * - Requires JWT authentication
   * - Available to all authenticated roles (PATIENT, DOCTOR, CLINIC_STAFF, ADMIN)
   * - Users can view any account profile (consider adding self-only restriction if needed)
   *
   * Use Cases:
   * - Viewing user profiles
   * - Displaying account information in dashboards
   * - Conversation participant details
   *
   * @param {string} id - Account UUID (validated as UUID v4 format)
   * @returns {Promise<{data: AccountResponseDto, message: string}>} Account profile data
   *
   * @swagger
   * @security JWT-auth
   * @response 200 - Successfully retrieved account
   * @response 401 - Unauthorized - Missing or invalid JWT token
   * @response 404 - Account not found
   * @response 400 - Invalid UUID format
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    AccountRole.ADMIN,
    AccountRole.PATIENT,
    AccountRole.DOCTOR,
    AccountRole.CLINIC_STAFF,
    AccountRole.CLINIC_ADMIN,
    AccountRole.CLINIC_MANAGER,
  )
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get account by ID' })
  @ApiResponseData({
    type: AccountResponseDto,
    status: MESSAGES.statusCode.success,
    message: MESSAGES.successMessage.userFetchSuccess,
  })
  @ApiResponse({ status: 404, description: 'Account not found' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ data: AccountResponseDto; message: string }> {
    const account = await this.accountsService.getAccountInformationByRole(id);

    return { data: account, message: MESSAGES.successMessage.userFetchSuccess };
  }

  /**
   * Update Account Profile
   *
   * Updates account profile information including personal details and settings.
   * Supports partial updates - only provided fields are modified.
   *
   * Path Parameters:
   * - id: Account UUID to update
   *
   * Request Body:
   * - username: New username (optional)
   * - email: New email address (optional, PATIENT only, triggers re-verification)
   * - phone: New phone number (optional)
   * - dob: Date of birth (optional)
   * - profilePicture: Profile picture URL (optional)
   * - role: New role (optional, admin only)
   * - fullName: Full name (optional, updates GeneralAccount)
   * - gender: Gender (optional, updates GeneralAccount)
   *
   * Email Change Workflow (PATIENT only):
   * - Only PATIENT role can change their email
   * - Other roles (DOCTOR, CLINIC_STAFF, CLINIC_MANAGER, ADMIN) cannot change email
   * - If email is changed: isEmailVerified = false, status = PENDING
   * - User must manually request verification code via POST /mailer/send-verification-code
   * - User must verify new email to reactivate account
   *
   * Access Control:
   * - Users can update their own profile
   * - Admins can update any profile
   * - Email change: PATIENT only
   * - Role changes require admin privileges (enforce at business logic level)
   *
   * @param {string} id - Account UUID to update
   * @param {UpdateAccountDto} updateAccountDto - Fields to update
   * @returns {Promise<{data: AccountResponseDto, message: string}>} Updated account data
   *
   * @swagger
   * @security JWT-auth
   * @response 200 - Successfully updated account
   * @response 401 - Unauthorized - Missing or invalid JWT token
   * @response 403 - Forbidden - Non-PATIENT trying to change email
   * @response 404 - Account not found
   * @response 409 - Email already exists for another account
   */
  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    AccountRole.ADMIN,
    AccountRole.PATIENT,
    AccountRole.DOCTOR,
    AccountRole.CLINIC_STAFF,
    AccountRole.CLINIC_ADMIN,
    AccountRole.CLINIC_MANAGER,
  )
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update account profile' })
  @HttpCode(HttpStatus.OK)
  @ApiResponseData({
    type: AccountResponseDto,
    status: MESSAGES.statusCode.success,
    message: MESSAGES.successMessage.userUpdateSuccess,
  })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid token',
  })
  @ApiResponse({ status: 404, description: 'Account not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateAccountDto: UpdateAccountDto,
  ): Promise<{ data: AccountResponseDto; message: string }> {
    const { user, emailChanged } = await this.accountsService.update(
      id,
      updateAccountDto,
    );

    // If email changed, inform client to manually request verification code
    if (emailChanged) {
      return {
        data: user,
        message:
          'Email updated successfully. Your account status is now PENDING. Please request verification code via POST /mailer/send-verification-code to verify your new email.',
      };
    }

    return { data: user, message: MESSAGES.successMessage.userUpdateSuccess };
  }

  /**
   * Update Account Password
   *
   * Changes the account password after verifying the current password.
   * Implements secure password change workflow with validation.
   *
   * Path Parameters:
   * - id: Account UUID
   *
   * Request Body:
   * - oldPassword: Current password for verification
   * - newPassword: New password (must meet requirements)
   *
   * Password Requirements (enforced by DTO):
   * - Minimum 6 characters
   * - Maximum 50 characters
   * - Must contain at least one letter
   * - Must contain at least one number
   * - Cannot be the same as old password
   *
   * Security Features:
   * - Requires old password verification
   * - New password cannot match old password
   * - Password is hashed before storage
   *
   * Access Control:
   * - Users can change their own password
   * - Admins can change any password (consider security implications)
   *
   * @param {string} id - Account UUID
   * @param {UpdatePasswordDto} updatePasswordDto - Old and new password
   * @returns {Promise<void>} No content (204) on success
   *
   * @swagger
   * @security JWT-auth
   * @response 204 - Password updated successfully
   * @response 401 - Unauthorized - Incorrect old password or invalid token
   * @response 400 - Validation error - Password requirements not met
   */
  @Patch(':id/password')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    AccountRole.ADMIN,
    AccountRole.PATIENT,
    AccountRole.DOCTOR,
    AccountRole.CLINIC_STAFF,
    AccountRole.CLINIC_ADMIN,
    AccountRole.CLINIC_MANAGER,
  )
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update account password' })
  @ApiResponse({ status: 204, description: 'Password updated successfully' })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Incorrect old password or missing token',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error - Check password requirements',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async updatePassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePasswordDto: UpdatePasswordDto,
  ): Promise<void> {
    await this.accountsService.updatePassword(id, updatePasswordDto);
  }

  /**
   * Encrypt Bank Information
   *
   * Triggers encryption for bank-related fields of an account.
   * Used to migrate existing plain-text data to encrypted format.
   *
   * Path Parameters:
   * - id: Account UUID
   *
   * Access Control:
   * - Requires JWT authentication
   * - Users can encrypt their own data
   * - Admins can encrypt any data
   *
   * @param {string} id - Account UUID
   * @returns {Promise<{message: string}>} Success message
   */
  @Post(':id/encrypt-bank')
  // @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.ADMIN, AccountRole.CLINIC_ADMIN, AccountRole.DOCTOR)
  // @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Encrypt bank information' })
  @ApiResponse({
    status: 200,
    description: 'Bank information encrypted successfully',
  })
  async encryptBank(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    await this.accountsService.encryptBankAccount(id);
    return {
      message: 'Bank information encrypted successfully',
    };
  }

  /**
   * Get Decrypted Bank Information
   *
   * Retrieves the decrypted bank information for an account.
   *
   * Path Parameters:
   * - id: Account UUID
   *
   * Access Control:
   * - Requires JWT authentication
   * - Users can view their own data
   * - Admins can view any data
   *
   * @param {string} id - Account UUID
   * @returns {Promise<any>} Decrypted bank information
   */
  @Get(':id/decrypted-bank')
  // @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.ADMIN, AccountRole.CLINIC_ADMIN, AccountRole.DOCTOR)
  // @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get decrypted bank information' })
  @ApiResponse({
    status: 200,
    description: 'Bank information retrieved successfully',
  })
  async getDecryptedBankInfo(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<any> {
    return this.accountsService.getDecryptedBankInfo(id);
  }

  /**
   * Delete Account (Soft Delete) - Admin Only
   *
   * Performs a soft delete on an account by setting the deletedAt timestamp.
   * The account data is retained in the database for audit and recovery purposes.
   *
   * Path Parameters:
   * - id: Account UUID to delete
   *
   * What Happens:
   * - Account is marked as deleted (deletedAt timestamp set)
   * - GeneralAccount is also soft deleted
   * - Account cannot log in
   * - Data is retained for audit trails
   * - Account can be restored using POST /:id/restore
   *
   * What is NOT Deleted:
   * - Related entities (conversations, messages, prescriptions)
   * - Historical data and associations
   *
   * Access Control:
   * - Admin only operation
   * - Requires ADMIN role
   *
   * Use Cases:
   * - Deactivating problematic accounts
   * - User-requested account removal (reversible)
   * - Compliance with data retention policies
   *
   * @param {string} id - Account UUID to delete
   * @returns {Promise<{message: string}>} Success message
   *
   * @swagger
   * @security JWT-auth
   * @response 200 - Account successfully soft deleted
   * @response 401 - Unauthorized - Missing or invalid JWT token
   * @response 403 - Forbidden - Requires ADMIN role
   * @response 404 - Account not found
   */
  /**
   * Delete Employee (Soft Delete) - Clinic Admin/Manager Only
   *
   * Allows a Clinic Admin or Clinic Manager to soft delete (deactivate) an employee
   * (staff or doctor) belonging to their clinic.
   *
   * @param req The HTTP request object (for extracting the requestor's ID)
   * @param id The UUID of the employee to delete
   */
  @Delete('employees/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.CLINIC_ADMIN, AccountRole.CLINIC_MANAGER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Soft delete clinic employee (Admin/Manager only)' })
  @ApiResponse({
    status: MESSAGES.statusCode.success,
    description: MESSAGES.successMessage.userDeleteSuccess,
  })
  async deleteEmployee(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    const requestorId = req.user._id;
    await this.accountsService.deleteEmployee(id, requestorId);
    return { message: MESSAGES.successMessage.userDeleteSuccess };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Soft delete account (Admin only)' })
  @ApiResponse({
    status: MESSAGES.statusCode.success,
    description: MESSAGES.successMessage.userDeleteSuccess,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid token',
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Requires ADMIN role' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    await this.accountsService.delete(id);
    return { message: MESSAGES.successMessage.userDeleteSuccess };
  }

  /**
   * Restore Soft-Deleted Account - Admin Only
   *
   * Restores a previously soft-deleted account by clearing the deletedAt timestamp.
   * This operation recovers both the Account and GeneralAccount entities.
   *
   * Path Parameters:
   * - id: Account UUID to restore
   *
   * What Happens:
   * - deletedAt timestamp is cleared
   * - Account can log in again
   * - All historical data associations remain intact
   * - Account status remains unchanged (e.g., BAN stays BAN)
   *
   * Requirements:
   * - Account must have been soft deleted (deletedAt is not null)
   * - If account was never deleted, returns 400 Bad Request
   *
   * Access Control:
   * - Admin only operation
   * - Requires ADMIN role
   *
   * Use Cases:
   * - Recovering accidentally deleted accounts
   * - Restoring accounts after policy review
   * - Undoing temporary account removal
   *
   * @param {string} id - Account UUID to restore
   * @returns {Promise<{data: AccountResponseDto, message: string}>} Restored account data
   *
   * @swagger
   * @security JWT-auth
   * @response 200 - Account successfully restored
   * @response 400 - Account is not deleted (cannot restore)
   * @response 401 - Unauthorized - Missing or invalid JWT token
   * @response 403 - Forbidden - Requires ADMIN role
   * @response 404 - Account not found
   */
  @Post(':id/restore')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Restore soft-deleted account (Admin only)' })
  @ApiResponseData({
    type: AccountResponseDto,
    status: MESSAGES.statusCode.success,
    message: MESSAGES.successMessage.userRestoredSuccess,
  })
  @ApiResponse({ status: 400, description: 'Account is not deleted' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  async restore(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ data: AccountResponseDto; message: string }> {
    const account = await this.accountsService.restore(id);
    return {
      data: account,
      message: MESSAGES.successMessage.userRestoredSuccess,
    };
  }

  /**
   * Ban Account - Admin Only
   *
   * Bans an account, preventing login and access to the system.
   * Implements administrative control over account access.
   *
   * Path Parameters:
   * - id: Account UUID to ban
   *
   * Request Body:
   * - reason: Ban reason for audit trail (required)
   *
   * What Happens:
   * - Account status set to BAN
   * - Ban count incremented
   * - Ban reason stored
   * - Active sessions should be invalidated (implement at auth layer)
   * - Account cannot log in
   *
   * Business Rules:
   * - Cannot ban ADMIN role accounts (system protection)
   * - Admin cannot ban themselves (prevents self-lockout)
   * - Cannot ban already banned accounts
   *
   * Access Control:
   * - Admin only operation
   * - Requires ADMIN role
   *
   * Use Cases:
   * - Enforcing terms of service violations
   * - Preventing access for security reasons
   * - Temporary account suspension
   *
   * @param {string} id - Account UUID to ban
   * @param {BanAccountDto} banDto - Ban reason and metadata
   * @param {any} req - Request object containing admin user info
   * @returns {Promise<{data: AccountResponseDto, message: string}>} Banned account data
   *
   * @swagger
   * @security JWT-auth
   * @response 200 - Account successfully banned
   * @response 403 - Cannot ban admin accounts or self
   * @response 404 - Account not found
   * @response 409 - Account already banned
   */
  @Post(':id/ban')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Ban account (Admin only)' })
  @ApiResponseData({
    type: AccountResponseDto,
    status: MESSAGES.statusCode.success,
    message: MESSAGES.successMessage.userBannedSuccess,
  })
  @ApiResponse({
    status: 403,
    description: 'Cannot ban admin accounts or self',
  })
  @ApiResponse({ status: 404, description: 'Account not found' })
  @ApiResponse({ status: 409, description: 'Account already banned' })
  async banAccount(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() banDto: BanAccountDto,
    @Request() req: any,
  ): Promise<{ data: AccountResponseDto; message: string }> {
    const adminId = req.user.userId;
    const account = await this.accountsService.banAccount(id, banDto, adminId);
    return {
      data: account,
      message: MESSAGES.successMessage.userBannedSuccess,
    };
  }

  /**
   * Unban Account - Admin Only
   *
   * Removes ban from an account, restoring access to the system.
   * This operation allows previously banned accounts to log in again.
   *
   * Path Parameters:
   * - id: Account UUID to unban
   *
   * What Happens:
   * - Account status changed from BAN to ACTIVE
   * - Account can log in again
   * - Full system access restored
   * - Ban history preserved (banCounts, banDescription)
   *
   * Requirements:
   * - Account must currently be BAN
   * - If account is not banned, returns 400 Bad Request
   *
   * Access Control:
   * - Admin only operation
   * - Requires ADMIN role
   *
   * Use Cases:
   * - Lifting ban after policy review
   * - Restoring access after temporary suspension
   * - Account rehabilitation
   *
   * @param {string} id - Account UUID to unban
   * @returns {Promise<{data: AccountResponseDto, message: string}>} Unbanned account data
   *
   * @swagger
   * @security JWT-auth
   * @response 200 - Account successfully unbanned
   * @response 400 - Account is not banned
   * @response 401 - Unauthorized - Missing or invalid JWT token
   * @response 403 - Forbidden - Requires ADMIN role
   * @response 404 - Account not found
   */
  @Post(':id/unban')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Unban account (Admin only)' })
  @ApiResponseData({
    type: AccountResponseDto,
    status: MESSAGES.statusCode.success,
    message: MESSAGES.successMessage.userUnbannedSuccess,
  })
  @ApiResponse({ status: 400, description: 'Account is not banned' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  async unbanAccount(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ data: AccountResponseDto; message: string }> {
    const account = await this.accountsService.unbanAccount(id);
    return {
      data: account,
      message: MESSAGES.successMessage.userUnbannedSuccess,
    };
  }

  /**
   * Cancel Pending Registration (Hard Delete)
   *
   * Cancels a pending clinic admin registration by performing a hard delete.
   * This is an irreversible operation that completely removes all registration data.
   *
   * Business Rules:
   * - Only CLINIC_ADMIN role can cancel their registration
   * - Cannot cancel if status is PENDING_APPROVAL (documents under review)
   * - Cannot cancel if any SUCCESS transaction exists (payment already made)
   * - Cannot cancel if status is ACTIVE, NON_RENEWING, or EXPIRED (subscription already activated)
   *
   * Deletion Order:
   * 1. ClinicsLegalDocuments (linked to manager account)
   * 2. ClinicManagerInformation + Account (manager)
   * 3. Pending Transactions
   * 4. ClinicSubscription
   * 5. ClinicAdminInformation
   * 6. Account (admin)
   *
   * @param {any} req - Request object containing authenticated user info
   * @returns {Promise<CancelRegistrationResponseDto>} Cancellation result
   *
   * @swagger
   * @security JWT-auth
   * @response 200 - Registration cancelled successfully
   * @response 400 - Cannot cancel registration with current status
   * @response 403 - Forbidden - Not CLINIC_ADMIN role
   * @response 404 - Subscription not found
   */
  @Delete('register/cancel-pending')
  @ApiOperation({ summary: 'Cancel pending registration (hard delete)' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.CLINIC_ADMIN)
  @ApiResponseData({
    type: CancelRegistrationResponseDto,
    status: MESSAGES.statusCode.success,
    message: 'Registration cancelled successfully',
  })
  async cancelPendingRegistration(
    @Request() req: any,
  ): Promise<{ data: CancelRegistrationResponseDto; message: string }> {
    const result = await this.accountsService.cancelPendingRegistration(
      req.user._id,
    );
    return { data: result, message: result.message };
  }

  /**
   * Cancel Active Subscription (Churn / Soft Cancel)
   *
   * Cancels an active subscription by changing status to NON_RENEWING.
   * This is a soft cancellation - no data is deleted, user retains access until expirationDate.
   *
   * Business Rules:
   * - Only CLINIC_ADMIN role can cancel their subscription
   * - Subscription must be in ACTIVE status
   * - Creates history record for churn analysis
   *
   * Effects:
   * - Status changes to NON_RENEWING
   * - History record created in clinic_subscriptions_history
   * - Account remains fully functional until expirationDate
   * - After expirationDate passes, status transitions to EXPIRED
   *
   * @param {any} req - Request object containing authenticated user info
   * @param {CancelSubscriptionDto} dto - Optional cancellation reason
   * @returns {Promise<CancelSubscriptionResponseDto>} Cancellation result
   *
   * @swagger
   * @security JWT-auth
   * @response 200 - Subscription cancelled successfully
   * @response 400 - Cannot cancel subscription with current status
   * @response 403 - Forbidden - Not CLINIC_ADMIN role
   * @response 404 - Subscription not found
   */
  @Post('subscription/cancel')
  @ApiOperation({ summary: 'Cancel active subscription (soft cancel)' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.CLINIC_ADMIN)
  @ApiResponseData({
    type: CancelSubscriptionResponseDto,
    status: MESSAGES.statusCode.success,
    message: 'Subscription cancelled successfully',
  })
  async cancelActiveSubscription(
    @Request() req: any,
    @Body() dto: CancelSubscriptionDto,
  ): Promise<{ data: CancelSubscriptionResponseDto; message: string }> {
    const result = await this.accountsService.cancelActiveSubscription(
      req.user._id,
      dto,
    );
    return { data: result, message: result.message };
  }

  /**
   * Upload Legal Documents for Clinic Manager (Step 4B)
   *
   * Uploads legal documents for a specific clinic manager during registration flow.
   *
   * Business Rules:
   * - Actor must have CLINIC_ADMIN role
   * - Manager exists, has role CLINIC_MANAGER
   * - Ownership: manager.parentId equals current admin account id
   * - Docs stored per manager (FK to manager account)
   * - Status transitions to PENDING_APPROVAL
   * - verificationStatus transitions to PENDING_REVIEW
   *
   * @param req - Request object containing authenticated user
   * @param managerAccountId - Clinic manager account UUID
   * @param dto - Legal document data
   * @returns Created legal documents
   */
  @Post('clinic-managers/:managerAccountId/legal-documents')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.CLINIC_ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Upload legal documents for clinic manager (Step 4B)',
    description:
      'Uploads legal documents for a specific clinic manager. Transitions subscription status to PENDING_APPROVAL.',
  })
  @HttpCode(HttpStatus.CREATED)
  @ApiResponseData({
    type: Object,
    status: MESSAGES.statusCode.created,
    message: 'Legal documents uploaded successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Requires CLINIC_ADMIN role or no ownership',
  })
  @ApiResponse({ status: 404, description: 'Clinic manager not found' })
  async uploadLegalDocumentsForManager(
    @Request() req: any,
    @Param('managerAccountId', ParseUUIDPipe) managerAccountId: string,
    @Body() dto: UploadLegalDocumentDto,
  ): Promise<{ data: any; message: string }> {
    const clinicAdminId = req.user._id;
    const legalDocs = await this.accountsService.uploadLegalDocumentsForManager(
      clinicAdminId,
      managerAccountId,
      dto,
    );
    return {
      data: legalDocs,
      message:
        'Legal documents uploaded successfully. Waiting for admin approval.',
    };
  }

  /**
   * Get Legal Documents for Clinic Manager
   *
   * Retrieves legal documents for a specific clinic manager.
   *
   * Business Rules:
   * - Actor must have CLINIC_ADMIN role
   * - Manager exists, has role CLINIC_MANAGER
   * - Ownership: manager.parentId equals current admin account id
   *
   * @param req - Request object containing authenticated user
   * @param managerAccountId - Clinic manager account UUID
   * @returns Legal documents
   */
  @Get('clinic-managers/:managerAccountId/legal-documents')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.CLINIC_ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get legal documents for clinic manager',
    description: 'Retrieves legal documents for a specific clinic manager.',
  })
  @HttpCode(HttpStatus.OK)
  @ApiResponseData({
    type: Object,
    status: MESSAGES.statusCode.success,
    message: 'Legal documents retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Requires CLINIC_ADMIN role or no ownership',
  })
  @ApiResponse({ status: 404, description: 'Clinic manager not found' })
  async getLegalDocumentsForManager(
    @Request() req: any,
    @Param('managerAccountId', ParseUUIDPipe) managerAccountId: string,
  ): Promise<{ data: any; message: string }> {
    const clinicAdminId = req.user._id;
    const legalDocs = await this.accountsService.getLegalDocumentsForManager(
      clinicAdminId,
      managerAccountId,
    );
    return {
      data: legalDocs,
      message: 'Legal documents retrieved successfully',
    };
  }

  /**
   * Update Legal Documents for Clinic Manager (Rejected Documents)
   *
   * Updates rejected legal documents for a specific clinic manager.
   * This endpoint is used when documents have been rejected and need to be resubmitted.
   *
   * Business Rules:
   * - Actor must have CLINIC_ADMIN role
   * - Manager exists, has role CLINIC_MANAGER
   * - Ownership: manager.parentId equals current admin account id
   * - Documents must be in REJECTED status
   * - verificationStatus transitions to PENDING_REVIEW
   * - Subscription status transitions back to PENDING_APPROVAL
   *
   * @param req - Request object containing authenticated user
   * @param managerAccountId - Clinic manager account UUID
   * @param dto - Legal document data to update
   * @returns Updated legal documents
   */
  @Put('clinic-managers/:managerAccountId/legal-documents')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.CLINIC_ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update legal documents for clinic manager (Rejected Documents)',
    description:
      'Updates rejected legal documents for a specific clinic manager. Transitions subscription status back to PENDING_APPROVAL.',
  })
  @HttpCode(HttpStatus.OK)
  @ApiResponseData({
    type: Object,
    status: MESSAGES.statusCode.success,
    message: 'Legal documents updated successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Requires CLINIC_ADMIN role or no ownership',
  })
  @ApiResponse({ status: 404, description: 'Clinic manager not found' })
  @ApiResponse({
    status: 400,
    description: 'Cannot update documents with current status',
  })
  async updateLegalDocumentsForManager(
    @Request() req: any,
    @Param('managerAccountId', ParseUUIDPipe) managerAccountId: string,
    @Body() dto: UpdateLegalDocumentsDto,
  ): Promise<{ data: any; message: string }> {
    const clinicAdminId = req.user._id;
    const legalDocs = await this.accountsService.updateLegalDocumentsForManager(
      clinicAdminId,
      managerAccountId,
      dto,
    );
    return {
      data: legalDocs,
      message:
        'Legal documents updated successfully. Waiting for admin approval.',
    };
  }

  /**
   * Search Patient by Phone, Email, or Name (Staff Only)
   *
   * Allows clinic staff to search for existing patients before creating walk-in appointments
   * Primary search is by phone number (unique identifier)
   * Returns patient details if found, or suggests creating new account
   *
   * Query Parameters:
   * - phone: Patient phone number (10 digits, starts with 0) - PRIMARY KEY
   * - email: Patient email (optional)
   * - fullName: Patient full name for fuzzy search (optional)
   *
   * Response Format:
   * - If found: Returns patient data with account info
   * - If not found: Returns suggested action to create new account
   *
   * Access Control:
   * - Requires CLINIC_STAFF role
   * - Requires valid JWT authentication
   *
   * Use Cases:
   * - Check if walk-in patient already has account before creating
   * - Prevent duplicate account creation
   * - Quick patient lookup by phone
   *
   * @param {SearchPatientQueryDto} query - Search parameters
   * @returns {Promise<{data: PatientSearchResponseDto, message: string}>} Search result
   *
   * @swagger
   * @security JWT-auth
   * @response 200 - Patient found or not found with suggested action
   * @response 401 - Unauthorized - Missing or invalid JWT token
   * @response 403 - Forbidden - Requires CLINIC_STAFF role
   * @response 400 - Bad Request - Invalid query parameters
   */
  @Get('staff/patients/search')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.CLINIC_STAFF)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Search patient by phone, email, or name (Staff)' })
  @ApiQuery({
    name: 'phone',
    required: false,
    type: String,
    description: 'Patient phone number (10 digits, starts with 0)',
    example: '0912345678',
  })
  @ApiQuery({
    name: 'email',
    required: false,
    type: String,
    description: 'Patient email address',
    example: 'nguyenvana@gmail.com',
  })
  @ApiQuery({
    name: 'fullName',
    required: false,
    type: String,
    description: 'Patient full name for fuzzy search',
    example: 'John Doe',
  })
  @ApiResponseData({
    type: PatientSearchResponseDto,
    status: 200,
    message: 'Patient search completed',
  })
  async searchPatient(
    @Query() query: SearchPatientQueryDto,
  ): Promise<{ data: PatientSearchResponseDto; message: string }> {
    const result = await this.accountsService.searchPatientByPhone(query);
    return {
      data: result,
      message: 'Patient search completed',
    };
  }
}
