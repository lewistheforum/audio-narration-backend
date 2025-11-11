import { ConfigService } from '@nestjs/config';
import { JwtModuleOptions } from '@nestjs/jwt';

export const getJwtConfig = async (
  configService: ConfigService,
): Promise<JwtModuleOptions> => {
  // const jwtSecret = configService.get<string>('JWT_SECRET');
  const jwtSecret = process.env.JWT_SECRET;
  console.log(`[getJwtConfig] Loading JWT_SECRET: ${jwtSecret}`);

  if (!jwtSecret) {
    throw new Error('JWT_SECRET is not defined in the environment variables');
  }

  return {
    secret: jwtSecret,
    signOptions: {
      // expiresIn: configService.get<string>('JWT_EXPIRES_IN', '1d'),
      expiresIn: process.env.JWT_EXPIRES_IN,
    },
  };
};
