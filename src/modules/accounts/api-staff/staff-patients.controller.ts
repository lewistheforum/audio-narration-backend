import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { StaffPatientsService } from './staff-patients.service';
import {
  CreatePatientByStaffDto,
  CreatePatientByStaffResponseDto,
  CreatePatientNoEmailDto,
  CreatePatientNoEmailResponseDto,
  GetAllPatientsResponseDto,
} from './dto';
import { JwtAuthGuard } from '../../auth/jwt.strategy';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AccountRole } from '../enums';

/**
 * Staff Patients Controller
 *
 * Handles patient account creation by clinic staff for walk-in appointments.
 *
 * Features:
 * - Create patient accounts with minimal information
 * - Auto-generate and send credentials via email
 * - Staff-only access with role-based guards
 *
 * Endpoints:
 * - POST /staff/patients/create-account - Create patient account with email (Step 2)
 * - POST /staff/patients/create-account-no-email - Create patient account without email (Step A3)
 */
@ApiTags('Staff Patients Management')
@Controller('staff/patients')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class StaffPatientsController {
  constructor(private readonly staffPatientsService: StaffPatientsService) {}

  /**
   * Create Patient Account by Staff (Step 2 - Walk-in Flow)
   *
   * Creates a patient account for walk-in customers with minimal information.
   * Only clinic staff can access this endpoint.
   *
   * Process:
   * 1. Validate email uniquness (phone can duplicate)
   * 2. Auto-generate secure random password
   * 3. Create account + profile
   * 4. Send welcome email with credentials
   * 5. Return account info with temporary password
   *
   * Business Rules:
   * - Email must be unique
   * - Phone allows duplicates (shared family phone)
   * - Password auto-generated (12 chars, mixed)
   * - Email sent automatically with login instructions
   * - Staff can view password in response to provide to customer
   *
   * Access Control:
   * - Only CLINIC_STAFF role allowed
   * - Must be authenticated with valid JWT
   *
   * @param {CreatePatientByStaffDto} dto - Patient data (email, phone, fullName)
   * @returns {Promise<CreatePatientByStaffResponseDto>} Created account with credentials
   */
  @Post('create-account')
  @HttpCode(HttpStatus.CREATED)
  @Roles(AccountRole.CLINIC_STAFF)
  @ApiOperation({
    summary: 'Create patient account by staff (Walk-in - Step 2)',
    description:
      'Creates patient account with minimal info (email, phone, fullName). Auto-generates password and sends via email. For walk-in appointments.',
  })
  @ApiResponse({
    status: 201,
    description: 'Patient account created successfully',
    type: CreatePatientByStaffResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Email already exists',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Not clinic staff',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error',
  })
  async createPatientByStaff(
    @Body() dto: CreatePatientByStaffDto,
  ): Promise<CreatePatientByStaffResponseDto> {
    return this.staffPatientsService.createPatientByStaff(dto);
  }

  /**
   * Create Patient Account Without Email by Staff (Step A3 - Walk-in Flow)
   *
   * Creates patient account for walk-in customers who don't have real email.
   * System generates fake email from full name + date of birth.
   * Only clinic staff can access this endpoint.
   *
   * Process:
   * 1. Generate fake email: name + DOB + @tempemail.clinic
   * 2. Auto-generate secure random password
   * 3. Create account + profile with DOB
   * 4. Do NOT send email (fake email doesn't exist)
   * 5. Return credentials for staff to provide manually
   *
   * Business Rules:
   * - Phone allows duplicates (shared family phone)
   * - Fake email format: normalized_name + DDMMYYYY + @tempemail.clinic
   * - Password auto-generated (12 chars, mixed)
   * - No email sent (staff provides credentials directly)
   * - DOB saved to profile
   * - Patient can update real email later
   *
   * Access Control:
   * - Only CLINIC_STAFF role allowed
   * - Must be authenticated with valid JWT
   *
   * @param {CreatePatientNoEmailDto} dto - Patient data (phone, fullName, dateOfBirth)
   * @returns {Promise<CreatePatientNoEmailResponseDto>} Created account with fake email and credentials
   */
  @Post('create-account-no-email')
  @HttpCode(HttpStatus.CREATED)
  @Roles(AccountRole.CLINIC_STAFF)
  @ApiOperation({
    summary:
      'Create patient account without email by staff (Walk-in - Step A3)',
    description:
      'Creates patient account with fake email (name + DOB + @tempemail.clinic) for walk-in customers without real email. Auto-generates password. No email sent.',
  })
  @ApiResponse({
    status: 201,
    description: 'Patient account created successfully with temporary email',
    type: CreatePatientNoEmailResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Not clinic staff',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error',
  })
  async createPatientNoEmail(
    @Body() dto: CreatePatientNoEmailDto,
  ): Promise<CreatePatientNoEmailResponseDto> {
    return this.staffPatientsService.createPatientNoEmail(dto);
  }

  /**
   * Get All Patient Accounts (Walk-in Flow)
   *
   * Retrieves all patient accounts for the clinic staff to view.
   * Only clinic staff can access this endpoint.
   * Note: Route uses absolute path mapping to meet exact path requirements.
   *
   * @returns {Promise<GetAllPatientsResponseDto>} List of patient accounts
   */
  @Get('')
  @HttpCode(HttpStatus.OK)
  @Roles(AccountRole.CLINIC_STAFF)
  @ApiOperation({
    summary: 'Get all patient accounts (Walk-in)',
    description: 'Retrieves a list of all patient accounts for clinic staff.',
  })
  @ApiResponse({
    status: 200,
    description: 'Patient accounts retrieved successfully',
    type: GetAllPatientsResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Not clinic staff',
  })
  async getAllPatients(): Promise<GetAllPatientsResponseDto> {
    return this.staffPatientsService.getAllPatientAccounts();
  }
}
