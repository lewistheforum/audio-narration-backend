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
} from '@nestjs/common';
import { ApiBody, ApiExtraModels, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import {
  CreateTransactionDto,
  PaymentHistoryResponseDto,
  PaymentResponseDto,
  SeepayCallbackDto,
  TransactionDetailDto,
} from './dto';
import { ApiResponseData } from '../../common/decorators/api-response.decorator';

@ApiTags('Transactions')
@Controller('transactions')
@ApiExtraModels(PaymentResponseDto)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

//   @Post(':prescriptionId/qr')
//   @HttpCode(HttpStatus.CREATED)
//   @ApiOperation({ summary: 'Tạo QR thanh toán cho đơn thuốc' })
//   @ApiResponseData({
//     type: PaymentResponseDto,
//     status: HttpStatus.CREATED,
//     message: 'Payment QR created successfully',
//   })
//   async createQr(
//     @Param('prescriptionId', ParseUUIDPipe) prescriptionId: string,
//     @Body() body: Omit<CreateTransactionDto, 'prescriptionId'>,
//   ) {
//     const payment = await this.transactionsService.createDynamicQr({
//       ...body,
//       prescriptionId,
//     });
//     return {
//       data: payment,
//       message: 'Payment QR created successfully',
//     };
//   }

  @Post(':prescriptionId/clinic/:clinicId/qr')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo QR thanh toán, truy vấn VA theo clinicId' })
  @ApiResponseData({
    type: PaymentResponseDto,
    status: HttpStatus.CREATED,
    message: 'Payment QR created successfully',
  })
  async createQrForPrescription(
    @Param('prescriptionId', ParseUUIDPipe) prescriptionId: string,
    @Param('clinicId', ParseUUIDPipe) clinicId: string,
    @Body() body: Omit<CreateTransactionDto, 'prescriptionId' | 'clinicId'>,
  ) {
    const payment = await this.transactionsService.createDynamicQr({
      ...body,
      clinicId,
      prescriptionId,
    });
    return {
      data: payment,
      message: 'Payment QR created successfully',
    };
  }

  @Post('clinic/:clinicId/verification-qr')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo QR xác minh (10k) theo clinicId' })
  @ApiResponseData({
    type: PaymentResponseDto,
    status: HttpStatus.CREATED,
    message: 'Verification QR created successfully',
  })
  async createVerificationQr(@Param('clinicId', ParseUUIDPipe) clinicId: string) {
    const payment = await this.transactionsService.createVerificationQr(clinicId);
    return {
      data: payment,
      message: 'Verification QR created successfully',
    };
  }

  @Post('seepay/callback')
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

  @Get('history')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lấy tất cả lịch sử giao dịch' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'clinicId', required: false, type: String })
  @ApiQuery({ name: 'senderAccountId', required: false, type: String })
  @ApiQuery({ name: 'fromDate', required: false, type: String, description: 'ISO date filter from (transaction_date)'} )
  @ApiQuery({ name: 'toDate', required: false, type: String, description: 'ISO date filter to (transaction_date)' })
  @ApiResponseData({
    type: PaymentHistoryResponseDto,
    status: HttpStatus.OK,
    message: 'Payment history fetched successfully',
  })
  async getAllPaymentHistory(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('clinicId') clinicId?: string,
    @Query('senderAccountId') senderAccountId?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    const { items, total } = await this.transactionsService.getAllPaymentHistory(
      Number(page),
      Number(limit),
      { clinicId, senderAccountId, fromDate, toDate },
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

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xem chi tiết giao dịch' })
  @ApiResponseData({ type: TransactionDetailDto, status: HttpStatus.OK, message: 'Transaction detail fetched successfully' })
  async getTransactionDetail(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.transactionsService.getTransactionDetail(id);
    return {
      data,
      message: 'Transaction detail fetched successfully',
    };
  }
}
