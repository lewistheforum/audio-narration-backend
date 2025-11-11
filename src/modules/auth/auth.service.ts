import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { UserService } from '../user/user.service';
import { SocketGatewayService } from '../socket-gateway/socket-gateway.service';

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

  async googleLogin(user: any) {
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return { message: 'Google login successful', user };
  }
}
