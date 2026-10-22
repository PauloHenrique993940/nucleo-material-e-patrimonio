import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  remove: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock('../src/repositories/db.js', () => ({ db: { $transaction: mocks.transaction } }));
import { administration } from '../src/routes/administration.js';
import { errorHandler } from '../src/middlewares/errors.js';
const id = '00000000-0000-4000-8000-000000000001';
function app(role = 'ADMIN') {
  const server = express();
  server.use(express.json());
  server.use((req, _res, next) => {
    req.session = { id, role: role as any };
    next();
  });
  server.use(administration);
  server.use(errorHandler);
  return server;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.remove.mockResolvedValue({ count: 1 });
  mocks.transaction.mockImplementation((callback) =>
    callback({
      $queryRaw: mocks.query,
      auditLog: { deleteMany: mocks.remove },
    }),
  );
});
describe('Exclusão administrativa da auditoria', () => {
  it.each(['MANAGER', 'OPERATOR', 'VIEWER'])(
    'bloqueia o perfil %s antes de tocar no banco',
    async (role) => {
      expect(
        (await request(app(role)).delete('/audit').send({ confirmation: 'LIMPAR AUDITORIA' }))
          .status,
      ).toBe(403);
      expect(
        (
          await request(app(role))
            .delete('/audit/' + id)
            .send({ confirmation: 'EXCLUIR' })
        ).status,
      ).toBe(403);
      expect(mocks.transaction).not.toHaveBeenCalled();
    },
  );
  it('exige confirmação explícita para limpeza total', async () => {
    expect((await request(app()).delete('/audit').send({ confirmation: 'EXCLUIR' })).status).toBe(
      400,
    );
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it('limpa todos os registros e retorna a contagem', async () => {
    mocks.remove.mockResolvedValue({ count: 1200 });
    const response = await request(app())
      .delete('/audit')
      .send({ confirmation: 'LIMPAR AUDITORIA' });
    expect(response.status).toBe(200);
    expect(response.body.deleted).toBe(1200);
    expect(mocks.query).toHaveBeenCalledOnce();
    expect(mocks.remove).toHaveBeenCalledWith({});
  });
  it('exclui somente o registro indicado', async () => {
    expect(
      (
        await request(app())
          .delete('/audit/' + id)
          .send({ confirmation: 'EXCLUIR' })
      ).status,
    ).toBe(204);
    expect(mocks.remove).toHaveBeenCalledWith({ where: { id } });
  });
  it('rejeita ID inválido ou exclusão individual sem confirmação', async () => {
    expect(
      (await request(app()).delete('/audit/invalid').send({ confirmation: 'EXCLUIR' })).status,
    ).toBe(400);
    expect(
      (
        await request(app())
          .delete('/audit/' + id)
          .send({})
      ).status,
    ).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it('retorna 404 para registro inexistente', async () => {
    mocks.remove.mockResolvedValue({ count: 0 });
    expect(
      (
        await request(app())
          .delete('/audit/' + id)
          .send({ confirmation: 'EXCLUIR' })
      ).status,
    ).toBe(404);
  });
});
