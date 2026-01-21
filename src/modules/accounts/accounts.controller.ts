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
  CreateClinicManagerDto,
  CreateClinicAdminProfileDto,
  UpdateClinicAdminProfileDto,
  PublicDoctorDetailResponseDto,
  PublicDoctorDetailData,
  PublicDoctorInfo,
  PublicClinicInfo,
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
 * RESTful API controller for managing user accounts in the Medicare system.
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
  CreateClinicAdminProfileDto,
  UpdateClinicAdminProfileDto,
  PublicDoctorDetailResponseDto,
  PublicDoctorDetailData,
  PublicDoctorInfo,
  PublicClinicInfo,
)
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

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
  @ApiOperation({ summary: 'Get full list of usernames and emails' })
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
   * Get All Clinics (Public)
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
  async getAllClinics(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('search') search?: string,
    @Query('province') province?: string,
    @Query('specialty') specialty?: string,
  ): Promise<{ data: ClinicListResponseDto; message: string }> {
    const result = await this.accountsService.findAllClinics(
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
  @ApiResponseData({
    type: ClinicDetailResponseDto,
    status: MESSAGES.statusCode.success,
    message: 'Clinic details retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Clinic not found' })
  async getClinicById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ data: ClinicDetailResponseDto; message: string }> {
    const clinic = await this.accountsService.findClinicById(id);
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

  /**
   * Get Clinic Admin Profile
   *
   * Retrieves the clinic admin profile information for a specific account.
   * Only accounts with CLINIC_ADMIN role can have clinic admin profiles.
   *
   * Path Parameters:
   * - id: Account UUID
   *
   * Response Format:
   * - Returns ClinicAdminInformation entity with clinic admin profile data
   *
   * Access Control:
   * - Requires JWT authentication
   * - Available to CLINIC_ADMIN role
   *
   * Use Cases:
   * - Viewing clinic admin profile
   * - Displaying clinic admin information in dashboards
   *
   * @param {string} id - Account UUID
   * @returns {Promise<{data: ClinicAdminInformation, message: string}>} Clinic admin profile data
   *
   * @swagger
   * @security JWT-auth
   * @response 200 - Successfully retrieved clinic admin profile
   * @response 401 - Unauthorized - Missing or invalid JWT token
   * @response 403 - Forbidden - Requires CLINIC_ADMIN role
   * @response 404 - Account not found or doesn't have CLINIC_ADMIN role
   * @response 400 - Invalid UUID format
   */
  @Get('clinic-admin/:id/profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.CLINIC_ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get clinic admin profile by account ID' })
  @ApiResponseData({
    type: Object,
    status: MESSAGES.statusCode.success,
    message: 'Clinic admin profile retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Clinic admin profile not found' })
  async getClinicAdminProfile(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ data: any; message: string }> {
    const profile = await this.accountsService.findClinicAdminProfile(id);
    return {
      data: profile,
      message: 'Clinic admin profile retrieved successfully',
    };
  }

  /**
   * Create Clinic Admin Profile
   *
   * Creates a new clinic admin profile for an account.
   * This endpoint is used to create the profile after the account is created.
   *
   * Path Parameters:
   * - id: Account UUID
   *
   * Request Body:
   * - clinicName: Clinic name (required)
   * - description: Clinic description (optional)
   * - specializedIn: Clinic specializations (optional)
   * - pros: Clinic pros/advantages (optional)
   * - paraclinical: Paraclinical services offered (optional)
   * - dob: Date of birth (optional)
   * - profilePicture: Profile picture URL (optional)
   * - bankName: Bank name (optional)
   * - bankNumber: Bank account number (optional)
   * - bankBranch: Bank branch (optional)
   * - sepayVa: SePay virtual account number (optional)
   * - isVerify: Verification status (optional, default: false)
   *
   * Access Control:
   * - Requires JWT authentication
   * - Available to CLINIC_ADMIN role
   *
   * Use Cases:
   * - Creating clinic admin profile after account creation
   * - Initial profile setup
   *
   * @param {string} id - Account UUID
   * @param {CreateClinicAdminProfileDto} dto - Clinic admin profile data
   * @returns {Promise<{data: ClinicAdminInformation, message: string}>} Created clinic admin profile
   *
   * @swagger
   * @security JWT-auth
   * @response 201 - Successfully created clinic admin profile
   * @response 401 - Unauthorized - Missing or invalid JWT token
   * @response 403 - Forbidden - Requires CLINIC_ADMIN role
   * @response 404 - Account not found or doesn't have CLINIC_ADMIN role
   */
  @Post('clinic-admin/:id/profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.CLINIC_ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create clinic admin profile' })
  @ApiResponseData({
    type: Object,
    status: MESSAGES.statusCode.success,
    message: 'Clinic admin profile created successfully',
  })
  @ApiResponse({ status: 404, description: 'Account not found' })
  async createClinicAdminProfile(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateClinicAdminProfileDto,
  ): Promise<{ data: any; message: string }> {
    const profile = await this.accountsService.createClinicAdminProfile(
      id,
      dto,
    );
    return {
      data: profile,
      message: 'Clinic admin profile created successfully',
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
   * - TODO: Consider restricting to self-only updates
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
}
