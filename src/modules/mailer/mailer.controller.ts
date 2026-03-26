import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { MailerService } from './mailer.service';
import {
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { MESSAGES } from 'src/common/message';
import {
  CreateMailerDto,
  SendMailDataDto,
  SendAccountCredentialsDto,
} from './dto';
import { ApiResponseData } from 'src/common/decorators/api-response.decorator';
import { ForgotPasswordDto, ResendVerificationDto } from '../auth/dto';
import { AccountsService } from '../accounts/accounts.service';
import { JwtAuthGuard } from '../auth/jwt.strategy';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccountRole } from '../accounts/enums';

@ApiTags('Mailer')
@Controller('mailer')
export class MailerController {
  constructor(
    private mailerService: MailerService,
    private AccountsService: AccountsService,
  ) {}

  @Post('send')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a transactional email' })
  @ApiBody({ type: CreateMailerDto })
  @ApiResponseData({
    type: SendMailDataDto,
    status: MESSAGES.statusCode.success,
    message: MESSAGES.successMessage.mailSendSuccess,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request. Invalid email format.',
  })
  @ApiResponse({
    status: 500,
    description:
      'Internal Server Error. The email service failed to send the mail.',
  })
  async sendMail(
    @Body() createMailerDto: CreateMailerDto,
  ): Promise<{ data: any; message: string }> {
    const mailResult = await this.mailerService.sendMail(
      createMailerDto.targetMail,
    );

    return {
      data: mailResult,
      message: MESSAGES.successMessage.mailSendSuccess,
    };
  }

  /**
   * Send Verification Code
   * Generates a new verification code and sends it to user's email
   * Can be used for initial verification or resending code
   *
   * @param resendVerificationDto - User email
   * @returns Success message
   */
  @Post('send-verification-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send verification code to email' })
  @ApiBody({ type: ResendVerificationDto })
  @ApiResponse({
    status: 200,
    description: 'Verification code sent successfully',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'Email already verified' })
  async sendVerificationCode(
    @Body() resendVerificationDto: ResendVerificationDto,
  ): Promise<{ message: string }> {
    const { code, user } = await this.AccountsService.resendVerificationCode(
      resendVerificationDto.email,
    );

    // Send verification email
    await this.mailerService.sendVerificationCode(
      user.email,
      code,
      user.username,
    );

    return {
      message: MESSAGES.successMessage.verificationCodeSentSuccess,
    };
  }

  /**
   * Forgot Password - Request Reset Code
   * Initiates password reset process by sending reset code to user's email
   * Public endpoint - no authentication required
   *
   * @param forgotPasswordDto - User email
   * @returns Success message
   */
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset code' })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiResponse({ status: 200, description: 'Reset code sent to email' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({
    status: 400,
    description: 'OAuth users cannot reset password',
  })
  async forgotPassword(
    @Body() forgotPasswordDto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    const { code, user } = await this.AccountsService.initiatePasswordReset(
      forgotPasswordDto.email,
    );

    // Send password reset email
    await this.mailerService.sendPasswordResetCode(
      user.email,
      code,
      user.username,
    );

    return {
      message: MESSAGES.successMessage.passwordResetCodeSentSuccess,
    };
  }

  /**
   * Send Account Credentials
   * Notifies the user about their new account and provides login details.
   * Useful for walk-in patients created by staff.
   *
   * @param dto - Account credentials and patient info
   * @returns Success message
   */
  @Post('send-account-credentials')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AccountRole.CLINIC_STAFF)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Send account credentials to user email',
    description:
      'Notifies a new user about their account and provides login details (fullName, username, password, phone, dob).',
  })
  @ApiBody({ type: SendAccountCredentialsDto })
  @ApiResponse({
    status: 200,
    description: 'Account credentials sent successfully',
  })
  async sendAccountCredentials(
    @Body() dto: SendAccountCredentialsDto,
  ): Promise<{ message: string }> {
    await this.mailerService.sendAccountNotification({
      email: dto.email,
      fullName: dto.fullName,
      username: dto.username,
      password: dto.temporaryPassword,
      phone: dto.phone,
      dob: dto.dateOfBirth,
    });

    return {
      message: 'Account credentials sent successfully to ' + dto.email,
    };
  }
}
