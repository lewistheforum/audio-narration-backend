import { ApiOperation, ApiResponse, ApiTags, ApiBody } from '@nestjs/swagger';
import { FeedbackService } from './feedback.service';
import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FeedbackResponseDto } from './dto/response-feedback.dto';
import { FeedbackAIResponseDto } from './dto/response-ai-feedback.dto';
import { CreateFeedbackClinicDto } from './dto/create-feedback-clinic.dto';
import { CreateFeedbackDoctorDto } from './dto/create-feedback-doctor.dto';
import { Feedback } from './entities/feedback.entity';

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
// @UseGuards(JwtAuthGuard)
// @ApiBearerAuth('JWT-auth')
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
}
