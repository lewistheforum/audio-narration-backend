import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DatabaseHealthService } from './database-health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly databaseHealthService: DatabaseHealthService) {}

  @Get()
  @ApiOperation({ summary: 'Health check for all services' })
  @ApiResponse({
    status: 200,
    description: 'Health status returned successfully',
  })
  async getHealth() {
    const connections = await this.databaseHealthService.checkAllConnections();
    const connectionInfo = this.databaseHealthService.getConnectionInfo();

    return {
      status: connections.allConnected ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      services: {
        database: connections,
        details: connectionInfo,
      },
    };
  }

  @Get('database')
  @ApiOperation({ summary: 'Database connection health check' })
  @ApiResponse({
    status: 200,
    description: 'Database health status returned successfully',
  })
  async getDatabaseHealth() {
    return await this.databaseHealthService.checkAllConnections();
  }

  @Get('database/info')
  @ApiOperation({ summary: 'Get detailed database connection information' })
  @ApiResponse({
    status: 200,
    description: 'Database connection info returned successfully',
  })
  getDatabaseInfo() {
    return this.databaseHealthService.getConnectionInfo();
  }
}
