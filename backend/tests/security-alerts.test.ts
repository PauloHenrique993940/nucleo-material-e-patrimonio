import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const { findMany, login } = vi.hoisted(() => ({ findMany: vi.fn(), login: vi.fn() }));
vi.mock('../src/repositories/db.js', () => ({ db: { material: { findMany } } }));
vi.mock('../src/controllers/auth.js', () => ({ login }));
vi.mock('../src/routes/recovery.js', () => ({ recovery: express.Router() }));
import { auth } from '../src/routes/auth.js';
import { insights } from '../src/routes/insights.js';

describe('Proteção de login e alertas', () => {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.use('/auth', auth);
  app.use(insights);
  login.mockImplementation((_req, res) => res.status(401).json({ message: 'Inválido' }));

  it('bloqueia tentativas repetidas do mesmo IP', async () => {
    for (let i = 0; i < 10; i++) {
      expect((await request(app).post('/auth/login').set('X-Forwarded-For', '192.0.2.1')
        .send({ login: `user-${i}` })).status).toBe(401);
    }
    const response = await request(app).post('/auth/login').set('X-Forwarded-For', '192.0.2.1')
      .send({ login: 'other' });
    expect(response.status).toBe(429);
    expect(response.body.message).toContain('15 minutos');
  });

  it('bloqueia ataques à mesma conta vindos de IPs diferentes', async () => {
    for (let i = 0; i < 20; i++) {
      expect((await request(app).post('/auth/login').set('X-Forwarded-For', `192.0.2.${i + 10}`)
        .send({ login: i % 2 ? ' TARGET@test.local ' : 'target@test.local' })).status).toBe(401);
    }
    expect((await request(app).post('/auth/login').set('X-Forwarded-For', '192.0.2.100')
      .send({ login: 'target@test.local' })).status).toBe(429);
  });

  it('alerta no mínimo e ao esgotar, mas não acima do mínimo', async () => {
    findMany.mockResolvedValue([
      { id: 'empty', quantity: 0, minimum: 0 },
      { id: 'low', quantity: 5, minimum: 5 },
      { id: 'ok', quantity: 6, minimum: 5 },
    ]);
    const response = await request(app).get('/alerts');
    expect(response.status).toBe(200);
    expect(response.body.map((item: { id: string }) => item.id)).toEqual(['empty', 'low']);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { active: true, deletedAt: null },
    }));
  });
});
