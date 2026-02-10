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
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiExtraModels, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import {
  CreateTransactionDto,
  PaymentHistoryResponseDto,
  PaymentResponseDto,
  SeepayCallbackDto,
  TransactionDetailDto,
  CreateSubscriptionTransactionDto,
  CreateNewSubscriptionDto,
  RenewSubscriptionDto,
  ChangePackageDto,
} from './dto';
import { ApiResponseData } from '../../common/decorators/api-response.decorator';
import { JwtAuthGuard } from '../auth/jwt.strategy';
import { User } from '../../common/decorators/user.decorator';
import { Account } from '../accounts/entities/accounts.entity';
import { AccountRole } from '../accounts/enums';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SeepayAuthGuard } from './guards/seepay-auth.guard';

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
   * @param prescriptionId Prescription ID
   * @param body Transaction creation DTO
   * @returns Created payment response with QR payload (if applicable)
   */
  @Post(':prescriptionId/qr')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('JWT-auth')
  @Roles(AccountRole.PATIENT, AccountRole.CLINIC_ADMIN, AccountRole.CLINIC_MANAGER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo QR thanh toán cho đơn thuốc' })
  @ApiResponseData({
    type: PaymentResponseDto,
    status: HttpStatus.CREATED,
    message: 'Payment QR created successfully',
  })
  async createQr(
    @Param('prescriptionId', ParseUUIDPipe) prescriptionId: string,
    @Body() body: Omit<CreateTransactionDto, 'prescriptionId'>,
  ) {
    const payment = await this.transactionsService.createDynamicQr({
      ...body,
      prescriptionId,
    });
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
  @ApiOperation({ summary: 'DEPRECATED: Use /renew instead. Tạo QR thanh toán cho đăng ký gói dịch vụ (Renewal Logic)' })
  @ApiResponseData({
    type: PaymentResponseDto,
    status: HttpStatus.CREATED,
    message: 'Subscription QR created successfully',
  })
  async createSubscriptionQr(@Body() body: CreateSubscriptionTransactionDto) {
    // Legacy support: Map to Renewal Logic (ignores body.serviceId if provided, strictly uses current subscription's service)
    const payment = await this.transactionsService.createRenewalQr(body.subscriptionId);
    return {
      data: payment,
      message: 'Subscription QR created successfully',
    };
  }

  @Post('subscription/new')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('JWT-auth')
  @Roles(AccountRole.CLINIC_ADMIN, AccountRole.CLINIC_MANAGER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo QR cho đăng ký mới (Onboarding)' })
  async createNewSubscriptionQr(@User() user: Account, @Body() body: CreateNewSubscriptionDto) {
    let clinicId = user._id;

    // If Manager, use Parent's Clinic ID
    if (user.role === AccountRole.CLINIC_MANAGER) {
      if (!user.parentId) {
        throw new BadRequestException('Manager account must have a parent Clinic Admin');
      }
      clinicId = user.parentId;
    }

    const duration = body.duration || 1;
    const payment = await this.transactionsService.createNewSubscriptionQr(clinicId, body.serviceId, duration);
    return {
      data: payment,
      message: 'New Subscription QR created successfully',
    };
  }

  @Post('subscription/renew')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('JWT-auth')
  @Roles(AccountRole.CLINIC_ADMIN, AccountRole.CLINIC_MANAGER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo QR gia hạn gói hiện tại' })
  async createRenewalQr(@User() user: Account) {
    let clinicId = user._id;

    // If Manager, use Parent's Clinic ID
    if (user.role === AccountRole.CLINIC_MANAGER) {
      if (!user.parentId) {
        throw new BadRequestException('Manager account must have a parent Clinic Admin');
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
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo QR đổi gói dịch vụ' })
  async createPackageChangeQr(@User() user: Account, @Body() body: ChangePackageDto) {
    let clinicId = user._id;

    // If Manager, use Parent's Clinic ID
    if (user.role === AccountRole.CLINIC_MANAGER) {
      if (!user.parentId) {
        throw new BadRequestException('Manager account must have a parent Clinic Admin');
      }
      clinicId = user.parentId;
    }

    const duration = body.duration || 1;
    const payment = await this.transactionsService.createPackageChangeQr(clinicId, body.targetServiceId, duration);
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
    const payment = await this.transactionsService.createVerificationQr(user._id);
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
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lấy tất cả lịch sử giao dịch (Chỉ Clinic Admin & Manager)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'clinicId', required: false, type: String })
  @ApiQuery({ name: 'senderAccountId', required: false, type: String })
  @ApiQuery({ name: 'fromDate', required: false, type: String, description: 'ISO date filter from (transaction_date)' })
  @ApiQuery({ name: 'toDate', required: false, type: String, description: 'ISO date filter to (transaction_date)' })
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

    if (user.role === AccountRole.CLINIC_ADMIN) {
      const clinicAdminId = await this.transactionsService.getClinicAdminIdByAccountId(user._id);
      if (clinicAdminId) {
        filterClinicId = clinicAdminId;
      }
    } else if (user.role === AccountRole.CLINIC_MANAGER) {
      if (!user.parentId) {
        throw new BadRequestException('Manager account has no parent clinic assigned');
      }
      const clinicAdminId = await this.transactionsService.getClinicAdminIdByAccountId(user.parentId);
      if (clinicAdminId) {
        filterClinicId = clinicAdminId;
      }
    }

    const { items, total } = await this.transactionsService.getAllPaymentHistory(
      Number(page),
      Number(limit),
      { clinicId: filterClinicId, senderAccountId, fromDate, toDate },
    );

    return {
      data: {
        items: items.map((item) => ({
          id: item.id,
          prescriptionId: item.prescriptionId,
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
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xem chi tiết giao dịch' })
  @ApiResponseData({ type: TransactionDetailDto, status: HttpStatus.OK, message: 'Transaction detail fetched successfully' })
  async getTransactionDetail(
    @Param('id', ParseUUIDPipe) id: string,
    @User() user: Account,
  ) {
    let filterClinicId: string | undefined;

    if (user.role === AccountRole.CLINIC_ADMIN) {
      const clinicAdminId = await this.transactionsService.getClinicAdminIdByAccountId(user._id);
      if (clinicAdminId) filterClinicId = clinicAdminId;
    } else if (user.role === AccountRole.CLINIC_MANAGER) {
      if (!user.parentId) {
        throw new BadRequestException('Manager account has no parent clinic assigned');
      }
      const clinicAdminId = await this.transactionsService.getClinicAdminIdByAccountId(user.parentId);
      if (clinicAdminId) filterClinicId = clinicAdminId;
    }

    const data = await this.transactionsService.getTransactionDetail(id, filterClinicId);
    return {
      data,
      message: 'Transaction detail fetched successfully',
    };
  }
}
