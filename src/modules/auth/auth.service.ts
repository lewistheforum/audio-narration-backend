import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { UserService } from '../user/user.service';
import { SocketGatewayService } from '../socket-gateway/socket-gateway.service';
import { randomBytes } from 'crypto';
import { UserResponseDto } from '../user/dto/user-response.dto';
import { MESSAGES } from 'src/common/message';

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
   * - Checks user status (bans, inactive accounts)
   * - Returns JWT token with user ID, email, role, and complete user info
   * - Marks user as online via socket gateway
   */
  async login(loginDto: LoginDto): Promise<{
    data: {
      access_token: string;
      userId: string;
      user: UserResponseDto;
    };
  }> {
    const { email, password } = loginDto;
    const user = await this.userService.findByEmail(email);

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException(MESSAGES.failMessage.invalidCredentials);
    }

    // Check if user account is banned or inactive
    this.userService.validateUserAccess(user);

    const payload = { sub: user.id, email: user.email, role: user.role };
    this.socketGatewayService.markUserOnline(String(user.id));

    return {
      data: {
        access_token: this.jwtService.sign(payload),
        userId: user.id,
        user: new UserResponseDto(user),
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
  async googleLogin(googleUser: any): Promise<{
    access_token: string;
    userId: string;
    user: UserResponseDto;
  }> {
    if (!googleUser) {
      throw new UnauthorizedException(MESSAGES.failMessage.invalidCredentials);
    }

    const { googleId, email, firstName, lastName, picture } = googleUser;

    if (!email) {
      throw new UnauthorizedException(
        MESSAGES.failMessage.googleAccountNoEmail,
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
      
      const createdUser = await this.userService.createPatientViaOAuth({
        email,
        password: randomPassword,
        firstName,
        lastName,
        googleId,
        profilePicture: picture,
      });
      
      userId = createdUser.id;
      userEmail = createdUser.email;
    }

    user = await this.userService.findUserEntityById(userId);
    
    // Check if user account is banned or inactive
    this.userService.validateUserAccess(user);
    
    const payload = { sub: userId, email: userEmail, role: user.role };
    const accessToken = this.jwtService.sign(payload);

    this.socketGatewayService.markUserOnline(String(userId));

    // Return token data with complete user information
    return {
      access_token: accessToken,
      userId: userId,
      user: new UserResponseDto(user),
    };
  }
}
