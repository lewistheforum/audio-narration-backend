import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { AuthGuard } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User as PostgresUser } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly userService: UserService,
  ) {
    const jwtSecret = configService.get<string>('JWT_SECRET');
    console.log(`[JwtStrategy Constructor] Loading JWT_SECRET: ${jwtSecret}`);

    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not defined, JwtStrategy cannot be initialized.');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: { sub: string; email: string }) {
    const user = await this.userService.findUserEntityById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('Invalid token or user does not exist.');
    }

    return user;
  }
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
