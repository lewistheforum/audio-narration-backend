import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { DatabaseHealthService } from './common/health/database-health.service';
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // config CORS
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  // config global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // prefix API
  app.setGlobalPrefix('api');

  // config Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Capstone API')
    .setDescription('A platform for sharing and discovering doctor')
    .setVersion('1.0')
    .addTag('Authentication', 'Authentication endpoints')
    .addTag('Users management', 'User management endpoints')
    .addTag('Health', 'Health check endpoints')
    .addTag('Mailer', 'Mail service endpoints')
    .addTag('Payments', 'QR Seepay') 

    // .addBearerAuth()
    .build();

  //config interceptors
  app.useGlobalInterceptors(new ResponseTransformInterceptor());

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  // check connection database
  const databaseHealthService = app.get(DatabaseHealthService);
  await databaseHealthService.checkAllConnections();

  const PORT = process.env.PORT || 4000;

  await app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
    console.log(`🏥 Health Check: http://localhost:${PORT}/api/health`);
    console.log(`🔐 Auth Routes: http://localhost:${PORT}/api/auth/*`);
    console.log(`👥 User Routes: http://localhost:${PORT}/api/users/*`);
    console.log(`💳 Payment Routes: http://localhost:${PORT}/payments/*`);
  });
}

bootstrap().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
