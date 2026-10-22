import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';

const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock('../src/repositories/db.js', () => ({ db: { user: { findUnique } } }));
vi.mock('../src/utils/environment.js', () => ({ jwtSecret: 'test-secret-at-least-thirty-two-characters' }));
import { authenticate } from '../src/middlewares/auth.js';

describe('Validação de sessões', () => {
  const secret = 'test-secret-at-least-thirty-two-characters';
  const app = express();
  app.get('/protected', authenticate, (_req, res) => res.json({ ok: true }));
  app.use((error: { status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(error.status || 500).json({ message: 'Acesso negado' });
  });
  beforeEach(() => {
    findUnique.mockReset();
    findUnique.mockResolvedValue({ id: 'user', active: true, deletedAt: null, sessionVersion: 2, role: { name: 'ADMIN' } });
  });
  const access = (payload: object, signingSecret = secret) => request(app).get('/protected')
    .auth(jwt.sign(payload, signingSecret, { algorithm: 'HS256' }), { type: 'bearer' });

  it('aceita somente uma sessão válida e ativa', async () => {
    expect((await access({ sub: 'user', version: 2, exp: Math.floor(Date.now() / 1000) + 60 })).status).toBe(200);
  });
  it('rejeita tokens sem expiração ou identificação antes de consultar o banco', async () => {
    for (const payload of [{ sub: 'user', version: 2 }, { version: 2, exp: 9999999999 },
      { sub: 'user', version: '2', exp: 9999999999 }]) {
      expect((await access(payload)).status).toBe(401);
    }
    expect(findUnique).not.toHaveBeenCalled();
  });
  it('rejeita assinatura falsificada e token expirado', async () => {
    expect((await access({ sub: 'user', version: 2, exp: 9999999999 }, 'attacker-secret')).status).toBe(401);
    expect((await access({ sub: 'user', version: 2, exp: 1 })).status).toBe(401);
    expect(findUnique).not.toHaveBeenCalled();
  });
  it('rejeita sessões revogadas e contas excluídas ou inativas', async () => {
    expect((await access({ sub: 'user', version: 1, exp: 9999999999 })).status).toBe(401);
    for (const state of [{ active: false }, { active: true, deletedAt: new Date() }]) {
      findUnique.mockResolvedValue({ ...state, sessionVersion: 2, role: { name: 'ADMIN' } });
      expect((await access({ sub: 'user', version: 2, exp: 9999999999 })).status).toBe(401);
    }
  });
});
