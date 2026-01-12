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
import { ClinicsLegalDocuments } from '../accounts/entities/clinics_legal_documents.entity';
import { ApiResponseData } from 'src/common/decorators/api-response.decorator';

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
		type: ClinicsLegalDocuments,
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
}
