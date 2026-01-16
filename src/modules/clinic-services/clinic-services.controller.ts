import {
    Body,
    Controller,
    Get,
    Param,
    Patch,
    Post,
    Put,
    ParseUUIDPipe,
    UsePipes,
    ValidationPipe,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ClinicServicesService } from './clinic-services.service';
import { CreateClinicServiceCategoryDto } from './dto/create-clinic-service-category.dto';
import { CreateClinicServiceDto } from './dto/create-clinic-service.dto';
import { UpdateClinicServiceDto } from './dto/update-clinic-service.dto';
import { UpdateClinicServiceStatusDto } from './dto/update-clinic-service-status.dto';
import { ClinicServiceCategory, ClinicService } from './entities';

@ApiTags('Clinic Services')
@Controller('clinic-services')
export class ClinicServicesController {
    constructor(private readonly clinicServicesService: ClinicServicesService) { }

    @Post('/categories')
    @ApiOperation({ summary: 'Create a new clinic service category' })
    @ApiResponse({
        status: 201,
        description: 'The category has been successfully created.',
        type: ClinicServiceCategory,
    })
    @UsePipes(new ValidationPipe({ whitelist: true }))
    createCategory(
        @Body() createClinicServiceCategoryDto: CreateClinicServiceCategoryDto,
    ): Promise<ClinicServiceCategory> {
        return this.clinicServicesService.createCategory(
            createClinicServiceCategoryDto,
        );
    }

    @Post()
    @ApiOperation({ summary: 'Create a new clinic service' })
    @ApiResponse({
        status: 201,
        description: 'The service has been successfully created.',
        type: ClinicService,
    })
    @UsePipes(new ValidationPipe({ whitelist: true }))
    createService(
        @Body() createClinicServiceDto: CreateClinicServiceDto,
    ): Promise<ClinicService> {
        return this.clinicServicesService.createService(createClinicServiceDto);
    }

    @Get('/:id')
    @ApiOperation({ summary: 'Get a clinic service by ID' })
    @ApiResponse({
        status: 200,
        description: 'The service has been successfully retrieved.',
        type: ClinicService,
    })
    getServiceById(
        @Param('id', ParseUUIDPipe) id: string,
    ): Promise<ClinicService> {
        return this.clinicServicesService.getServiceById(id);
    }

    @Put('/:id')
    @ApiOperation({ summary: 'Update a clinic service' })
    @ApiResponse({
        status: 200,
        description: 'The service has been successfully updated.',
        type: ClinicService,
    })
    @UsePipes(new ValidationPipe({ whitelist: true }))
    updateService(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() updateClinicServiceDto: UpdateClinicServiceDto,
    ): Promise<ClinicService> {
        return this.clinicServicesService.updateService(id, updateClinicServiceDto);
    }

    @Patch('/:id/status')
    @ApiOperation({ summary: 'Update a clinic service status' })
    @ApiResponse({
        status: 200,
        description: 'The service status has been successfully updated.',
        type: ClinicService,
    })
    @UsePipes(new ValidationPipe({ whitelist: true }))
    updateServiceStatus(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() updateClinicServiceStatusDto: UpdateClinicServiceStatusDto,
    ): Promise<ClinicService> {
        return this.clinicServicesService.updateServiceStatus(
            id,
            updateClinicServiceStatusDto.isActive,
        );
    }
}
