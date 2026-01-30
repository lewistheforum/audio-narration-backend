import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { buildTypeOrmOptions } from './config/typeorm.config';
import { AuthModule } from './modules/auth/auth.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { HealthModule } from './common/health/health.module';
import { MailerModule } from './modules/mailer/mailer.module';
import { SocketGatewayModule } from './modules/socket-gateway/socket-gateway.module';
import { ConversationModule } from './modules/conversations/conversation.module';
import { MessagesModule } from './modules/messages/messages.module';
import { PrescriptionsModule } from './modules/prescriptions/prescriptions.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { BlogsModule } from './modules/blogs/blogs.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { SchedulesModule } from './modules/schedules/schedules.module';
import { ReportsModule } from './modules/reports/reports.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { ClinicLegalDocumentsModule } from './modules/clinic-legal-documents/clinic-legal-documents.module';
import { ClinicServicesModule } from './modules/clinic-services/clinic-services.module';
import { ServiceConfigsModule } from './modules/service-configs/service-configs.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { AiModule } from './modules/ai/ai.module';
import { SeedersModule } from './common/seeders/seeders.module';
import { AdminModule } from './modules/admin/admin.module';
import { Account } from './modules/accounts/entities/accounts.entity';

@Module({
  imports: [
    // config environment variables
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // PostgreSQL database configuration
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => buildTypeOrmOptions(config),
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
    NotificationsModule,
    BlogsModule,
    SubscriptionsModule,
    SchedulesModule,
    ReportsModule,
    TransactionsModule,
    ClinicLegalDocumentsModule,
    ClinicServicesModule,
    ServiceConfigsModule,
    AppointmentsModule,
    AiModule,
    SeedersModule,
    AdminModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
