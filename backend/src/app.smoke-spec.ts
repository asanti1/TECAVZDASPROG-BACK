import type { INestApplication } from '@nestjs/common';
import { WsAdapter } from '@nestjs/platform-ws';
import { Test } from '@nestjs/testing';
import { Pool } from 'pg';
import request from 'supertest';
import { insertBranch, insertProduct, insertUser, setStock } from '../test/support/seed.js';
import { createTestDatabase, type TestDatabase } from '../test/support/test-database.js';
import { AppModule } from './app.module.js';
import { ScryptPasswordHasher } from './auth/infrastructure/scrypt-password-hasher.js';
import { PG_POOL } from './shared/infrastructure/postgres/pg-pool.js';
import { loadPostgresConfig } from './shared/infrastructure/postgres/postgres-config.js';
import type { IRouteOptimizer } from './trips/domain/route-optimizer.js';
import { ROUTE_OPTIMIZER } from './trips/domain/route-optimizer.js';
import type { RoutePlanRequest } from './trips/domain/route-plan.js';
import { RouteResultsConsumer } from './trips/infrastructure/messaging/route-results-consumer.js';

class RecordingOptimizer implements IRouteOptimizer {
  readonly requests: RoutePlanRequest[] = [];

  async requestRoutePlan(request: RoutePlanRequest): Promise<void> {
    this.requests.push(request);
  }
}

let db: TestDatabase;
let app: INestApplication;
let optimizer: RecordingOptimizer;

beforeAll(async () => {
  process.env.JWT_SECRET = 'secreto-de-prueba';
  db = await createTestDatabase();
});

afterAll(async () => {
  await db.drop();
});

beforeEach(async () => {
  await db.clearAllTables();
  optimizer = new RecordingOptimizer();
  const appPool = new Pool({
    ...loadPostgresConfig(),
    database: db.databaseName,
  });
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PG_POOL).useValue(appPool).overrideProvider(ROUTE_OPTIMIZER).useValue(optimizer)
    .overrideProvider(RouteResultsConsumer).useValue({}).compile();

  app = moduleRef.createNestApplication();
  app.useWebSocketAdapter(new WsAdapter(app));
  await app.init();
});

afterEach(async () => {
  await app.close();
});

const http = () => request(app.getHttpServer());

async function loginAs(role: 'CUSTOMER' | 'DELIVERY_PERSON' | 'ADMIN', branchId: string | null): Promise<string> {
  const email = `${role.toLowerCase()}@test.local`;
  const passwordHash = await new ScryptPasswordHasher().hash('clave1234');
  await insertUser(db.pool, role, branchId, { email, passwordHash });
  const res = await http().post('/auth/login').send({ email, password: 'clave1234' }).expect(200);
  return res.body.accessToken as string;
}

describe('Backend: smoke', () => {
  it('levanta y lista las sucursales', async () => {
    const branch = await insertBranch(db.pool, {
      latitude: -38.7,
      longitude: -62.3,
    });

    const token = await loginAs('CUSTOMER', null);

    const res = await http().get('/branches').set('Authorization', `Bearer ${token}`).expect(200);

    expect(res.body).toEqual([expect.objectContaining({ id: branch })]);
  });

  it('responde el stock de una sucursal y 404 si no existe', async () => {
    const branch = await insertBranch(db.pool);
    const product = await insertProduct(db.pool);
    await setStock(db.pool, branch, product, 5);

    const token = await loginAs('CUSTOMER', null);
    const auth = { Authorization: `Bearer ${token}` };

    const res = await http().get(`/branches/${branch}/products`).set(auth).expect(200);

    expect(res.body).toEqual([
      expect.objectContaining({ id: product, quantity: 5 }),
    ]);
    await http().get('/branches/00000000-0000-4000-8000-000000000000/products').set(auth).expect(404);
  });

  it('pide token, rechaza una clave incorrecta y aplica los permisos por rol', async () => {
    const branch = await insertBranch(db.pool);
    await http().get('/branches').expect(401);
    await http().post('/auth/login').send({ email: 'nadie@test.local', password: 'x' }).expect(401);

    const customer = await loginAs('CUSTOMER', null);
    const admin = await loginAs('ADMIN', branch);

    await http().get('/trips').set('Authorization', `Bearer ${customer}`).expect(403);
    await http().get('/trips').set('Authorization', `Bearer ${admin}`).expect(200);
  });
});
