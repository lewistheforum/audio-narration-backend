import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy, JwtAuthGuard } from './jwt.strategy';
import { User as PostgresUser } from '../user/entities/user.entity';
import { getJwtConfig } from '../../config/jwt.config';
import { GoogleStrategy } from './google.strategy';
import { UserModule } from '../user/user.module';
import { SocketGatewayModule } from '../socket-gateway/socket-gateway.module';
import { MailerModule } from '../mailer/mailer.module';

/**
 * Authentication Module
 * 
 * Provides authentication services including:
 * - Standard email/password login
 * - Google OAuth 2.0 authentication
 * - JWT token generation and validation
 * - Patient and clinic staff registration
 * - Email verification with 6-digit code
 * 
 * Dependencies:
 * - UserModule: For user CRUD operations
 * - SocketGatewayModule: For online status tracking
 * - MailerModule: For sending verification emails
 * - PassportModule: For authentication strategies
 * - JwtModule: For token generation and verification
 */
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: getJwtConfig,
      inject: [ConfigService],
    }),
    UserModule,
    SocketGatewayModule,
    MailerModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard, GoogleStrategy],
  exports: [AuthService, JwtStrategy, JwtAuthGuard, GoogleStrategy],
})
export class AuthModule {}
