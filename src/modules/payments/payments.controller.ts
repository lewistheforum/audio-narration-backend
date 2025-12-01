import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiTags,
  ApiBody,
  ApiQuery,
  ApiExtraModels,
} from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { 
  CreatePaymentDto, 
  SeepayCallbackDto, 
  PaymentResponseDto,
  PaymentHistoryResponseDto
} from './dto';
import { MESSAGES } from 'src/common/message';
import { ApiResponseData } from 'src/common/decorators/api-response.decorator';

@ApiTags('Payments')
@Controller('payments')
@ApiExtraModels(PaymentResponseDto)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post(':prescriptionId/qr')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo QR thanh toán cho đơn thuốc' })
  @ApiResponseData({
    type: PaymentResponseDto,
    status: MESSAGES.statusCode.created,
    message: MESSAGES.successMessage.paymentCreateSuccess,
  })
  async createQr(
    @Param('prescriptionId', ParseUUIDPipe) prescriptionId: string,
    @Body() body: Omit<CreatePaymentDto, 'prescriptionId'>,
  ) {
    const payment = await this.paymentsService.createDynamicQr({
      ...body,
      prescriptionId,
    });
    return {
      data: payment,
      message: MESSAGES.successMessage.paymentCreateSuccess,
    };
  }

  @Post('seepay/callback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook callback từ Seepay' })
  @ApiBody({ type: SeepayCallbackDto })
  @ApiResponseData({
    type: PaymentResponseDto,
    status: MESSAGES.statusCode.success,
    message: MESSAGES.successMessage.paymentUpdateSuccess,
  })
  async handleCallback(@Body() payload: SeepayCallbackDto) {
    const payment = await this.paymentsService.handleCallback(payload);
    return {
      data: { orderCode: payment.orderCode },
      message: MESSAGES.successMessage.paymentUpdateSuccess,
    };
  }

  @Get('history')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lấy tất cả lịch sử giao dịch' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponseData({
    type: PaymentHistoryResponseDto,
    status: MESSAGES.statusCode.success,
    message: 'Payment history fetched successfully',
  })
  async getAllPaymentHistory(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    const { items, total } = await this.paymentsService.getAllPaymentHistory(
      Number(page),
      Number(limit),
    );

    return {
      data: {
        items: items.map((item) => ({
          id: item.id,
          prescriptionId: item.prescriptionId,
          orderCode: item.orderCode,
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
