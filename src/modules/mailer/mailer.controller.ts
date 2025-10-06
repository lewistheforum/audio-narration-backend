import { Controller, Post, Body } from '@nestjs/common';
import { MailerService } from './mailer.service';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { MESSAGES } from 'src/common/message';
import { CreateMailerDto } from './dto/create-mailer.dto';

@Controller('mailer')
export class MailerController {
  constructor(private readonly mailerService: MailerService) {}

  @Post('send')
  @ApiOperation({ summary: 'Send mail' })
  @ApiResponse({
    status: MESSAGES.statusCode.success,
    description: 'Mail sent successfully.',
  })
  async sendMail(@Body() body: CreateMailerDto) {
    const mail = await this.mailerService.sendMail(body.targetMail);
    return { data: mail, message: MESSAGES.successMessage.mailSendSuccess };
  }
}
