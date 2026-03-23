import { ConfigService } from '@nestjs/config';
import { JwtModuleOptions } from '@nestjs/jwt';

export const getJwtConfig = async (
  configService: ConfigService,
): Promise<JwtModuleOptions> => {
  const jwtSecret = configService.get<string>('JWT_SECRET') || process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error('JWT_SECRET is not defined in the environment variables');
  }

  const jwtExpiresIn =
    configService.get<string>('JWT_EXPIRES_IN') || process.env.JWT_EXPIRES_IN;

  return {
    secret: jwtSecret,
    signOptions: {
      expiresIn: jwtExpiresIn as any,
    },
  };
};
