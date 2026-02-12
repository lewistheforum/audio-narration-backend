import { Controller, Post, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SubscriptionCronService } from './subscription-cron.service';
import { JwtAuthGuard } from '../auth/jwt.strategy';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccountRole } from '../accounts/enums';

/**
 * Subscription Internal Controller
 *
 * Internal API endpoints for subscription management operations.
 * Access restricted to ADMIN role only.
 */
@ApiTags('Internal - Subscriptions')
@Controller('internal/subscriptions')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SubscriptionInternalController {
  constructor(private readonly subscriptionCronService: SubscriptionCronService) {}

  /**
   * Manual Trigger for Daily Subscription Sweeper
   *
   * Force execution of the daily sweeper logic without waiting for the midnight schedule.
   * Useful for:
   * - Development testing and debugging
   * - Admin-initiated emergency sweep
   * - Recovery from failed scheduled cron runs
   *
   * @returns Execution summary with statistics from both phases
   */
  @Post('trigger-daily-sweep')
  @HttpCode(HttpStatus.OK)
  @Roles(AccountRole.ADMIN)
  @ApiOperation({
    summary: 'Manually trigger daily subscription sweeper',
    description:
      'Force execution of subscription expiration processing and notifications. Admin only.',
  })
  @ApiResponse({
    status: 200,
    description: 'Sweeper executed successfully',
    schema: {
      example: {
        success: true,
        message: 'Daily subscription sweeper executed successfully',
        data: {
          phase1: {
            emailsSent: 45,
            emailsFailed: 2,
          },
          phase2: {
            renewalsApplied: 12,
            subscriptionsExpired: 8,
            errors: 0,
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing authentication token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User does not have ADMIN role',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error during sweeper execution',
  })
  async triggerDailySweep(): Promise<{
    success: boolean;
    message: string;
    data: {
      phase1: { emailsSent: number; emailsFailed: number };
      phase2: { renewalsApplied: number; subscriptionsExpired: number; errors: number };
    };
  }> {
    const result = await this.subscriptionCronService.handleDailySweeper();

    return {
      success: true,
      message: 'Daily subscription sweeper executed successfully',
      data: result,
    };
  }
}
