import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { randomBytes } from 'node:crypto';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import request from 'supertest';

const config = dotenv.parse(readFileSync('backend/.env'));
const target = new URL(config.TEST_DATABASE_URL);
if (!['localhost', '127.0.0.1'].includes(target.hostname))
  throw new Error('Use a local test database.');
const database = `nucleo_perf_${Date.now()}`;
target.pathname = `/${database}`;
const created = spawnSync(
  'docker',
  ['compose', 'exec', '-T', 'db', 'createdb', '-U', 'nucleo', database],
  { stdio: 'inherit' },
);
if (created.status !== 0) throw new Error('Could not create isolated database.');
process.env.DATABASE_URL = target.toString();
process.env.JWT_SECRET = randomBytes(48).toString('hex');
const migration = spawnSync(
  process.execPath,
  [
    'node_modules/prisma/build/index.js',
    'migrate',
    'deploy',
    '--schema',
    'backend/prisma/schema.prisma',
  ],
  { env: process.env, stdio: 'inherit' },
);
if (migration.status !== 0) throw new Error('Migration failed.');
const { app } = await import('../backend/src/app.ts');
const { db } = await import('../backend/src/repositories/db.ts');
const results = {
  database,
  environment: 'isolated local PostgreSQL; API via Supertest; no browser or production network',
  samples: 20,
  stages: [],
};
try {
  const role = await db.role.create({ data: { name: 'ADMIN' } });
  const user = await db.user.create({
    data: {
      name: 'Benchmark',
      email: 'benchmark@example.invalid',
      registration: 'BENCH',
      passwordHash: 'disabled',
      roleId: role.id,
    },
  });
  const category = await db.category.create({ data: { name: 'Produtos de teste' } });
  const token = jwt.sign({ version: 0 }, process.env.JWT_SECRET, {
    subject: user.id,
    expiresIn: '1h',
  });
  for (const total of [5000, 10000]) {
    const insertStart = performance.now();
    for (let offset = total - 5000; offset < total; offset += 500) {
      await db.material.createMany({
        data: Array.from({ length: 500 }, (_, i) => ({
          code: `PERF-${String(offset + i + 1).padStart(5, '0')}`,
          name: `Produto de teste ${String(offset + i + 1).padStart(5, '0')}`,
          categoryId: category.id,
          minimum: 5,
          unitPrice: ((offset + i) % 100) + 1,
          quantity: 0,
        })),
      });
    }
    const stage = {
      total: await db.material.count(),
      insertionMs: Math.round(performance.now() - insertStart),
      endpoints: [],
    };
    if (stage.total !== total) throw new Error('Unexpected product count.');
    for (const path of [
      '/api/materials',
      '/api/materials?page=1&pageSize=20',
      '/api/materials?page=250&pageSize=20',
      '/api/materials?q=05000',
      '/api/search?q=Produto',
      '/api/dashboard',
    ]) {
      const run = () => request(app).get(path).set('Authorization', `Bearer ${token}`);
      const warm = await run();
      if (warm.status !== 200) throw new Error(`${path}: HTTP ${warm.status}`);
      if (path === '/api/materials' && warm.body.length !== total)
        throw new Error('List count mismatch.');
      if (path.includes('page=') && (warm.body.total !== total || warm.body.rows.length !== 20))
        throw new Error('Pagination mismatch.');
      if (path === '/api/dashboard' && warm.body.cards.materials !== total)
        throw new Error('Dashboard count mismatch.');
      const times = [];
      for (let i = 0; i < results.samples; i++) {
        const start = performance.now();
        const response = await run();
        if (response.status !== 200) throw new Error(`${path}: HTTP ${response.status}`);
        times.push(performance.now() - start);
      }
      times.sort((a, b) => a - b);
      stage.endpoints.push({
        path,
        medianMs: Math.round((times[9] + times[10]) / 2),
        p95Ms: Math.round(times[18]),
        bytes: Buffer.byteLength(warm.text),
      });
    }
    results.stages.push(stage);
    console.log(JSON.stringify(stage, null, 2));
    mkdirSync('.artifacts', { recursive: true });
    writeFileSync(
      `.artifacts/products-performance${process.argv.includes('--optimized') ? '-optimized' : ''}.json`,
      JSON.stringify(results, null, 2),
    );
  }
  if (process.argv.includes('--optimized')) {
    const { verifyProductPagination } = await import('./verify-product-pagination.mjs');
    await verifyProductPagination(app, db, token, category.id);
  }
} finally {
  await db.$disconnect();
}
