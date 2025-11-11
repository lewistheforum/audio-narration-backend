import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

export interface DecodedToken {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}

export const verifyToken = (
  token: string,
  jwtService: JwtService,
): DecodedToken => {
  try {
    const decoded = jwtService.verify(token) as DecodedToken;
    return decoded;
  } catch (error) {
    throw new Error('Invalid authentication token');
  }
};
