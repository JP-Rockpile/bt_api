import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    // Setup Swagger for testing
    const config = new DocumentBuilder()
      .setTitle('Bet Think API')
      .setDescription('Core backend API for Bet Think')
      .setVersion('1.0')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);

    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    // Give time for all connections to close
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  describe('Health Checks', () => {
    it('/health (GET) should return healthy status', () => {
      return request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect((res: any) => {
          expect(res.body).toHaveProperty('status');
          expect(res.body.status).toBe('ok');
        });
    });

    it('/health/ready (GET) should return ready status', () => {
      return request(app.getHttpServer())
        .get('/health/ready')
        .expect(200);
    });
  });

  describe('API Documentation', () => {
    it('/api/docs should serve Swagger UI', () => {
      return request(app.getHttpServer())
        .get('/api/docs')
        .expect(301); // Redirect to /api/docs/
    });
  });
});

