import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FeedbackService } from './feedback.service';
import { Controller, Get, Param } from '@nestjs/common';
import { FeedbackResponseDto } from './dto/response-feedback.dto';
import { FeedbackAIResponseDto } from './dto/response-ai-feedback.dto';

@ApiTags('Reports')
@Controller('feedbacks')
// @UseGuards(JwtAuthGuard)
// @ApiBearerAuth('JWT-auth')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

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
  @ApiOperation({ summary: 'Label all feedbacks' })
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
}
