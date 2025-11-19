import { Module } from '@nestjs/common';
import { MailerService } from './mailer.service';
import { MailerController } from './mailer.controller';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  controllers: [MailerController],
  providers: [MailerService],
  exports: [MailerService], // Export để dùng trong AuthModule và UserModule
})
export class MailerModule {}
