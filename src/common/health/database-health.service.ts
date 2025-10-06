import { Injectable, Logger } from '@nestjs/common';
// import { InjectConnection } from '@nestjs/mongoose';
// import { Connection } from 'mongoose';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class DatabaseHealthService {
  private readonly logger = new Logger(DatabaseHealthService.name);

  constructor(
    // @InjectConnection() private readonly mongoConnection: Connection,
    @InjectDataSource() private readonly postgresDataSource: DataSource,
  ) {}

  // checkMongoConnection(): boolean {
  //   try {
  //     const state = this.mongoConnection.readyState;
  //     if (state === 1) {
  //       this.logger.log('✅ MongoDB connected successfully');
  //       return true;
  //     } else {
  //       this.logger.error(`❌ MongoDB connection failed. State: ${state}`);
  //       return false;
  //     }
  //   } catch (error) {
  //     this.logger.error('❌ MongoDB connection error:', error.message);
  //     return false;
  //   }
  // }

  async checkPostgresConnection(): Promise<boolean> {
    try {
      if (this.postgresDataSource.isInitialized) {
        await this.postgresDataSource.query('SELECT 1');
        this.logger.log('✅ PostgreSQL connected successfully');
        return true;
      } else {
        this.logger.error('❌ PostgreSQL not initialized');
        return false;
      }
    } catch (error) {
      this.logger.error('❌ PostgreSQL connection error:', error.message);
      return false;
    }
  }

  async checkAllConnections(): Promise<{
    // mongo: boolean;
    postgres: boolean;
    allConnected: boolean;
  }> {
    this.logger.log('🔍 Checking database connections...');

    const [postgresConnected] = await Promise.all([
      // Promise.resolve(this.checkMongoConnection()),
      this.checkPostgresConnection(),
    ]);

    const allConnected = postgresConnected;

    if (allConnected) {
      this.logger.log('🎉 All database connections are healthy!');
    } else {
      this.logger.error('⚠️ Some database connections failed!');
    }

    return {
      // mongo: mongoConnected,
      postgres: postgresConnected,
      allConnected,
    };
  }

  getConnectionInfo() {
    // const mongoState = this.mongoConnection.readyState;
    // const mongoHost = this.mongoConnection.host;
    // const mongoPort = this.mongoConnection.port;
    // const mongoName = this.mongoConnection.name;

    const postgresInitialized = this.postgresDataSource.isInitialized;
    const postgresOptions = this.postgresDataSource.options as any;

    return {
      // mongo: {
      //   connected: mongoState === 1,
      //   state: mongoState,
      //   host: mongoHost,
      //   port: mongoPort,
      //   database: mongoName,
      // },
      postgres: {
        connected: postgresInitialized,
        host: postgresOptions.host,
        port: postgresOptions.port,
        database: postgresOptions.database,
        username: postgresOptions.username,
      },
    };
  }
}
