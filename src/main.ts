// Force Node.js to use timezone from environment variable
if (process.env.TZ) {
  process.env.TZ = process.env.TZ;
  console.log(`Application timezone set to: ${process.env.TZ}`);
}

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { DatabaseHealthService } from './common/health/database-health.service';
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Bật tính năng nhận diện proxy từ Nginx
  app.set('trust proxy', 1);

  // Increase payload size limit to 50MB (for PDF uploads)
  app.useBodyParser('json', { limit: '50mb' });
  app.useBodyParser('urlencoded', { extended: true, limit: '50mb' });

  // config CORS
  app.enableCors({
    origin: true, // Allows any origin
    credentials: true,
  });

  // Global validation pipe with enhanced settings
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties that don't have decorators
      forbidNonWhitelisted: true, // Throw error if non-whitelisted properties exist
      transform: true, // Auto-transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: true, // Auto-convert primitive types
      },
      disableErrorMessages: false, // Show detailed validation messages
    }),
  );

  // prefix API
  app.setGlobalPrefix('api');

  // config Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Bonix API')
    .setDescription(
      'A comprehensive healthcare platform API for patient management, clinic services, messaging, and doctor discovery',
    )
    .setVersion('1.0.0')
    .addTag(
      'Authentication',
      'Authentication endpoints - Login, Google OAuth, and session management',
    )
    .addTag(
      'Conversations',
      'Conversation management - Create and manage conversations between users',
    )
    .addTag(
      'Messages',
      'Message management - Send, receive, and manage messages within conversations',
    )
    .addTag(
      'Health',
      'Health check endpoints - Monitor application and database health status',
    )
    .addTag('Mailer', 'Mail service endpoints - Send emails and notifications')
    .addTag(
      'Staff Patients Management',
      'Manage patient accounts and direct walk-in appointments as a clinic staff',
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
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
    console.log(
      `💳 Transaction Routes: http://localhost:${PORT}/transactions/*`,
    );
  });
}

bootstrap().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
