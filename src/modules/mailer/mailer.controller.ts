import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { MailerService } from './mailer.service';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MESSAGES } from 'src/common/message';
import { CreateMailerDto } from './dto/create-mailer.dto';
import { ApiResponseData } from 'src/common/decorators/api-response.decorator';
import { SendMailDataDto } from './dto/send-mail-data.dto';

@ApiTags('Mailer')
@Controller('mailer')
export class MailerController {
  constructor(private readonly mailerService: MailerService) {}

  @Post('send')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a transactional email' })
  @ApiBody({ type: CreateMailerDto })
  @ApiResponseData({
    type: SendMailDataDto,
    status: MESSAGES.statusCode.success,
    message: MESSAGES.successMessage.mailSendSuccess,
  })
  @ApiResponse({ status: 400, description: 'Bad Request. Invalid email format.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error. The email service failed to send the mail.' })
  async sendMail(@Body() createMailerDto: CreateMailerDto): Promise<{ data: any; message: string }> {
    const mailResult = await this.mailerService.sendMail(
      createMailerDto.targetMail,
    );
    
    return { data: mailResult, message: MESSAGES.successMessage.mailSendSuccess };
  }
}
