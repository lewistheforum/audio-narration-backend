import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { HealthModule } from './common/health/health.module';
import { MailerModule } from './modules/mailer/mailer.module';
import { SocketGatewayModule } from './modules/socket-gateway/socket-gateway.module';
import { ConversationModule } from './modules/conversations/conversation.module';
import { MessagesModule } from './modules/messages/messages.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ClinicLegalDocumentsModule } from './modules/clinic-legal-documents/clinic-legal-documents.module';

@Module({
  imports: [
    // config environment variables
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // config MongoDB with Mongoose
    // MongooseModule.forRoot(
    //   process.env.MONGO_URI || 'mongodb://localhost:27017',
    //   {
    //     dbName: process.env.MONGO_DATABASE || 'test_capstone',
    //   },
    // ),

    // config PostgreSQL with TypeOrm
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.POSTGRES_HOST || '',
      port: parseInt(process.env.POSTGRES_PORT || ''),
      username: process.env.POSTGRES_USERNAME || '',
      password: process.env.POSTGRES_PASSWORD || '',
      database: process.env.POSTGRES_DATABASE || '',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: process.env.NODE_ENV !== 'production',
      logging: false,
      ssl:
        process.env.POSTGRES_SSL === 'true'
          ? {
              rejectUnauthorized: false,
            }
          : false,
    }),

    // import modules
    AuthModule,
    UserModule,
    HealthModule,
    MailerModule,
    SocketGatewayModule,
    ConversationModule,
    MessagesModule,
    PaymentsModule,
    ClinicLegalDocumentsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
