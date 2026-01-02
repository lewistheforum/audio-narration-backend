import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Google OAuth 2.0 Strategy
 * 
 * Implements Google authentication for patient registration only
 * Extracts user profile information from Google account
 * 
 * Business Rules:
 * - Only creates PATIENT role accounts via OAuth
 * - Email is automatically verified for OAuth users
 * - Profile picture is stored from Google account
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(configService: ConfigService) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID'),
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL: configService.get<string>('GOOGLE_CALLBACK_URL'),
      scope: ['email', 'profile'],
    });
  }

  /**
   * Validate Google OAuth Response
   * 
   * @param accessToken - Google access token
   * @param refreshToken - Google refresh token (not used)
   * @param profile - User profile data from Google
   * @param done - Passport callback function
   * @returns User object with Google profile data
   */
  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { id, name, emails, photos } = profile;

    const user = {
      googleId: id,
      email: emails[0].value,
      firstName: name.givenName,
      lastName: name.familyName,
      picture: photos?.[0]?.value,
      accessToken,
      isEmailVerified: true, // Google OAuth users have verified emails
    };

    done(null, user);
  }
}
