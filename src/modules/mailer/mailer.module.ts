import { Module, forwardRef } from '@nestjs/common';
import { MailerService } from './mailer.service';
import { MailerController } from './mailer.controller';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { AccountsModule } from '../accounts/accounts.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    ConfigModule,
    forwardRef(() => AccountsModule), // Circular dependency with AccountsModule
  ],
  controllers: [MailerController],
  providers: [MailerService],
  exports: [MailerService], // Export for use in AuthModule
})
export class MailerModule {}
