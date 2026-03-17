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
  synchronize: true,
  logging: false,
  // Store timestamps with Vietnam timezone (GMT+7)
  // PostgreSQL will store TIMESTAMPTZ in UTC but return values in this timezone
  extra: {
    // Set PostgreSQL session timezone to Vietnam
    timezone: config.get('TZ') || 'Asia/Ho_Chi_Minh',
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
  synchronize: true,
  logging: process.env.NODE_ENV === 'development',
  // Store timestamps with Vietnam timezone (GMT+7)
  extra: {
    // Set PostgreSQL session timezone to Vietnam
    timezone: process.env.TZ || 'Asia/Ho_Chi_Minh',
  },
  // ssl:
  //   process.env.POSTGRES_SSL === 'true'
  //     ? {
  //       rejectUnauthorized: false,
  //     }
  //     : false,
});
