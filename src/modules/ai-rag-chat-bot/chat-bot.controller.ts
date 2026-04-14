import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  HttpStatus,
  Request,
  Query,
  HttpCode,
} from '@nestjs/common';
import { AiRagChatBotService } from './chat-bot.service';
import { CreateAiConversationDto } from './dto/create-conversation.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { GetSchedulesDto } from '../schedules/dto/get-schedules.dto';
import { AppointmentResponseDto } from '../appointments/dto';
import { AiCreateAppointmentDto } from './dto/ai-create-appointment.dto';

@ApiTags('AI RAG Chat Bot')
@Controller('ai-conversations')
export class AiRagChatBotController {
  constructor(private readonly aiRagChatBotService: AiRagChatBotService) {}

  @Post(':userId')
  @ApiParam({
    name: 'userId',
    description: 'The ID of the user',
    type: 'string',
  })
  @ApiOperation({
    summary: 'Create a new conversation',
    description: 'Create a new conversation for a given user',
  })
  @ApiResponse({
    status: 201,
    description: 'Conversation created successfully',
  })
  async createConversation(
    @Param('userId') userId: string,
    @Body() createAiConversationDto: CreateAiConversationDto,
  ) {
    return this.aiRagChatBotService.createConversation(
      userId,
      createAiConversationDto,
    );
  }

  @Get(':conversationId/users/:userId/messages')
  @ApiOperation({
    summary: 'Get conversation messages',
    description:
      'Fetch all messages in a specific conversation for a given user',
  })
  @ApiParam({
    name: 'conversationId',
    description: 'The ID of the conversation',
    type: 'string',
  })
  @ApiParam({
    name: 'userId',
    description: 'The ID of the user',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'Conversation messages retrieved successfully',
  })
  async getMessages(
    @Param('conversationId') conversationId: string,
    @Param('userId') userId: string,
  ) {
    return this.aiRagChatBotService.getMessagesByConversationIdAndUserId(
      conversationId,
      userId,
    );
  }

  /**
   * Find Schedules of Clinic
   *
   * Retrieves a list of schedules based on filter criteria.
   * Implements role-based visibility logic provided by the service.
   *
   * Roles: CLINIC_MANAGER, CLINIC_STAFF, DOCTOR
   */
  @Get('clinic-schedules/:clinicId')
  @ApiOperation({ summary: 'Get doctor schedules list' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of schedules',
  })
  findClinicSchedules(
    @Request() req,
    @Param('clinicId') clinicId: string,
    @Query() query: GetSchedulesDto,
  ) {
    return this.aiRagChatBotService.findClinicSchedules(
      clinicId,
      req.user,
      query,
    );
  }

  /**
   * Find Schedules of Clinic
   *
   * Retrieves a list of schedules based on filter criteria.
   * Implements role-based visibility logic provided by the service.
   *
   * Roles: CLINIC_MANAGER, CLINIC_STAFF, DOCTOR
   */
  @Get('clinic-schedules-shift/:clinicId')
  @ApiOperation({ summary: 'Get doctor schedules list' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of schedules',
  })
  findClinicSchedulesShift(
    @Request() req,
    @Param('clinicId') clinicId: string,
    @Query() query: GetSchedulesDto,
  ) {
    return this.aiRagChatBotService.findClinicSchedulesShift(
      clinicId,
      req.user,
      query,
    );
  }

  /**
   * Find Schedules of Clinic
   *
   * Retrieves a list of schedules based on filter criteria.
   * Implements role-based visibility logic provided by the service.
   *
   * Roles: CLINIC_MANAGER, CLINIC_STAFF, DOCTOR
   */
  @Get('clinic-schedules-overall/:clinicId')
  @ApiOperation({ summary: 'Get doctor schedules list' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of schedules',
  })
  findClinicSchedulesOverall(
    @Request() req,
    @Param('clinicId') clinicId: string,
    @Query() query: GetSchedulesDto,
  ) {
    return this.aiRagChatBotService.findClinicSchedulesOverall(
      clinicId,
      req.user,
      query,
    );
  }

  @Get('clinic-manager')
  @ApiOperation({
    summary: 'Get all clinic manager accounts',
    description: 'Retrieve a list of all active clinic manager accounts',
  })
  @ApiResponse({
    status: 200,
    description: 'Clinic manager accounts retrieved successfully',
  })
  async getClinicManagers() {
    return this.aiRagChatBotService.findAllClinicManagers();
  }

  @Get('clinic-manager/search-by-doctor')
  @ApiOperation({
    summary: 'Search clinic managers by doctor name',
    description:
      'Retrieve clinic managers whose doctors have names matching the search query',
  })
  @ApiResponse({
    status: 200,
    description: 'Clinic managers retrieved successfully',
  })
  async getClinicManagersByDoctor(@Query('name') name: string) {
    return this.aiRagChatBotService.findClinicManagersByDoctorName(name);
  }

  @Get('clinic-manager/:managerId/services')
  @ApiOperation({
    summary: 'Get clinic services by manager ID',
    description:
      'Retrieve all services configured for a specific clinic manager',
  })
  @ApiParam({
    name: 'managerId',
    description: 'The ID of the clinic manager',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'Clinic services retrieved successfully',
  })
  async getClinicServices(@Param('managerId') managerId: string) {
    return this.aiRagChatBotService.getClinicServicesByManagerId(managerId);
  }

  @Get('clinic-managers-by-day')
  @ApiOperation({
    summary: 'Get clinic managers by work date',
    description:
      'Retrieve all clinic managers who have a work schedule on a specific date',
  })
  @ApiResponse({
    status: 200,
    description: 'Clinic managers retrieved successfully',
  })
  async getManagersByDay(@Query('date') date: string) {
    return this.aiRagChatBotService.findManagersByWorkDate(date);
  }

  /**
   * Staff create appointment with services
   *
   * Allows clinic staff to create appointments for existing patients
   * with selected services. This will create records in 3 tables:
   * appointments, appointment_package, and service_appointments
   *
   * @param req - Request object containing authenticated user
   * @param createDto - Appointment creation data with services
   * @returns Created appointment details
   */
  @Post('ai/create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create appointment for patient (Ai only)',
    description:
      'Ai creates an appointment for an existing patient with selected clinic services. This operation creates records in appointments, appointment_package, and service_appointments tables within a transaction to ensure data consistency.',
  })
  @ApiResponse({
    status: 201,
    description: 'Appointment created successfully',
    type: AppointmentResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid input data',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User is not a clinic staff member',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Staff information or patient not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Appointment time already booked',
  })
  async aiCreateAppointment(
    @Body() createDto: AiCreateAppointmentDto,
  ): Promise<AppointmentResponseDto> {
    return this.aiRagChatBotService.aiCreateAppointment(createDto);
  }
}
