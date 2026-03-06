import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ConversationService } from './conversation.service';
import {
  CreateConversationDto,
  UpdateConversationDto,
  ConversationResponseDto,
} from './dto';
import { JwtAuthGuard } from '../auth/jwt.strategy';

@ApiTags('Conversations')
@Controller('conversations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new conversation' })
  @ApiResponse({
    status: 201,
    description: 'Conversation created successfully',
    type: ConversationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid input data',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid token',
  })
  async create(
    @Body() createConversationDto: CreateConversationDto,
  ): Promise<ConversationResponseDto> {
    return this.conversationService.create(createConversationDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all conversations' })
  @ApiResponse({
    status: 200,
    description: 'List of conversations retrieved successfully',
    type: [ConversationResponseDto],
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid token',
  })
  async findAll(): Promise<ConversationResponseDto[]> {
    return this.conversationService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a conversation by ID' })
  @ApiParam({
    name: 'id',
    description: 'Conversation ID (UUID)',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'Conversation retrieved successfully',
    type: ConversationResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Conversation not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid token',
  })
  async findOne(@Param('id') id: string): Promise<ConversationResponseDto> {
    return this.conversationService.findOne(id);
  }

  @Get('participants/:participantId')
  @ApiOperation({ summary: 'Get conversations by participant ID' })
  @ApiParam({
    name: 'participantId',
    description: 'Participant ID (UUID)',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'Conversations retrieved successfully',
    type: [ConversationResponseDto],
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid token',
  })
  async findByParticipants(
    @Param('participantId') participantId: string,
  ): Promise<ConversationResponseDto[]> {
    return this.conversationService.findByParticipants([participantId]);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a conversation' })
  @ApiParam({
    name: 'id',
    description: 'Conversation ID (UUID)',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'Conversation updated successfully',
    type: ConversationResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Conversation not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid token',
  })
  async update(
    @Param('id') id: string,
    @Body() updateConversationDto: UpdateConversationDto,
  ): Promise<ConversationResponseDto> {
    return this.conversationService.update(id, updateConversationDto);
  }

  @Delete(':conversationId/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a conversation for a user' })
  @ApiParam({
    name: 'conversationId',
    description: 'Conversation ID (UUID)',
    type: 'string',
  })
  @ApiParam({ name: 'userId', description: 'User ID (UUID)', type: 'string' })
  @ApiResponse({
    status: 204,
    description: 'Conversation deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Conversation not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid token',
  })
  async delete(
    @Param('conversationId') conversationId: string,
    @Param('userId') userId: string,
  ): Promise<void> {
    return this.conversationService.delete(conversationId, userId);
  }

  // --- Account Fetching for Chat ---

  @Get('accounts/admins-chatlist')
  @ApiOperation({ summary: 'Get all admin and clinic admin accounts for chat' })
  @ApiResponse({
    status: 200,
    description: 'Accounts retrieved successfully',
  })
  async getAdminChatlist(): Promise<any[]> {
    return this.conversationService.getAdminChatlist();
  }

  @Get('accounts/clinic-admin-chatlist/:id/related')
  @ApiOperation({
    summary: 'Get the admin and all managers for a clinic admin',
  })
  @ApiParam({
    name: 'id',
    description: 'Clinic Admin Account ID (UUID)',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'Accounts retrieved successfully',
  })
  async getClinicAdminChatlist(
    @Param('id') clinicAdminId: string,
  ): Promise<any[]> {
    return this.conversationService.getClinicAdminChatlist(clinicAdminId);
  }

  @Get('accounts/clinic-manager-chatlist/:id/related')
  @ApiOperation({
    summary: 'Get clinic admin, staff, and doctors by clinic manager ID',
  })
  @ApiParam({
    name: 'id',
    description: 'Clinic Manager Account ID (UUID)',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'Related accounts retrieved successfully',
  })
  async getClinicManagerRelatedAccounts(
    @Param('id') managerId: string,
  ): Promise<any[]> {
    return this.conversationService.getClinicManagerRelatedAccounts(managerId);
  }

  @Get('accounts/staff-chatlist/:id/related')
  @ApiOperation({
    summary: 'Get clinic manager, other staff, and doctors by staff ID',
  })
  @ApiParam({
    name: 'id',
    description: 'Staff or Doctor Account ID (UUID)',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'Related accounts retrieved successfully',
  })
  async getStaffRelatedAccounts(@Param('id') staffId: string): Promise<any[]> {
    return this.conversationService.getStaffRelatedAccounts(staffId);
  }

  @Get('accounts/doctor-chatlist/:id/related')
  @ApiOperation({
    summary: 'Get other doctors, staff, and patients for doctor chatlist',
  })
  @ApiParam({
    name: 'id',
    description: 'Doctor Account ID (UUID)',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'Related accounts retrieved successfully',
  })
  async getDoctorRelatedAccounts(
    @Param('id') doctorId: string,
  ): Promise<any[]> {
    return this.conversationService.getDoctorChatlist(doctorId);
  }

  @Get('accounts/patient-chatlist/:id/related')
  @ApiOperation({
    summary: 'Get doctors that examined the patient by patient ID',
  })
  @ApiParam({
    name: 'id',
    description: 'Patient Account ID (UUID)',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'Related accounts retrieved successfully',
  })
  async getPatientRelatedAccounts(
    @Param('id') patientId: string,
  ): Promise<any[]> {
    return this.conversationService.getPatientChatlist(patientId);
  }
}
