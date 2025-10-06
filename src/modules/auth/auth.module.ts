import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy, JwtAuthGuard } from './jwt.strategy';
import { User as PostgresUser } from '../user/entities/user.entity';
import { jwtConfig } from '../../config/jwt.config';
import { GoogleStrategy } from './google.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: () => jwtConfig,
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([PostgresUser]),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard, GoogleStrategy],
  exports: [AuthService, JwtStrategy, JwtAuthGuard, GoogleStrategy],
})
export class AuthModule {}
