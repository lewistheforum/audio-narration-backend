import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ClinicLegalDocumentsService } from './clinic-legal-documents.service';
import { CreateClinicLegalDocumentDto } from './dto/create-clinic-legal-document.dto';
import { GenerateVerificationQrDto } from './dto/generate-verification-qr.dto';
import { PaymentResponseDto } from '../transactions/dto/payment-response.dto';
import { ClinicLegalDocument } from '../transactions/entities/clinic-legal-document.entity';
import { ApiResponseData } from 'src/common/decorators/api-response.decorator';
import { MESSAGES } from 'src/common/message';

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
		type: ClinicLegalDocument,
		status: HttpStatus.CREATED,
		message: 'Tạo hồ sơ pháp lý thành công',
	})
	async create(@Body() dto: CreateClinicLegalDocumentDto) {
		const doc = await this.clinicLegalDocumentsService.create(dto);
		return {
			statusCode: HttpStatus.CREATED,
			message: 'Tạo hồ sơ pháp lý thành công',
			data: doc,
		};
	}

	@Get(':id')
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: 'Get a clinic legal document by id' })
	@ApiResponseData({
		type: ClinicLegalDocument,
		status: HttpStatus.OK,
		message: 'Lấy hồ sơ pháp lý thành công',
	})
	async findOne(@Param('id', ParseUUIDPipe) id: string) {
		const doc = await this.clinicLegalDocumentsService.findOne(id);
		return {
			statusCode: HttpStatus.OK,
			message: 'Lấy hồ sơ pháp lý thành công',
			data: doc,
		};
	}

	@Post(':id/verification-qr')
	@HttpCode(HttpStatus.CREATED)
	@ApiOperation({
		summary: 'Generate a Seepay test QR to verify bank callback; marks verified on successful callback',
	})
	@ApiResponseData({
		type: PaymentResponseDto,
		status: HttpStatus.CREATED,
		message: MESSAGES.successMessage.paymentCreateSuccess,
	})
	async generateVerificationQr(
		@Param('id', ParseUUIDPipe) id: string,
		@Body() body: GenerateVerificationQrDto,
	) {
		const qr = await this.clinicLegalDocumentsService.generateVerificationQr(
			id,
			body,
		);
		return {
			statusCode: HttpStatus.CREATED,
			message: MESSAGES.successMessage.paymentCreateSuccess,
			data: qr,
		};
	}
}
