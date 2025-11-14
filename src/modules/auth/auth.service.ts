import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { UserService } from '../user/user.service';
import { SocketGatewayService } from '../socket-gateway/socket-gateway.service';
import { randomBytes } from 'crypto';

/**
 * Authentication Service
 * Handles user authentication logic including standard login and OAuth
 */
@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private socketGatewayService: SocketGatewayService,
  ) {}

  /**
   * Standard email/password login
   * - Validates credentials against database
   * - Returns JWT token with user ID, email, and role
   * - Marks user as online via socket gateway
   */
  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;
    const user = await this.userService.findByEmail(email);

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user.id, email: user.email, role: user.role };
    this.socketGatewayService.markUserOnline(String(user.id));

    return {
      data: {
        access_token: this.jwtService.sign(payload),
        userId: user.id,
      },
    };
  }

  /**
   * Google OAuth login flow
   * - Only creates PATIENT accounts (business rule)
   * - Email is automatically verified for OAuth users
   * - Stores Google ID and profile picture
   * - Generates random password for OAuth users
   */
  async googleLogin(googleUser: any): Promise<any> {
    if (!googleUser) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const { googleId, email, firstName, lastName, picture } = googleUser;

    if (!email) {
      throw new UnauthorizedException(
        'Google account does not provide an email address',
      );
    }

    let user = await this.userService.findByEmail(email);
    let userId: string;
    let userEmail: string;

    if (user) {
      // Update existing user with Google data if not already set
      if (!user.googleId && googleId) {
        user.googleId = googleId;
        user.isOAuthUser = true;
        user.isEmailVerified = true;
        user.profilePicture = picture;
        await this.userService.updateUserEntity(user);
      }
      userId = user.id;
      userEmail = user.email;
    } else {
      // Create new patient account via Google OAuth
      const randomPassword = randomBytes(16).toString('hex');
      const displayName = [firstName, lastName].filter(Boolean).join(' ');
      
      const createdUser = await this.userService.createPatientViaOAuth({
        email,
        password: randomPassword,
        name: displayName || email,
        googleId,
        profilePicture: picture,
      });
      
      userId = createdUser.id;
      userEmail = createdUser.email;
    }

    user = await this.userService.findUserEntityById(userId);
    const payload = { sub: userId, email: userEmail, role: user.role };
    const accessToken = this.jwtService.sign(payload);

    this.socketGatewayService.markUserOnline(String(userId));

    // Return token data directly for backend testing
    return {
      access_token: accessToken,
      user: {
        id: userId,
        email: userEmail,
        name: user.name,
        role: user.role,
        isOAuthUser: user.isOAuthUser,
        googleId: user.googleId,
        isEmailVerified: user.isEmailVerified,
        profilePicture: user.profilePicture,
      },
    };
  }
}
