import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ClinicLegalDocumentsService } from './clinic-legal-documents.service';
import { CreateClinicLegalDocumentDto } from './dto/create-clinic-legal-document.dto';
import { RejectClinicLegalDocumentDto } from './dto/reject-clinic-legal-document.dto';
import { ClinicsLegalDocuments } from '../accounts/entities/clinics_legal_documents.entity';
import { ApiResponseData } from 'src/common/decorators/api-response.decorator';
import { JwtAuthGuard } from '../auth/jwt.strategy';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccountRole } from '../accounts/enums/account-role.enum';

@ApiTags('Clinic Legal Documents')
@Controller('clinic-legal-documents')
export class ClinicLegalDocumentsController {
  constructor(
    private readonly clinicLegalDocumentsService: ClinicLegalDocumentsService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a clinic legal document record' })
  @ApiResponseData({
    type: ClinicsLegalDocuments,
    status: HttpStatus.CREATED,
    message: 'Clinic legal document created successfully',
  })
  async create(@Body() dto: CreateClinicLegalDocumentDto) {
    const doc = await this.clinicLegalDocumentsService.create(dto);
    return {
      statusCode: HttpStatus.CREATED,
    message: 'Clinic legal document created successfully',
    data: doc,
  };
}

  // ============================================
  // Admin Management Endpoints
  // ============================================

  /**
   * Get pending clinic manager legal documents
   * Only returns docs whose parent clinic admin account is ACTIVE
   */
  @Get('pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary:
      'Get pending clinic manager legal documents (admin account must be ACTIVE)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getPendingDocuments(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    const result = await this.clinicLegalDocumentsService.getPendingDocuments(
      Number(page) || 1,
      Number(limit) || 10,
    );
    return {
      data: result,
      message: 'Pending clinic manager legal documents retrieved successfully',
    };
  }

  /**
   * Get rejected clinic manager legal documents
   */
  @Get('rejected')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get rejected clinic manager legal documents',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getRejectedDocuments(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    const result = await this.clinicLegalDocumentsService.getRejectedDocuments(
      Number(page) || 1,
      Number(limit) || 10,
    );
    return {
      data: result,
      message: 'Rejected clinic manager legal documents retrieved successfully',
    };
  }

  /**
   * Get list of ACTIVE clinic admins with their managers and legal doc statuses
   */
  @Get('clinic-admins')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary:
      'Get ACTIVE clinic admins with their clinic managers and legal document statuses',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getClinicAdminsWithManagers(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    const result =
      await this.clinicLegalDocumentsService.getClinicAdminsWithManagers(
        Number(page) || 1,
        Number(limit) || 10,
      );
    return {
      data: result,
      message: 'Clinic admins with managers retrieved successfully',
    };
  }

  /**
   * Get detail of a clinic manager legal document
   */
  @Get('detail/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get detail of a clinic manager legal document' })
  @ApiParam({ name: 'id', type: 'string', description: 'Legal document ID' })
  async getDocumentDetail(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.clinicLegalDocumentsService.getDocumentDetail(id);
    return {
      data: result,
      message: 'Legal document detail retrieved successfully',
    };
  }

  /**
   * Approve a clinic manager legal document
   * Sets doc status → APPROVED and manager account status → ACTIVE
   */
  @Post(':id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Approve clinic manager legal document and activate manager account',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    description: 'Legal document ID (UUID)',
  })
  async approveDocument(@Param('id', ParseUUIDPipe) id: string) {
    return await this.clinicLegalDocumentsService.approveDocument(id);
  }

  /**
   * Reject a clinic manager legal document
   */
  @Post(':id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a clinic manager legal document' })
  @ApiParam({
    name: 'id',
    type: 'string',
    description: 'Legal document ID (UUID)',
  })
  @ApiBody({ type: RejectClinicLegalDocumentDto })
  async rejectDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectClinicLegalDocumentDto,
  ) {
    return await this.clinicLegalDocumentsService.rejectDocument(
      id,
      dto.reason,
    );
  }

  // ============================================
  // Generic Endpoints
  // ============================================


  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.CLINIC_MANAGER)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get current manager clinic legal documents' })
  @ApiResponseData({
    type: ClinicsLegalDocuments,
    status: HttpStatus.OK,
    message: 'Clinic legal document retrieved successfully',
  })
  async getMyLegalDocuments(@Req() req: any) {
    const accountId = req.user._id;
    const doc = await this.clinicLegalDocumentsService.findDocumentByAccountId(accountId);
    return {
      statusCode: HttpStatus.OK,
    message: 'Clinic legal document retrieved successfully',
    data: doc,
  };
}

@Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a clinic legal document by id' })
  @ApiResponseData({
    type: ClinicsLegalDocuments,
    status: HttpStatus.OK,
    message: 'Clinic legal document retrieved successfully',
  })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const doc = await this.clinicLegalDocumentsService.findOne(id);
    return {
      statusCode: HttpStatus.OK,
    message: 'Clinic legal document retrieved successfully',
    data: doc,
  };
}
}
