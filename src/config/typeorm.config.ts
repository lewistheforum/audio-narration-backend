import { DataSource } from 'typeorm';
import { join } from 'path';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

export const buildTypeOrmOptions = (
  config: ConfigService,
): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: config.get('POSTGRES_HOST') || '',
  port: parseInt(config.get('POSTGRES_PORT') || ''),
  username: config.get('POSTGRES_USERNAME') || '',
  password: config.get('POSTGRES_PASSWORD') || '',
  database: config.get('POSTGRES_DATABASE') || '',
  entities: [join(__dirname, '../**/*.entity{.ts,.js}')],
  synchronize: false, // Set to false to avoid hang on startup
  logging: config.get('NODE_ENV') === 'development',
  extra: {
    timezone: config.get('TZ') || 'Asia/Ho_Chi_Minh',
    max: 8, // Limit pool size to 8 to avoid "remaining connection slots" error on Aiven
    connectionTimeoutMillis: 5000,
  },
  ssl:
    config.get('POSTGRES_SSL') === 'true'
      ? {
        rejectUnauthorized: false,
      }
      : false,
});

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_HOST || '',
  port: parseInt(process.env.POSTGRES_PORT || ''),
  username: process.env.POSTGRES_USERNAME || '',
  password: process.env.POSTGRES_PASSWORD || '',
  database: process.env.POSTGRES_DATABASE || '',
  entities: [join(__dirname, '../**/*.entity{.ts,.js}')],
  migrations: [join(__dirname, '../database/migrations/*{.ts,.js}')],
  synchronize: false, // Set to false to avoid hang
  logging: process.env.NODE_ENV === 'development',
  // Store timestamps with Vietnam timezone (GMT+7)
  extra: {
    timezone: process.env.TZ || 'Asia/Ho_Chi_Minh',
    max: 8, // Limit pool size to 8 to avoid "remaining connection slots" error on Aiven
    connectionTimeoutMillis: 5000,
  },
  ssl:
    process.env.POSTGRES_SSL === 'true'
      ? {
        rejectUnauthorized: false,
      }
      : false,
});
