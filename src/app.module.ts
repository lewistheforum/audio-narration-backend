import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './modules/auth/auth.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { HealthModule } from './common/health/health.module';
import { MailerModule } from './modules/mailer/mailer.module';
import { SocketGatewayModule } from './modules/socket-gateway/socket-gateway.module';
import { ConversationModule } from './modules/conversations/conversation.module';
import { MessagesModule } from './modules/messages/messages.module';
import { PrescriptionsModule } from './modules/prescriptions/prescriptions.module';
import { Account } from './modules/accounts/entities/accounts.entity';

@Module({
  imports: [
    // config environment variables
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // PostgreSQL database configuration
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.POSTGRES_HOST || '',
      port: parseInt(process.env.POSTGRES_PORT || ''),
      username: process.env.POSTGRES_USERNAME || '',
      password: process.env.POSTGRES_PASSWORD || '',
      database: process.env.POSTGRES_DATABASE || '',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: true, // WARNING: Disable in production
      logging: false,
      ssl:
        process.env.POSTGRES_SSL === 'true'
          ? {
              rejectUnauthorized: false,
            }
          : false,
    }),

    // TypeORM feature for seeder access to Account repository
    TypeOrmModule.forFeature([Account]),

    // import modules
    AuthModule,
    AccountsModule,
    HealthModule,
    MailerModule,
    SocketGatewayModule,
    ConversationModule,
    MessagesModule,
    PrescriptionsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
