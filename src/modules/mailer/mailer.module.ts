import { Module, forwardRef } from '@nestjs/common';
import { MailerService } from './mailer.service';
import { MailerController } from './mailer.controller';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { AccountsModule } from '../accounts/accounts.module';
import { CodeVerification } from './entities/mailer.entity';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    ConfigModule,
    TypeOrmModule.forFeature([CodeVerification]),
    forwardRef(() => AccountsModule), // Circular dependency with AccountsModule
  ],
  controllers: [MailerController],
  providers: [MailerService],
  exports: [MailerService], // Export for use in AuthModule
})
export class MailerModule {}
