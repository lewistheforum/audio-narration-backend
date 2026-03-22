import {
  Body,
  Controller,
  BadRequestException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
  Res,
} from '@nestjs/common';
import {
  getCurrentVietnamTime,
  getVietnamTimestamp,
} from '../../common/utils/date.util';
import { Response } from 'express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiExtraModels,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import {
  CreateTransactionDto,
  CreateTransactionBodyDto,
  PaymentHistoryResponseDto,
  PaymentResponseDto,
  SeepayCallbackDto,
  TransactionDetailDto,
  CreateSubscriptionTransactionDto,
  CreateNewSubscriptionDto,
  RenewSubscriptionDto,
  ChangePackageDto,
  ManagerRevenueReportDto,
} from './dto';
import { AllowExpiredSubscription } from '../../common/decorators/allow-expired-subscription.decorator';
import { ApiResponseData } from '../../common/decorators/api-response.decorator';
import { JwtAuthGuard } from '../auth/jwt.strategy';
import { User } from '../../common/decorators/user.decorator';
import { Account } from '../accounts/entities/accounts.entity';
import { AccountRole } from '../accounts/enums';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SeepayAuthGuard } from './guards/seepay-auth.guard';
import { CreateTransactionAtClinicDto } from './dto/create-transaction-at-clinic.dto';

/**
 * Transactions Controller
 *
 * Manages API endpoints for payment transactions, QR code generation,
 * webhooks, and history retrieval.
 */
@ApiTags('Transactions')
@Controller('transactions')
@ApiExtraModels(PaymentResponseDto)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) { }

  /**
   * Create payment QR for a specific prescription
   *
   * @param appointmentId Appointment ID
   * @param body Transaction creation DTO
   * @returns Created payment response with QR payload (if applicable)
   */
  @Post(':appointmentID/qr')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('JWT-auth')
  @Roles(
    AccountRole.PATIENT,
    AccountRole.CLINIC_ADMIN,
    AccountRole.CLINIC_MANAGER,
  )
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo QR thanh toán cho cuộc hẹn' })
  @ApiResponseData({
    type: PaymentResponseDto,
    status: HttpStatus.CREATED,
    message: 'Payment QR created successfully',
  })
  @ApiBody({
    type: CreateTransactionBodyDto,
    description: 'Transaction payload (appointmentId is provided from path)',
  })
  async createQr(
    @Param('appointmentID', ParseUUIDPipe) appointmentId: string,
    @Body() body: CreateTransactionBodyDto,
  ) {
    const payment = await this.transactionsService.createDynamicQr({
      ...body,
      appointmentId,
    });
    return {
      data: payment,
      message: 'Payment QR created successfully',
    };
  }

  /**
   * Create payment QR for a specific prescription
   *
   * @param prescriptionId Prescription ID
   * @param body Transaction creation DTO
   * @returns Created payment response with QR payload (if applicable)
   */
  @Post('qr/at-clinic')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('JWT-auth')
  @Roles(
    AccountRole.CLINIC_STAFF,
    AccountRole.CLINIC_MANAGER,
  )
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo QR thanh toán tại phòng khám' })
  @ApiResponseData({
    type: PaymentResponseDto,
    status: HttpStatus.CREATED,
    message: 'Payment QR created successfully',
  })
  @ApiBody({
    type: CreateTransactionAtClinicDto,
    description: 'Transaction payload (appointmentId is provided from body)',
  })
  async createStaffQrPayment(
    @Body() body: CreateTransactionAtClinicDto,
  ) {
    const payment = await this.transactionsService.createDynamicQrAtClinic(
      body,
    );
    return {
      data: payment,
      message: 'Payment QR created successfully',
    };
  }

  @Post('clinic/subscription-qr')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('JWT-auth')
  @Roles(AccountRole.CLINIC_ADMIN, AccountRole.CLINIC_MANAGER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'DEPRECATED: Use /renew instead. Tạo QR thanh toán cho đăng ký gói dịch vụ (Renewal Logic)',
  })
  @ApiResponseData({
    type: PaymentResponseDto,
    status: HttpStatus.CREATED,
    message: 'Subscription QR created successfully',
  })
  async createSubscriptionQr(
    @User() user: Account,
    @Body() body: CreateSubscriptionTransactionDto,
  ) {
    let clinicId = user._id;

    // If Manager, use Parent's Clinic ID
    if (user.role === AccountRole.CLINIC_MANAGER) {
      if (!user.parentId) {
        throw new BadRequestException(
          'Manager account must have a parent Clinic Admin',
        );
      }
      clinicId = user.parentId;
    }

    // Legacy support: Map to Renewal Logic (strictly uses current subscription's service)
    const payment = await this.transactionsService.createRenewalQr(
      clinicId,
      body.duration,
    );
    return {
      data: payment,
      message: 'Subscription QR created successfully',
    };
  }

  @Post('subscription/new')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('JWT-auth')
  @Roles(AccountRole.CLINIC_ADMIN, AccountRole.CLINIC_MANAGER)
  @AllowExpiredSubscription()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo QR cho đăng ký mới (Onboarding)' })
  async createNewSubscriptionQr(
    @User() user: Account,
    @Body() body: CreateNewSubscriptionDto,
  ) {
    let clinicId = user._id;

    // If Manager, use Parent's Clinic ID
    if (user.role === AccountRole.CLINIC_MANAGER) {
      if (!user.parentId) {
        throw new BadRequestException(
          'Manager account must have a parent Clinic Admin',
        );
      }
      clinicId = user.parentId;
    }

    const duration = body.duration || 1;
    const payment = await this.transactionsService.createNewSubscriptionQr(
      clinicId,
      body.serviceId,
      duration,
    );
    return {
      data: payment,
      message: 'New Subscription QR created successfully',
    };
  }

  @Post('subscription/renew')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('JWT-auth')
  @Roles(AccountRole.CLINIC_ADMIN, AccountRole.CLINIC_MANAGER)
  @AllowExpiredSubscription()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo QR gia hạn gói hiện tại' })
  async createRenewalQr(@User() user: Account) {
    let clinicId = user._id;

    // If Manager, use Parent's Clinic ID
    if (user.role === AccountRole.CLINIC_MANAGER) {
      if (!user.parentId) {
        throw new BadRequestException(
          'Manager account must have a parent Clinic Admin',
        );
      }
      clinicId = user.parentId;
    }

    const payment = await this.transactionsService.createRenewalQr(clinicId);
    return {
      data: payment,
      message: 'Renewal QR created successfully',
    };
  }

  @Post('subscription/change-package')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('JWT-auth')
  @Roles(AccountRole.CLINIC_ADMIN, AccountRole.CLINIC_MANAGER)
  @AllowExpiredSubscription()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo QR đổi gói dịch vụ' })
  async createPackageChangeQr(
    @User() user: Account,
    @Body() body: ChangePackageDto,
  ) {
    let clinicId = user._id;

    // If Manager, use Parent's Clinic ID
    if (user.role === AccountRole.CLINIC_MANAGER) {
      if (!user.parentId) {
        throw new BadRequestException(
          'Manager account must have a parent Clinic Admin',
        );
      }
      clinicId = user.parentId;
    }

    const duration = body.duration || 1;
    const payment = await this.transactionsService.createPackageChangeQr(
      clinicId,
      body.targetServiceId,
      duration,
    );
    return {
      data: payment,
      message: 'Package Change QR created successfully',
    };
  }

  /**
   * Create verification QR (10,000 VND) for clinic account verification
   *
   * @param user Current logged-in user
   * @returns Verification payment response
   */
  @Post('clinic/verification-qr')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo QR xác minh (10k) cho clinic user đang login' })
  @ApiResponseData({
    type: PaymentResponseDto,
    status: HttpStatus.CREATED,
    message: 'Verification QR created successfully',
  })
  async createVerificationQr(@User() user: Account) {
    const payment = await this.transactionsService.createVerificationQr(
      user._id,
    );
    return {
      data: payment,
      message: 'Verification QR created successfully',
    };
  }

  /**
   * Handle webhook callback from Seepay
   *
   * @param payload Webhook data from Seepay
   * @returns Payment response success confirmation
   */
  @Post('seepay/callback')
  @UseGuards(SeepayAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook callback từ Seepay' })
  @ApiBody({ type: SeepayCallbackDto })
  @ApiResponseData({
    type: PaymentResponseDto,
    status: HttpStatus.OK,
    message: 'Payment status updated successfully',
  })
  async handleCallback(@Body() payload: SeepayCallbackDto) {
    const payment = await this.transactionsService.handleCallback(payload);
    return {
      data: { orderCode: payment.orderCode },
      message: 'Payment status updated successfully',
    };
  }

  /**
   * Get all payment history with filters
   *
   * @param user Current logged-in user (Admin/Manager)
   * @param page Page number
   * @param limit Items per page
   * @param clinicId Optional clinic ID filter
   * @param senderAccountId Optional sender ID filter
   * @param fromDate From date filter
   * @param toDate To date filter
   * @returns Paginated payment history
   */
  @Get('history')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('JWT-auth')
  @Roles(AccountRole.CLINIC_ADMIN, AccountRole.CLINIC_MANAGER)
  @AllowExpiredSubscription()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Lấy tất cả lịch sử giao dịch (Chỉ Clinic Admin & Manager)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'clinicId', required: false, type: String })
  @ApiQuery({ name: 'senderAccountId', required: false, type: String })
  @ApiQuery({
    name: 'fromDate',
    required: false,
    type: String,
    description: 'ISO date filter from (transaction_date)',
  })
  @ApiQuery({
    name: 'toDate',
    required: false,
    type: String,
    description: 'ISO date filter to (transaction_date)',
  })
  @ApiResponseData({
    type: PaymentHistoryResponseDto,
    status: HttpStatus.OK,
    message: 'Payment history fetched successfully',
  })
  async getAllPaymentHistory(
    @User() user: Account,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('clinicId') clinicId?: string,
    @Query('senderAccountId') senderAccountId?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    let filterClinicId = clinicId;

    // FIX: transactions.clinic_id stores the Account ID (not cai._id).
    // Use Account ID directly as filter instead of looking up cai._id.
    if (user.role === AccountRole.CLINIC_ADMIN) {
      filterClinicId = user._id;
    } else if (user.role === AccountRole.CLINIC_MANAGER) {
      if (!user.parentId) {
        throw new BadRequestException(
          'Manager account has no parent clinic assigned',
        );
      }
      filterClinicId = user.parentId; // parent Clinic Admin's Account ID
    }

    const { items, total } =
      await this.transactionsService.getAllPaymentHistory(
        Number(page),
        Number(limit),
        { clinicId: filterClinicId, senderAccountId, fromDate, toDate },
      );

    return {
      data: {
        items: items.map((item) => ({
          id: item.id,
          appointmentId: item.appointmentId,
          amount: item.amount,
          currency: item.currency,
          status: item.status,
          gateway: item.gateway,
          referenceCode: item.referenceCode,
          transactionDate: item.transactionDate,
          clinicName: item.clinicName,
          senderFullName: item.senderFullName,
          senderGender: item.senderGender,
          senderDob: item.senderDob,
          createdAt: item.createdAt,
        })),
        total,
        page: Number(page),
        limit: Number(limit),
      },
      message: 'Payment history fetched successfully',
    };
  }

  /**
   * Get transaction details by ID
   *
   * @param id Transaction ID
   * @param user Current logged-in user
   * @returns Transaction detail object
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('JWT-auth')
  @Roles(AccountRole.CLINIC_ADMIN, AccountRole.CLINIC_MANAGER)
  @AllowExpiredSubscription()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xem chi tiết giao dịch' })
  @ApiResponseData({
    type: TransactionDetailDto,
    status: HttpStatus.OK,
    message: 'Transaction detail fetched successfully',
  })
  async getTransactionDetail(
    @Param('id', ParseUUIDPipe) id: string,
    @User() user: Account,
  ) {
    let filterClinicId: string | undefined;

    // FIX: transactions.clinic_id stores the Account ID (not cai._id).
    // Use Account ID directly as filter to match stored values.
    if (user.role === AccountRole.CLINIC_ADMIN) {
      filterClinicId = user._id;
    } else if (user.role === AccountRole.CLINIC_MANAGER) {
      if (!user.parentId) {
        throw new BadRequestException(
          'Manager account has no parent clinic assigned',
        );
      }
      filterClinicId = user.parentId; // parent Clinic Admin's Account ID
    }

    const data = await this.transactionsService.getTransactionDetail(
      id,
      filterClinicId,
    );
    return {
      data,
      message: 'Transaction detail fetched successfully',
    };
  }

  @Get('manager/revenue-report')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.CLINIC_MANAGER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Xem báo cáo doanh thu theo chi nhánh' })
  async getManagerRevenueReport(
    @User() user: Account,
    @Query() dto: ManagerRevenueReportDto,
  ) {
    const stats = await this.transactionsService.getManagerRevenueStats(
      user._id,
      dto,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'Lấy báo cáo doanh thu thành công',
      data: stats,
    };
  }

  @Get('manager/revenue-report/export')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.CLINIC_MANAGER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Xuất báo cáo doanh thu theo chi nhánh' })
  async exportManagerRevenueReport(
    @User() user: Account,
    @Query() dto: ManagerRevenueReportDto,
    @Res() res: Response,
  ) {
    const buffer = await this.transactionsService.exportManagerRevenueReport(
      user._id,
      dto,
    );

    const filename = `revenue_report_${user._id}_${getVietnamTimestamp()}.xlsx`;

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }
}
