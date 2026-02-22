import {
  Controller,
  Get,
  Param,
  Query,
  ParseUUIDPipe,
  ParseIntPipe,
  DefaultValuePipe,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ClinicAdminsService } from './clinic-admins.service';
import {
  ClinicAdminResponseDto,
  ClinicAdminDetailResponseDto,
} from './dto/clinic-admin-response.dto';
import { ClinicAdminFeedbackResponseDto } from './dto/clinic-admin-feedback-response.dto';
import { ClinicAdminFeedbackDetailResponseDto } from './dto/clinic-admin-feedback-detail.dto';
import { ClinicAdminFeedbackListDto } from './dto/clinic-admin-feedback-list.dto';
import {
  SubscriptionHistoryItemDto,
  TransactionHistoryItemDto,
} from './dto/clinic-admin-subscription-history.dto';
import { ClinicAdminClinicServiceDto } from './dto/clinic-admin-clinic-service.dto';
import { BanClinicAdminDto } from './dto/ban-clinic-admin.dto';

import { JwtAuthGuard } from '../../auth/jwt.strategy';
import { RolesGuard } from '../../../common/guards/roles.guard';

/**
 * ClinicAdminsController
 *
 * Admin-facing endpoints for managing and viewing clinic admin accounts
 */
@ApiTags('Clinic Admin')
@Controller('clinic-admins')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class ClinicAdminsController {
  constructor(private readonly clinicAdminsService: ClinicAdminsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all clinic admin accounts' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'List of clinic admin accounts',
    type: [ClinicAdminResponseDto],
  })
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('search') search?: string,
  ) {
    return this.clinicAdminsService.findAll(page, limit, search);
  }

  @Get(':id')
  @ApiOperation({
    summary:
      'Get clinic admin detail with linked account statistics and subscription info',
  })
  @ApiResponse({
    status: 200,
    description: 'Clinic admin details with stats',
    type: ClinicAdminDetailResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Clinic admin not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.clinicAdminsService.findOne(id);
  }

  @Get(':id/subscription-history')
  @ApiOperation({
    summary: 'Get subscription registration history of a clinic admin',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Subscription registration history',
    type: [SubscriptionHistoryItemDto],
  })
  @ApiResponse({ status: 404, description: 'Clinic admin not found' })
  async getSubscriptionHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.clinicAdminsService.getSubscriptionHistory(id, page, limit);
  }

  @Get(':id/transaction-history')
  @ApiOperation({ summary: 'Get transaction history of a clinic admin' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Transaction history',
    type: [TransactionHistoryItemDto],
  })
  @ApiResponse({ status: 404, description: 'Clinic admin not found' })
  async getTransactionHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.clinicAdminsService.getTransactionHistory(id, page, limit);
  }

  @Get(':id/clinic-services')
  @ApiOperation({
    summary: 'Get clinic services available for a clinic admin',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'Clinic services with configuration details',
    type: [ClinicAdminClinicServiceDto],
  })
  @ApiResponse({ status: 404, description: 'Clinic admin not found' })
  async getClinicServices(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('search') search?: string,
  ) {
    return this.clinicAdminsService.getClinicServices(id, page, limit, search);
  }

  @Post(':id/ban')
  @ApiOperation({
    summary: 'Ban a clinic admin (cascades to all linked accounts)',
  })
  @ApiResponse({
    status: 200,
    description: 'Clinic admin banned successfully',
    type: ClinicAdminResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Clinic admin not found' })
  async banClinicAdmin(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() banDto: BanClinicAdminDto,
  ) {
    return this.clinicAdminsService.banClinicAdmin(id, banDto.description);
  }

  @Post(':id/unban')
  @ApiOperation({
    summary: 'Unban a clinic admin (cascades to all linked accounts)',
  })
  @ApiResponse({
    status: 200,
    description: 'Clinic admin unbanned successfully',
    type: ClinicAdminResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Clinic admin not found' })
  async unbanClinicAdmin(@Param('id', ParseUUIDPipe) id: string) {
    return this.clinicAdminsService.unbanClinicAdmin(id);
  }

  @Get(':id/ban-history')
  @ApiOperation({ summary: 'Get ban history of a clinic admin' })
  @ApiResponse({
    status: 200,
    description: 'Ban history list',
  })
  @ApiResponse({ status: 404, description: 'Clinic admin not found' })
  async getBanHistory(@Param('id', ParseUUIDPipe) id: string) {
    return this.clinicAdminsService.getBanHistory(id);
  }

  @Get(':id/feedbacks')
  @ApiOperation({ summary: 'Get feedbacks for clinics managed by this admin' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'List of feedbacks',
    type: ClinicAdminFeedbackListDto,
  })
  @ApiResponse({ status: 404, description: 'Clinic admin not found' })
  async getFeedbacks(@Param('id', ParseUUIDPipe) id: string) {
    return this.clinicAdminsService.getFeedbacks(id);
  }

  @Get(':id/feedbacks/:feedbackId')
  @ApiOperation({ summary: 'Get feedback detail for clinic admin' })
  @ApiResponse({
    status: 200,
    description: 'Feedback detail',
    type: ClinicAdminFeedbackDetailResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Clinic admin or Feedback not found',
  })
  async getFeedbackDetail(
    @Param('id', ParseUUIDPipe) id: string, // This maps to clinicManagerId in the service call
    @Param('feedbackId', ParseUUIDPipe) feedbackId: string,
  ) {
    return this.clinicAdminsService.getFeedbackDetail(id, feedbackId);
  }
}
