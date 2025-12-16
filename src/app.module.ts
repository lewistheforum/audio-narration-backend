import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './modules/auth/auth.module';
import { ClientModule } from './modules/client/client.module';
import { HealthModule } from './common/health/health.module';
import { MailerModule } from './modules/mailer/mailer.module';
import { SocketGatewayModule } from './modules/socket-gateway/socket-gateway.module';
import { ConversationModule } from './modules/conversations/conversation.module';
import { MessagesModule } from './modules/messages/messages.module';
import { ProfileModule } from './modules/profile/profile.module';
import { PrescriptionsModule } from './modules/prescriptions/prescriptions.module';
// import { AdminSeederService } from './common/seeders/admin-seeder.service';
import { User } from './modules/client/entities/accounts.entity';

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
      synchronize: true, // TEMPORARY: Disabled due to FK constraint issues. Reset DB with: DROP SCHEMA public CASCADE; CREATE SCHEMA public;
      logging: false,
      ssl:
        process.env.POSTGRES_SSL === 'true'
          ? {
            rejectUnauthorized: false,
          }
          : false,
    }),

    // TypeORM feature for seeder access to User repository
    TypeOrmModule.forFeature([User]),

    // import modules
    AuthModule,
    ClientModule,
    HealthModule,
    MailerModule,
    SocketGatewayModule,
    ConversationModule,
    MessagesModule,
    ProfileModule,
    PrescriptionsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule { }
