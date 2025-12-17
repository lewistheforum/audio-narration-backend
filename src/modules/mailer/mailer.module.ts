import { Module, forwardRef } from '@nestjs/common';
import { MailerService } from './mailer.service';
import { MailerController } from './mailer.controller';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { ClientModule } from '../client/client.module';
import { CodeVerification } from './entities/mailer.entity';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    ConfigModule,
    TypeOrmModule.forFeature([CodeVerification]),
    forwardRef(() => ClientModule), // Circular dependency with ClientModule
  ],
  controllers: [MailerController],
  providers: [MailerService],
  exports: [MailerService], // Export để dùng trong AuthModule
})
export class MailerModule {}
