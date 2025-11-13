import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { UserService } from '../user/user.service';
import { SocketGatewayService } from '../socket-gateway/socket-gateway.service';
import { randomBytes } from 'crypto';
import { MESSAGES } from 'src/common/message';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private socketGatewayService: SocketGatewayService,
  ) {}

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.userService.findByEmail(email);

    if (user && (await bcrypt.compare(password, user.password))) {
      const payload = { sub: user.id, email: user.email };
      // Broadcast user online presence
      this.socketGatewayService.markUserOnline(String(user.id));
      return {
        data: {
          access_token: this.jwtService.sign(payload),
          userId: user.id,
        },
      };
    }

    throw new UnauthorizedException('Invalid credentials');
  }

  async googleLogin(googleUser: any): Promise<any> {
    if (!googleUser) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const { email, firstName, lastName } = googleUser;

    if (!email) {
      throw new UnauthorizedException(
        'Google account does not provide an email address',
      );
    }

    const existingUser = await this.userService.findByEmail(email);

    let userId: string;
    let userEmail: string;

    if (existingUser) {
      userId = existingUser.id;
      userEmail = existingUser.email;
    } else {
      const randomPassword = randomBytes(16).toString('hex');
      const displayName = [firstName, lastName].filter(Boolean).join(' ');
      const createdUser = await this.userService.create({
        email,
        password: randomPassword,
        name: displayName || email,
      });
      userId = createdUser.id;
      userEmail = createdUser.email;
    }

    const payload = { sub: userId, email: userEmail };
    const accessToken = this.jwtService.sign(payload);

    // Broadcast user online presence
    this.socketGatewayService.markUserOnline(String(userId));

    const baseUrl = process.env.GOOGLE_URL;

    if (!baseUrl) {
      throw new UnauthorizedException('Google redirect URL is not configured');
    }

    const redirectUrl = new URL(baseUrl);
    if (!redirectUrl.pathname.endsWith('/sso')) {
      redirectUrl.pathname = redirectUrl.pathname.replace(/\/$/, '') + '/sso';
    }
    redirectUrl.searchParams.set('account_id', userId);
    redirectUrl.searchParams.set('access_token', accessToken);

    return redirectUrl.toString();
  }
}
