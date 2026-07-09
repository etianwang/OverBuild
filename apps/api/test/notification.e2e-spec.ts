import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup-app';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Notification E2E', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        onModuleInit: async () => undefined,
        onModuleDestroy: async () => undefined,
      })
      .compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('GET /api/v1/notifications returns 401 without token', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/notifications')
      .expect(401);

    expect(res.body.success).toBe(false);
  });

  it('GET /api/v1/notifications/unread-count returns 401 without token', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/notifications/unread-count')
      .expect(401);

    expect(res.body.success).toBe(false);
  });

  it('PUT /api/v1/notifications/read-all returns 401 without token', async () => {
    const res = await request(app.getHttpServer())
      .put('/api/v1/notifications/read-all')
      .expect(401);

    expect(res.body.success).toBe(false);
  });
});
