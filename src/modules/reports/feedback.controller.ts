import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBody,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { FeedbackService } from './feedback.service';
import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Put,
  ParseUUIDPipe,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { FeedbackResponseDto } from './dto/response-feedback.dto';
import { FeedbackAIResponseDto } from './dto/response-ai-feedback.dto';
import { CreateFeedbackClinicDto } from './dto/create-feedback-clinic.dto';
import { CreateFeedbackDoctorDto } from './dto/create-feedback-doctor.dto';
import { UpdateFeedbackDto } from './dto/update-feedback.dto';
import { DoctorFeedbacksQueryDto } from './dto/doctor-feedbacks-query.dto';
import { DoctorFeedbacksResponseDto } from './dto/doctor-feedbacks-response.dto';
import { Feedback } from './entities/feedback.entity';
import { JwtAuthGuard } from '../auth/jwt.strategy';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccountRole } from '../accounts/enums';

/**
 * Feedback Controller
 *
 * Handles all feedback-related HTTP endpoints including:
 * - Creating feedback for clinics and doctors
 * - Labeling feedback with AI
 * - Retrieving feedback data
 */
@ApiTags('Reports')
@Controller('feedbacks')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  /**
   * Create Feedback for Clinic
   *
   * Creates a new feedback entry for a clinic.
   * Performs bad word detection and AI labeling.
   */
  @Post('clinic')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create feedback for a clinic' })
  @ApiBody({ type: CreateFeedbackClinicDto })
  @ApiResponse({
    status: 201,
    description: 'Feedback created successfully',
    type: FeedbackResponseDto,
  })
  @ApiResponse({
    status: 200,
    description: 'Toxic content detected - feedback not saved',
    schema: {
      type: 'object',
      properties: {
        is_toxic: { type: 'boolean', example: true },
        detection: {
          type: 'object',
          description: 'Bad word detection result from AI',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid input data',
  })
  async createFeedbackForClinic(
    @Body() dto: CreateFeedbackClinicDto,
  ): Promise<FeedbackResponseDto | { is_toxic: true; detection: any }> {
    const result = await this.feedbackService.createFeedbackForClinic(dto);

    // Check if result is a toxic detection response
    if ('is_toxic' in result && result.is_toxic) {
      return result;
    }

    return new FeedbackResponseDto(result as Feedback);
  }

  /**
   * Create Feedback for Doctor
   *
   * Creates a new feedback entry for a doctor.
   * Requires both clinicId and doctorId.
   * Performs bad word detection and AI labeling.
   */
  @Post('doctor')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create feedback for a doctor' })
  @ApiBody({ type: CreateFeedbackDoctorDto })
  @ApiResponse({
    status: 201,
    description: 'Feedback created successfully',
    type: FeedbackResponseDto,
  })
  @ApiResponse({
    status: 200,
    description: 'Toxic content detected - feedback not saved',
    schema: {
      type: 'object',
      properties: {
        is_toxic: { type: 'boolean', example: true },
        detection: {
          type: 'object',
          description: 'Bad word detection result from AI',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid input data',
  })
  async createFeedbackForDoctor(
    @Body() dto: CreateFeedbackDoctorDto,
  ): Promise<FeedbackResponseDto | { is_toxic: true; detection: any }> {
    const result = await this.feedbackService.createFeedbackForDoctor(dto);

    // Check if result is a toxic detection response
    if ('is_toxic' in result && result.is_toxic) {
      return result;
    }

    return new FeedbackResponseDto(result as Feedback);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update feedback' })
  @ApiBody({ type: UpdateFeedbackDto })
  @ApiResponse({
    status: 200,
    description: 'Feedback updated successfully',
    type: FeedbackResponseDto,
  })
  @ApiResponse({
    status: 200,
    description: 'Toxic content detected - feedback not updated',
    schema: {
      type: 'object',
      properties: {
        is_toxic: { type: 'boolean', example: true },
        detection: {
          type: 'object',
          description: 'Bad word detection result from AI',
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Update time limit exceeded',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Feedback not found',
  })
  async updateFeedback(
    @Param('id') id: string,
    @Body() dto: UpdateFeedbackDto,
  ): Promise<FeedbackResponseDto | { is_toxic: true; detection: any }> {
    const result = await this.feedbackService.updateFeedback(id, dto);

    // Check if result is a toxic detection response
    if ('is_toxic' in result && result.is_toxic) {
      return result;
    }

    return new FeedbackResponseDto(result as Feedback);
  }

  @Get('label-full')
  @ApiOperation({ summary: 'Label all feedbacks' })
  @ApiResponse({
    status: 200,
    description: 'List of feedbacks retrieved successfully',
    type: [FeedbackResponseDto],
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid token',
  })
  async labelAllFeedback(): Promise<FeedbackResponseDto[]> {
    await this.feedbackService.labelFeedbacks();
    const feedbacks = await this.feedbackService.findAllFeedbacks();
    return feedbacks.map((feedback) => new FeedbackResponseDto(feedback));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get feedbacks by id' })
  @ApiResponse({
    status: 200,
    description: 'List of feedbacks retrieved successfully',
    type: [FeedbackAIResponseDto],
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid token',
  })
  async getFeedbacks(
    @Param('id') id: string,
  ): Promise<FeedbackAIResponseDto[]> {
    const feedbacks = await this.feedbackService.findAllFeedbacksById(id);
    const result = feedbacks.map(
      (feedback) => new FeedbackAIResponseDto(feedback),
    );
    return result;
  }

  /**
   * Get Doctor's Feedbacks
   *
   * Allows doctors to view paginated feedbacks from patients about themselves.
   * Includes patient info, appointment info, ratings, and statistics.
   */
  @Get('doctor/me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.DOCTOR)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get doctor feedbacks',
    description:
      'Retrieves paginated feedbacks for the authenticated doctor. ' +
      'Includes patient information, appointment details, rating statistics, and distribution. ' +
      'Supports pagination, sorting (by date or rating), filtering by minimum rating, and search in description.',
  })
  @ApiResponse({
    status: 200,
    description: 'Feedbacks retrieved successfully',
    type: DoctorFeedbacksResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User is not a doctor',
  })
  async getDoctorFeedbacks(
    @Request() req: any,
    @Query() query: DoctorFeedbacksQueryDto,
  ): Promise<DoctorFeedbacksResponseDto> {
    const doctorId = req.user._id;
    return this.feedbackService.getDoctorFeedbacks(doctorId, query);
  }

  @Get('doctor/:doctorId')
  @ApiOperation({ summary: 'Get feedbacks by doctor id' })
  @ApiResponse({
    status: 200,
    description: 'List of feedbacks retrieved successfully',
    type: [FeedbackAIResponseDto],
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid token',
  })
  async getFeedbacksByDoctorId(
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
  ): Promise<FeedbackAIResponseDto[]> {
    const feedbacks =
      await this.feedbackService.findFeedbacksByDoctorId(doctorId);
    return feedbacks.map((feedback) => new FeedbackAIResponseDto(feedback));
  }

  @Post('label/:id')
  @ApiOperation({ summary: 'Label all feedbacks' })
  @ApiResponse({
    status: 200,
    description: 'List of feedbacks retrieved successfully',
    type: [FeedbackResponseDto],
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid token',
  })
  async labelFeedbackById(
    @Param('id') id: string,
  ): Promise<FeedbackResponseDto> {
    const feedback = await this.feedbackService.labelFeedbackById(id);
    return new FeedbackResponseDto(feedback);
  }

  @Get('admin/:adminId/managers-feedbacks')
  @ApiOperation({
    summary:
      'Get clinic manager list by clinic admin id and all feedback in each clinic manager',
  })
  @ApiResponse({
    status: 200,
    description:
      'List of clinic managers and their feedbacks retrieved successfully',
  })
  async getClinicManagersFeedbacksByAdminId(
    @Param('adminId', ParseUUIDPipe) adminId: string,
  ) {
    const result =
      await this.feedbackService.getClinicManagersFeedbacksByAdminId(adminId);
    return result; // Depending on frontend needs, this could map feedbacks through FeedbackAIResponseDto
  }
}
