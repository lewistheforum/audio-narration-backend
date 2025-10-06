import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { HealthModule } from './common/health/health.module';
import { MailerModule } from './modules/mailer/mailer.module';

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
      ssl: {
        rejectUnauthorized: false,
      },
    }),

    // import modules
    AuthModule,
    UserModule,
    HealthModule,
    MailerModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
