import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { ClientService } from '../client/client.service';
import { SocketGatewayService } from '../socket-gateway/socket-gateway.service';
import { randomBytes } from 'crypto';
import { ClientResponseDto } from '../client/dto/client-response.dto';
import { MESSAGES } from 'src/common/message';

/**
 * Authentication Service
 * Handles user authentication logic including standard login and OAuth
 */
@Injectable()
export class AuthService {
  constructor(
    private clientService: ClientService,
    private jwtService: JwtService,
    private socketGatewayService: SocketGatewayService,
  ) { }

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
      user: ClientResponseDto;
    };
  }> {
    const { email, password } = loginDto;
    const user = await this.clientService.findByEmail(email);

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException(MESSAGES.failMessage.invalidCredentials);
    }

    // Check if user account is banned or inactive
    this.clientService.validateUserAccess(user);

    const payload = { sub: user.id, email: user.email, role: user.role };
    this.socketGatewayService.markUserOnline(String(user.id));

    // Get general account data for response
    const generalAccount = await this.clientService.findGeneralAccountByUserId(user.id);

    return {
      data: {
        access_token: this.jwtService.sign(payload),
        userId: user.id,
        user: new ClientResponseDto(user, generalAccount),
      },
    };
  }

  /**
   * Google OAuth login flow
   * - Only creates PATIENT accounts (business rule)
   * - Email is automatically verified for OAuth users
   * - Stores profile picture
   * - Generates random password for OAuth users
   */
  async googleLogin(googleUser: any): Promise<{
    access_token: string;
    userId: string;
    user: ClientResponseDto;
  }> {
    if (!googleUser) {
      throw new UnauthorizedException(MESSAGES.failMessage.invalidCredentials);
    }

    const { email, firstName, lastName, picture } = googleUser;

    if (!email) {
      throw new UnauthorizedException(
        MESSAGES.failMessage.googleAccountNoEmail,
      );
    }

    let user = await this.clientService.findByEmail(email);
    let userId: string;
    let userEmail: string;
    let generalAccount = null;

    if (user) {
      // Update existing user with OAuth data if not already set
      if (!user.isOAuthUser) {
        user.isOAuthUser = true;
        user.isEmailVerified = true;
        user.profilePicture = picture;
        await this.clientService.updateUserEntity(user);
      }
      userId = user.id;
      userEmail = user.email;
      generalAccount = await this.clientService.findGeneralAccountByUserId(userId);
    } else {
      // Create new patient account via Google OAuth
      const randomPassword = randomBytes(16).toString('hex');

      // Construct fullName from first and last name
      const fullName = [firstName, lastName].filter(Boolean).join(' ') || undefined;

      const createdUser = await this.clientService.createPatientViaOAuth({
        email,
        password: randomPassword,
        username: email.split('@')[0],
        fullName,
        profilePicture: picture,
      });

      userId = createdUser.id;
      userEmail = createdUser.email;
      generalAccount = await this.clientService.findGeneralAccountByUserId(userId);
    }

    user = await this.clientService.findUserEntityById(userId);

    // Check if user account is banned or inactive
    this.clientService.validateUserAccess(user);

    const payload = { sub: userId, email: userEmail, role: user.role };
    const accessToken = this.jwtService.sign(payload);

    this.socketGatewayService.markUserOnline(String(userId));

    // Return token data with complete user information
    return {
      access_token: accessToken,
      userId: userId,
      user: new ClientResponseDto(user, generalAccount),
    };
  }
}
