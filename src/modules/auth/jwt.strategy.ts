import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { AuthGuard } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Account } from '../accounts/entities/accounts.entity';
import { AccountsService } from '../accounts/accounts.service';

/**
 * JWT Authentication Strategy
 * 
 * Validates JWT tokens and extracts user information for protected routes
 * 
 * Token Flow:
 * 1. Extract JWT from Authorization Bearer header
 * 2. Verify token signature and expiration
 * 3. Retrieve user from database using token payload
 * 4. Attach full user entity to request for role-based access control
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly AccountsService: AccountsService,
  ) {
    const jwtSecret = configService.get<string>('JWT_SECRET');

    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not defined in environment variables');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  /**
   * Validate JWT Payload
   * 
   * Retrieves user from database and validates their existence
   * The user entity is attached to the request object for downstream use
   * 
   * @param payload - JWT payload containing: sub (userId), email, role
   * @returns Full user entity with all fields including role
   * @throws UnauthorizedException if user not found or invalid token
   */
  async validate(payload: { sub: string; email: string; role?: string }): Promise<Account> {
    const user = await this.AccountsService.findAccountEntityById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('Invalid token or user does not exist');
    }

    return user;
  }
}

/**
 * JWT Authentication Guard
 * 
 * Applies JWT strategy to protect routes
 * Usage: @UseGuards(JwtAuthGuard)
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') { }
