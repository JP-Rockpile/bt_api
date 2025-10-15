import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { initTracing } from './common/tracing/tracer';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  try {
    console.log('🔧 Bootstrap starting...');
    
    // Initialize OpenTelemetry tracing before app creation
    const otelEnabled = process.env.OTEL_ENABLED === 'true';
    if (otelEnabled) {
      initTracing();
    }

    console.log('📦 Creating NestJS application...');
    const createAppStart = Date.now();
    const app = await NestFactory.create(AppModule, {
      bufferLogs: true,
    });
    const createAppDuration = Date.now() - createAppStart;
    console.log(`✅ NestJS application created (took ${createAppDuration}ms)`);

  // Use Pino logger
  app.useLogger(app.get(Logger));

  // Security middleware - Configure helmet to allow SSE streams
  app.use(
    helmet({
      contentSecurityPolicy: false, // Allow SSE connections
      crossOriginEmbedderPolicy: false, // Allow streaming responses
    }),
  );

  // CORS configuration
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:19006'],
    credentials: process.env.CORS_CREDENTIALS === 'true',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Idempotency-Key',
      'X-Request-ID',
      'Cache-Control',
      'X-Accel-Buffering',
    ],
    exposedHeaders: ['Content-Type', 'Cache-Control', 'Connection'],
  });

  // Global prefix and versioning
  const apiPrefix = process.env.API_PREFIX || 'api';
  app.setGlobalPrefix(apiPrefix);
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: process.env.API_VERSION || '1',
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global response transformation interceptor
  app.useGlobalInterceptors(new TransformInterceptor());

  // Global exception filter for consistent error responses
  app.useGlobalFilters(new AllExceptionsFilter());

  // Swagger/OpenAPI documentation
  const config = new DocumentBuilder()
    .setTitle('Bet Think API')
    .setDescription(
      'Core backend API for Bet Think - Authenticated gateway, odds aggregation engine, chat coordinator, and async job processor',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter your Auth0 JWT token',
        in: 'header',
      },
      'auth0-jwt',
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'Idempotency-Key',
        in: 'header',
        description: 'Optional idempotency key for mutation operations',
      },
      'idempotency-key',
    )
    .addTag('auth', 'Authentication and user management')
    .addTag('events', 'Sports events and schedules')
    .addTag('odds', 'Odds aggregation and best price')
    .addTag('bets', 'Bet planning, confirmation, and tracking')
    .addTag('chat', 'Real-time chat and SSE streaming')
    .addTag('health', 'Health checks and monitoring')
    .build();

    console.log('📖 Setting up Swagger documentation...');
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });

    // Expose OpenAPI JSON
    app.getHttpAdapter().get(`/${apiPrefix}/docs-json`, (req, res) => {
      res.json(document);
    });
    console.log('✅ Swagger documentation ready');

    // Graceful shutdown
    app.enableShutdownHooks();

    const port = process.env.PORT || 3000;
    const host = process.env.HOST || '0.0.0.0'; // Bind to all interfaces for production
    
    console.log(`🌐 Attempting to listen on ${host}:${port}...`);
    
    // Add timeout to detect hanging listen
    const listenTimeout = setTimeout(() => {
      console.error('⚠️ WARNING: app.listen() is taking longer than 10 seconds');
    }, 10000);
    
    try {
      await app.listen(port, host);
      clearTimeout(listenTimeout);
      console.log(`✅ Successfully bound to ${host}:${port}`);
    } catch (listenError) {
      clearTimeout(listenTimeout);
      console.error('❌ Failed to bind to port:', listenError);
      throw listenError;
    }

    const logger = app.get(Logger);
    logger.log(`🚀 Application is running on: http://${host}:${port}/${apiPrefix}`);
    logger.log(`📚 API Documentation: http://${host}:${port}/${apiPrefix}/docs`);
    logger.log(`🔍 OpenTelemetry: ${otelEnabled ? 'Enabled' : 'Disabled'}`);
  } catch (error) {
    console.error('❌ Fatal error during bootstrap:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

bootstrap().catch((error) => {
  console.error('❌ Unhandled error in bootstrap:', error);
  process.exit(1);
});
