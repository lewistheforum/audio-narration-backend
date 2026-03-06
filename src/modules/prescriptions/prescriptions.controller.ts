import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpStatus,
  UseGuards,
  Request,
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
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiProduces,
} from '@nestjs/swagger';
import { Response } from 'express';
import { PrescriptionsService } from './prescriptions.service';
import {
  CreateMedicineDto,
  UpdateMedicineDto,
  PatientEPrescriptionDetailResponseDto,
  PatientERMDetailResponseDto,
} from './dto';
import { Medicine } from './entities/medicine.entity';
import { JwtAuthGuard } from '../auth/jwt.strategy';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccountRole } from 'src/modules/accounts/enums';

/**
 * Prescriptions Controller
 *
 * Handles HTTP requests for medicine management
 * Part of ERM & E-Prescriptions module
 */
@ApiTags('Medicines & Prescriptions')
@Controller('medicines')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PrescriptionsController {
  constructor(private readonly prescriptionsService: PrescriptionsService) {}

  /**
   * Create a new medicine
   * Admin only
   */
  @Post()
  @Roles(AccountRole.ADMIN)
  @ApiOperation({ summary: 'Create a new medicine (Admin only)' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Medicine created successfully',
    type: Medicine,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Admin access required',
  })
  async create(
    @Body() createMedicineDto: CreateMedicineDto,
  ): Promise<Medicine> {
    return await this.prescriptionsService.create(createMedicineDto);
  }

  /**
   * Get all medicines
   */
  @Get()
  @ApiOperation({ summary: 'Get all medicines' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Medicines retrieved successfully',
    type: [Medicine],
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  async findAll(): Promise<Medicine[]> {
    return await this.prescriptionsService.findAll();
  }

  /**
   * Search medicines by name
   */
  @Get('search')
  @ApiOperation({ summary: 'Search medicines by name' })
  @ApiQuery({
    name: 'name',
    required: true,
    description: 'Medicine name to search (partial match)',
    example: 'para',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Search results retrieved successfully',
    type: [Medicine],
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  async search(@Query('name') name: string): Promise<Medicine[]> {
    return await this.prescriptionsService.searchByName(name);
  }

  /**
   * Get habit-forming medicines
   */
  @Get('habit-forming')
  @Roles(AccountRole.DOCTOR, AccountRole.ADMIN)
  @ApiOperation({ summary: 'Get habit-forming medicines (Doctor/Admin only)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Habit-forming medicines retrieved successfully',
    type: [Medicine],
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Doctor or Admin access required',
  })
  async getHabitForming(): Promise<Medicine[]> {
    return await this.prescriptionsService.findHabitForming();
  }

  /**
   * Get medicines by therapeutic class
   */
  @Get('therapeutic/:class')
  @ApiOperation({ summary: 'Get medicines by therapeutic class' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Medicines retrieved successfully',
    type: [Medicine],
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  async findByTherapeuticClass(
    @Param('class') therapeuticClass: string,
  ): Promise<Medicine[]> {
    return await this.prescriptionsService.findByTherapeuticClass(
      therapeuticClass,
    );
  }

  /**
   * Get medicine by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get medicine by ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Medicine retrieved successfully',
    type: Medicine,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Medicine not found',
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  async findOne(@Param('id') id: string): Promise<Medicine> {
    return await this.prescriptionsService.findOne(id);
  }

  /**
   * Update medicine
   * Admin only
   */
  @Patch(':id')
  @Roles(AccountRole.ADMIN)
  @ApiOperation({ summary: 'Update medicine (Admin only)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Medicine updated successfully',
    type: Medicine,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Medicine not found',
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Admin access required',
  })
  async update(
    @Param('id') id: string,
    @Body() updateMedicineDto: UpdateMedicineDto,
  ): Promise<Medicine> {
    return await this.prescriptionsService.update(id, updateMedicineDto);
  }

  /**
   * Soft delete medicine
   * Admin only
   */
  @Delete(':id')
  @Roles(AccountRole.ADMIN)
  @ApiOperation({ summary: 'Soft delete medicine (Admin only)' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Medicine deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Medicine not found',
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Admin access required',
  })
  async remove(@Param('id') id: string): Promise<void> {
    return await this.prescriptionsService.remove(id);
  }

  /**
   * Restore soft-deleted medicine
   * Admin only
   */
  @Patch(':id/restore')
  @Roles(AccountRole.ADMIN)
  @ApiOperation({ summary: 'Restore soft-deleted medicine (Admin only)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Medicine restored successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Medicine not found',
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Admin access required',
  })
  async restore(@Param('id') id: string): Promise<void> {
    return await this.prescriptionsService.restore(id);
  }

  /**
   * Get Patient E-Prescription Detail
   * Patient only - nested under appointment route
   * 
   * Retrieves electronic prescription for a specific appointment
   * Only accessible when appointment status is COMPLETED
   */
  @Get('patients/me/appointments/:appointmentId/e-prescription')
  @Roles(AccountRole.PATIENT)
  @ApiOperation({ 
    summary: 'Get E-Prescription for a specific appointment',
    description: 'Retrieves the electronic prescription details including all prescribed medicines. Only available for completed appointments.'
  })
  @ApiParam({
    name: 'appointmentId',
    type: 'string',
    format: 'uuid',
    description: 'Appointment ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'E-Prescription retrieved successfully',
    type: PatientEPrescriptionDetailResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Appointment or E-Prescription not found',
    schema: {
      example: {
        statusCode: 404,
        message: 'Appointment not found or access denied',
        error: 'Not Found',
      },
    },
  })
  @ApiForbiddenResponse({
    description: 'E-Prescription only available for completed appointments',
    schema: {
      example: {
        statusCode: 403,
        message: 'E-Prescription is only available for completed appointments',
        error: 'Forbidden',
      },
    },
  })
  @ApiResponse({ 
    status: HttpStatus.UNAUTHORIZED, 
    description: 'Unauthorized - Invalid or missing JWT token' 
  })
  async getPatientEPrescription(
    @Param('appointmentId', ParseUUIDPipe) appointmentId: string,
    @Request() req: any,
  ): Promise<PatientEPrescriptionDetailResponseDto> {
    const patientId = req.user._id;
    return await this.prescriptionsService.getPatientEPrescription(
      patientId,
      appointmentId,
    );
  }

  /**
   * Export Patient E-Prescription as PDF
   * Patient only - generates downloadable PDF document
   * 
   * Exports the electronic prescription in a medical-compliant PDF format
   * with clinic, doctor, and patient information headers
   */
  @Get('patients/me/appointments/:appointmentId/e-prescription/export/pdf')
  @Roles(AccountRole.PATIENT)
  @ApiOperation({
    summary: 'Export E-Prescription as PDF',
    description: 'Downloads the electronic prescription as a professionally formatted PDF document with clinic letterhead, doctor information, and all prescribed medicines. Only available for completed appointments.',
  })
  @ApiParam({
    name: 'appointmentId',
    type: 'string',
    format: 'uuid',
    description: 'Appointment ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiProduces('application/pdf')
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'PDF file generated and downloaded successfully',
    schema: {
      type: 'string',
      format: 'binary',
    },
  })
  @ApiNotFoundResponse({
    description: 'Appointment or E-Prescription not found',
    schema: {
      example: {
        statusCode: 404,
        message: 'Appointment not found or access denied',
        error: 'Not Found',
      },
    },
  })
  @ApiForbiddenResponse({
    description: 'E-Prescription only available for completed appointments',
    schema: {
      example: {
        statusCode: 403,
        message: 'E-Prescription is only available for completed appointments',
        error: 'Forbidden',
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  async exportEPrescriptionPdf(
    @Param('appointmentId', ParseUUIDPipe) appointmentId: string,
    @Request() req: any,
    @Res() res: Response,
  ): Promise<void> {
    const patientId = req.user._id;

    // Generate PDF buffer
    const pdfBuffer = await this.prescriptionsService.generateEPrescriptionPdf(
      patientId,
      appointmentId,
    );

    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="prescription-${appointmentId}.pdf"`,
    );
    res.setHeader('Content-Length', pdfBuffer.length.toString());

    // Send PDF buffer
    res.send(pdfBuffer);
  }

  /**
   * Get Patient ERM Detail (Polymorphic Retrieval)
   * Patient only - retrieves specific ERM record
   * 
   * Returns ERM details with polymorphic child data based on record_type
   * Enforces strict 3-layer linkage validation and visibility rules
   */
  @Get('patients/me/appointments/:appointmentId/erms/:ermId')
  @Roles(AccountRole.PATIENT)
  @ApiOperation({
    summary: 'Get ERM record details for a specific appointment',
    description:
      'Retrieves Electronic Record Management (ERM) details including polymorphic child records (X-ray, Lab, Ultrasound, Consultation, Bone Density, Procedure). Only COMPLETED records are accessible to patients. Enforces strict ownership validation (patient -> appointment -> ERM).',
  })
  @ApiParam({
    name: 'appointmentId',
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
    status: HttpStatus.OK,
    description: 'ERM record retrieved successfully',
    type: PatientERMDetailResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Appointment, ERM, or child record not found',
    schema: {
      example: {
        statusCode: 404,
        message: 'Appointment not found or access denied',
        error: 'Not Found',
      },
    },
  })
  @ApiForbiddenResponse({
    description: 'ERM record not available (status must be COMPLETED)',
    schema: {
      example: {
        statusCode: 403,
        message: 'ERM record is not available (status must be COMPLETED)',
        error: 'Forbidden',
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  async getPatientERMDetail(
    @Param('appointmentId', ParseUUIDPipe) appointmentId: string,
    @Param('ermId', ParseUUIDPipe) ermId: string,
    @Request() req: any,
  ): Promise<PatientERMDetailResponseDto> {
    const patientId = req.user._id;
    return await this.prescriptionsService.getPatientERMDetail(
      patientId,
      appointmentId,
      ermId,
    );
  }
}
