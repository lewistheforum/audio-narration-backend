import {
  Controller,
  Get,
  Param,
  Query,
  ParseUUIDPipe,
  ParseIntPipe,
  DefaultValuePipe,
  Patch,
  Body,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { PatientsService } from './patients.service';
import { PatientResponseDto } from './dto/patient-response.dto';
import { PatientAppointmentStatisticsDto } from './dto/patient-appointment-statistics.dto';
import { BanPatientDto } from './dto/ban-patient.dto';

@ApiTags('Patients')
@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all patients' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'List of patients',
    type: [PatientResponseDto],
  })
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('search') search?: string,
  ) {
    return this.patientsService.findAll(page, limit, search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get patient by ID' })
  @ApiResponse({
    status: 200,
    description: 'Patient details',
    type: PatientResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Patient not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.patientsService.findOne(id);
  }
  @Get(':id/appointment-statistics')
  @ApiOperation({ summary: 'Get patient appointment statistics' })
  @ApiResponse({
    status: 200,
    description: 'Patient appointment statistics',
    type: PatientAppointmentStatisticsDto,
  })
  @ApiResponse({ status: 404, description: 'Patient not found' })
  async getAppointmentStatistics(@Param('id', ParseUUIDPipe) id: string) {
    return this.patientsService.getAppointmentStatistics(id);
  }

  @Patch(':id/ban')
  @ApiOperation({ summary: 'Ban a patient (3-strike rule)' })
  @ApiResponse({
    status: 200,
    description: 'Patient banned (or strike added)',
    type: PatientResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Patient not found' })
  async banPatient(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() banPatientDto: BanPatientDto,
  ) {
    return this.patientsService.banPatient(id, banPatientDto.banDescription);
  }

  @Patch(':id/unban')
  @ApiOperation({ summary: 'Unban a patient' })
  @ApiResponse({
    status: 200,
    description: 'Patient unbanned',
    type: PatientResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Patient not found' })
  async unbanPatient(@Param('id', ParseUUIDPipe) id: string) {
    return this.patientsService.unbanPatient(id);
  }
}
