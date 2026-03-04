import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { ErmsService } from './erms.service';
import { PrescriptionsService } from './prescriptions.service';
import { InitializeErmDto, ErmResponseDto, SaveErmDataDto, SaveErmResponseDto, CreatePrescriptionDto, PrescriptionResponseDto } from './dto';
import { ConsultationFormTemplateDto } from './dto/consultation-form-template.dto';
import { XrayFormTemplateDto } from './dto/xray-form-template.dto';
import { UltrasoundFormTemplateDto } from './dto/ultrasound-form-template.dto';
import { LabFormTemplateDto } from './dto/lab-form-template.dto';
import { ProcedureFormTemplateDto } from './dto/procedure-form-template.dto';
import { BoneDensityFormTemplateDto } from './dto/bone-density-form-template.dto';
import { JwtAuthGuard } from '../auth/jwt.strategy';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccountRole } from '../accounts/enums';

/**
 * ERMs Controller
 *
 * Handles HTTP requests for ERM (Electronic Medical Records) management
 *
 * Endpoints:
 * - POST /erms/init - Initialize ERM (Step 3)
 * - GET /erms/:id/form-template - Get form template (Step 4)
 * - PUT /erms/:id - Save ERM data (Step 5)
 */
@ApiTags('ERMs (Electronic Medical Records)')
@Controller('erms')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(AccountRole.DOCTOR)
@ApiBearerAuth('JWT-auth')
export class ErmsController {
  constructor(
    private readonly ermsService: ErmsService,
    private readonly prescriptionsService: PrescriptionsService,
  ) {}

  /**
   * Initialize ERM (Step 3 - ERM Flow)
   *
   * Creates a new ERM record with status = DRAFT for a service appointment
   *
   * @param req - Request object containing authenticated doctor
   * @param initializeErmDto - Request data (serviceAppointmentId, appointmentId)
   * @returns Created ERM record
   */
  @Post('init')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Initialize ERM (Step 3 - ERM Flow)',
    description:
      'Create a new ERM record with status = DRAFT for a service appointment. ' +
      'The record_type is automatically determined from the service configuration. ' +
      'Only one ERM can be created per service appointment.',
  })
  @ApiResponse({
    status: 201,
    description: 'ERM initialized successfully',
    type: ErmResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad Request - Service appointment does not belong to appointment or doctor not assigned',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User is not a doctor',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Appointment or service appointment not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - ERM already exists for this service appointment',
  })
  async initializeErm(
    @Request() req: any,
    @Body() initializeErmDto: InitializeErmDto,
  ): Promise<ErmResponseDto> {
    const doctorId = req.user._id;
    return this.ermsService.initializeErm(initializeErmDto, doctorId);
  }

  /**
   * Get Form Template for ERM (Step 4 - ERM Flow)
   *
   * Returns form template/schema based on ERM record type
   * Includes current saved data if exists
   *
   * @param req - Request object containing authenticated doctor
   * @param id - ERM ID
   * @returns Form template DTO based on record type
   */
  @Get(':id/form-template')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get Form Template for ERM (Step 4 - ERM Flow)',
    description:
      'Returns the form template/schema based on ERM record type (CONSULTATION, XRAY, ULTRASOUND, LAB, PROCEDURE, BONE_DENSITY). ' +
      'The response includes field definitions and current saved data if the ERM status is IN_PROGRESS. ' +
      'Frontend uses this template to dynamically render the appropriate form.',
  })
  @ApiParam({
    name: 'id',
    description: 'ERM ID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'Form template retrieved successfully',
    schema: {
      oneOf: [
        { $ref: '#/components/schemas/ConsultationFormTemplateDto' },
        { $ref: '#/components/schemas/XrayFormTemplateDto' },
        { $ref: '#/components/schemas/UltrasoundFormTemplateDto' },
        { $ref: '#/components/schemas/LabFormTemplateDto' },
        { $ref: '#/components/schemas/ProcedureFormTemplateDto' },
        { $ref: '#/components/schemas/BoneDensityFormTemplateDto' },
      ],
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Doctor does not have permission or unknown record type',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User is not a doctor',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - ERM not found',
  })
  async getFormTemplate(
    @Request() req: any,
    @Param('id') id: string,
  ): Promise<
    | ConsultationFormTemplateDto
    | XrayFormTemplateDto
    | UltrasoundFormTemplateDto
    | LabFormTemplateDto
    | ProcedureFormTemplateDto
    | BoneDensityFormTemplateDto
  > {
    const doctorId = req.user._id;
    return this.ermsService.getFormTemplate(id, doctorId);
  }

  /**
   * Save ERM Data (Step 5 - ERM Flow)
   *
   * Saves or updates ERM detail data based on record type
   * Updates ERM status from DRAFT to IN_PROGRESS
   *
   * @param req - Request object containing authenticated doctor
   * @param id - ERM ID
   * @param saveErmDataDto - Request data containing ERM details
   * @returns Save response with updated ERM status
   */
  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Save ERM Data (Step 5 - ERM Flow)',
    description:
      'Saves or updates ERM detail data in the appropriate detail table based on record type (CONSULTATION, XRAY, etc.). ' +
      'On first save, updates ERM status from DRAFT to IN_PROGRESS. ' +
      'Allows multiple saves while status is IN_PROGRESS. ' +
      'Cannot save when status is COMPLETED.',
  })
  @ApiParam({
    name: 'id',
    description: 'ERM ID',
    type: 'string',
    format: 'uuid',
  })
  @ApiResponse({
    status: 200,
    description: 'ERM data saved successfully',
    type: SaveErmResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Doctor does not have permission or ERM is completed',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User is not a doctor',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - ERM not found',
  })
  async saveErmData(
    @Request() req: any,
    @Param('id') id: string,
    @Body() saveErmDataDto: SaveErmDataDto,
  ): Promise<SaveErmResponseDto> {
    const doctorId = req.user._id;
    return this.ermsService.saveErmData(id, saveErmDataDto, doctorId);
  }

  /**
   * Create or update electronic prescription (Step 7)
   *
   * Creates a new prescription or updates existing one for an appointment.
   * Implements upsert logic: if prescription exists, it will be updated with new medicines.
   * Old medicine details are soft deleted and replaced with new ones.
   *
   * @param req - Request object containing authenticated doctor
   * @param appointmentId - Appointment UUID
   * @param createPrescriptionDto - Prescription data with medicines
   * @returns Created/updated prescription with all medicine details
   */
  @Post('appointments/:appointmentId/prescriptions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.DOCTOR)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create or update electronic prescription (Step 7 - ERM Flow)',
    description:
      'Create a new electronic prescription or update existing one for an appointment. ' +
      'If prescription already exists, old medicine details are soft deleted and replaced. ' +
      'Validates that all medicines exist and checks for habit-forming medicines. ' +
      'Generates unique reference ID (EP{YYYYMMDD}{SequenceNumber}).',
  })
  @ApiResponse({
    status: 201,
    description: 'Prescription created/updated successfully',
    type: PrescriptionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid data, doctor permission denied, or appointment not in correct status',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User is not a doctor',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Appointment or medicines not found',
  })
  @ApiParam({
    name: 'appointmentId',
    type: String,
    description: 'Appointment UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  async createOrUpdatePrescription(
    @Request() req: any,
    @Param('appointmentId') appointmentId: string,
    @Body() createPrescriptionDto: CreatePrescriptionDto,
  ): Promise<PrescriptionResponseDto> {
    const doctorId = req.user._id;
    return this.prescriptionsService.createOrUpdatePrescription(
      appointmentId,
      createPrescriptionDto,
      doctorId,
    );
  }

  /**
   * Get electronic prescription (Step 7.1)
   *
   * Retrieves the electronic prescription for an appointment with all medicine details.
   * Used for viewing or editing prescription before completing examination.
   *
   * @param req - Request object containing authenticated doctor
   * @param appointmentId - Appointment UUID
   * @returns Prescription with all medicine details
   */
  @Get('appointments/:appointmentId/prescriptions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.DOCTOR)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get electronic prescription (Step 7.1 - ERM Flow)',
    description:
      'Retrieve the electronic prescription for an appointment including all medicine details. ' +
      'Shows medicine names, usage instructions, and flags habit-forming medicines.',
  })
  @ApiResponse({
    status: 200,
    description: 'Prescription retrieved successfully',
    type: PrescriptionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Doctor does not have permission',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User is not a doctor',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Appointment or prescription not found',
  })
  @ApiParam({
    name: 'appointmentId',
    type: String,
    description: 'Appointment UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  async getPrescription(
    @Request() req: any,
    @Param('appointmentId') appointmentId: string,
  ): Promise<PrescriptionResponseDto> {
    const doctorId = req.user._id;
    return this.prescriptionsService.getPrescription(appointmentId, doctorId);
  }

  /**
   * Update electronic prescription (Step 7.1)
   *
   * Updates existing prescription with new medicine list.
   * Old medicine details are soft deleted and replaced with new ones.
   * Same as POST but semantically clearer for updates.
   *
   * @param req - Request object containing authenticated doctor
   * @param appointmentId - Appointment UUID
   * @param createPrescriptionDto - Updated prescription data
   * @returns Updated prescription with all medicine details
   */
  @Put('appointments/:appointmentId/prescriptions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.DOCTOR)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update electronic prescription (Step 7.1 - ERM Flow)',
    description:
      'Update existing electronic prescription with new medicine list. ' +
      'Old medicine details are soft deleted and completely replaced with new ones. ' +
      'Only allowed when appointment status is IN_PROGRESS.',
  })
  @ApiResponse({
    status: 200,
    description: 'Prescription updated successfully',
    type: PrescriptionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid data, doctor permission denied, or appointment completed',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User is not a doctor',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Appointment, prescription, or medicines not found',
  })
  @ApiParam({
    name: 'appointmentId',
    type: String,
    description: 'Appointment UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  async updatePrescription(
    @Request() req: any,
    @Param('appointmentId') appointmentId: string,
    @Body() createPrescriptionDto: CreatePrescriptionDto,
  ): Promise<PrescriptionResponseDto> {
    const doctorId = req.user._id;
    return this.prescriptionsService.createOrUpdatePrescription(
      appointmentId,
      createPrescriptionDto,
      doctorId,
    );
  }
}
