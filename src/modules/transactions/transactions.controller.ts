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
import { CreateTransactionDto, PaymentHistoryResponseDto, PaymentResponseDto, SeepayCallbackDto } from './dto';
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

  @Post(':prescriptionId/va/:documentId/qr')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo QR thanh toán, truyền thêm ID hồ sơ pháp lý' })
  @ApiResponseData({
    type: PaymentResponseDto,
    status: HttpStatus.CREATED,
    message: 'Payment QR created successfully',
  })
  async createQrWithDocument(
    @Param('prescriptionId', ParseUUIDPipe) prescriptionId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Body() body: Omit<CreateTransactionDto, 'prescriptionId'>,
  ) {
    const payment = await this.transactionsService.createDynamicQr(
      {
        ...body,
        prescriptionId,
      },
      documentId,
    );
    return {
      data: payment,
      message: 'Payment QR created successfully',
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
  @ApiResponseData({
    type: PaymentHistoryResponseDto,
    status: HttpStatus.OK,
    message: 'Payment history fetched successfully',
  })
  async getAllPaymentHistory(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    const { items, total } = await this.transactionsService.getAllPaymentHistory(
      Number(page),
      Number(limit),
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
          createdAt: item.createdAt,
        })),
        total,
        page: Number(page),
        limit: Number(limit),
      },
      message: 'Payment history fetched successfully',
    };
  }
}
