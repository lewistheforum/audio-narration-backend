import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DatabaseHealthService } from './database-health.service';
import { formatToVietnamTime } from '../utils/date.util';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly databaseHealthService: DatabaseHealthService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get the overall health status of the application',
    description: 'Checks the status of all critical services, including the database.',
  })
  @ApiResponse({
    status: 200,
    description: 'The overall health status of the application.',
    schema: {
      properties: {
        status: { type: 'string', example: 'healthy' },
        timestamp: { type: 'string', format: 'date-time', example: formatToVietnamTime() },
        services: {
          type: 'object',
          properties: {
            database: {
              type: 'object',
              properties: {
                postgres: { type: 'string', example: 'connected' },
                allConnected: { type: 'boolean', example: true },
              },
            },
            details: {
              type: 'object',
              properties: {
                postgres: { type: 'string', example: 'postgres on localhost:5432/bonix_db' },
              },
            },
          },
        },
      },
    },
  })
  async getHealth(): Promise<{
    status: string;
    timestamp: string;
    services: {
      database: any;
      details: any;
    };
  }> {
    const connections = await this.databaseHealthService.checkAllConnections();
    const connectionInfo = this.databaseHealthService.getConnectionInfo();

    return {
      status: connections.allConnected ? 'healthy' : 'unhealthy',
      timestamp: formatToVietnamTime(),
      services: {
        database: connections,
        details: connectionInfo,
      },
    };
  }

  @Get('database')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check only the database connection health' })
  @ApiResponse({
    status: 200,
    description: 'The connection status for each configured database.',
    schema: {
      type: 'object',
      properties: {
        postgres: { type: 'string', example: 'connected' },
        allConnected: { type: 'boolean', example: true },
      },
    },
  })
  async getDatabaseHealth(): Promise<any> {
    return await this.databaseHealthService.checkAllConnections();
  }

  @Get('database/info')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get detailed database connection information' })
  @ApiResponse({
    status: 200,
    description: 'Detailed information about each configured database connection.',
    schema: {
      type: 'object',
      properties: {
        postgres: { type: 'string', example: 'postgres on localhost:5432/bonix_db' },
      },
    },
  })
  getDatabaseInfo(): any {
    return this.databaseHealthService.getConnectionInfo();
  }
}
