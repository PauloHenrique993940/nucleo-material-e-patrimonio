import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  find: vi.fn(),
  materialCount: vi.fn(),
  assetCount: vi.fn(),
  materials: vi.fn(),
  assets: vi.fn(),
  remove: vi.fn(),
  audit: vi.fn(),
  lock: vi.fn(),
}));
vi.mock('../src/repositories/db.js', () => ({ db: { $transaction: mocks.transaction } }));
import { catalog } from '../src/routes/catalog.js';
import { errorHandler } from '../src/middlewares/errors.js';
const id = '00000000-0000-4000-8000-000000000001';
const destination = '00000000-0000-4000-8000-000000000002';
function app(role = 'ADMIN') {
  const server = express();
  server.use(express.json());
  server.use((req, _res, next) => {
    req.session = { id, role: role as any };
    next();
  });
  server.use(catalog);
  server.use(errorHandler);
  return server;
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.find.mockResolvedValue({ id, active: true });
  mocks.materialCount.mockResolvedValue(0);
  mocks.assetCount.mockResolvedValue(0);
  mocks.transaction.mockImplementation((callback) =>
    callback({
      $queryRaw: mocks.lock,
      category: { findUnique: mocks.find, delete: mocks.remove },
      material: { count: mocks.materialCount, updateMany: mocks.materials },
      patrimony: { count: mocks.assetCount, updateMany: mocks.assets },
      auditLog: { create: mocks.audit },
    }),
  );
});
describe('category removal', () => {
  it.each(['VIEWER', 'OPERATOR', 'MANAGER'])('rejects %s before accessing data', async (role) => {
    expect(
      (
        await request(app(role))
          .delete('/categories/' + id)
          .send({})
      ).status,
    ).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it('deletes an empty category and audits it', async () => {
    expect(
      (
        await request(app())
          .delete('/categories/' + id)
          .send({})
      ).status,
    ).toBe(204);
    expect(mocks.remove).toHaveBeenCalledWith({ where: { id } });
    expect(mocks.audit).toHaveBeenCalledWith({ data: expect.objectContaining({ recordId: id }) });
  });
  it('requires a destination when materials or assets are linked', async () => {
    mocks.assetCount.mockResolvedValue(2);
    expect(
      (
        await request(app())
          .delete('/categories/' + id)
          .send({})
      ).status,
    ).toBe(409);
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it('moves both materials and assets before deleting the category', async () => {
    mocks.materialCount.mockResolvedValue(3);
    expect(
      (
        await request(app())
          .delete('/categories/' + id)
          .send({ replacementId: destination })
      ).status,
    ).toBe(204);
    const update = { where: { categoryId: id }, data: { categoryId: destination } };
    expect(mocks.materials).toHaveBeenCalledWith(update);
    expect(mocks.assets).toHaveBeenCalledWith(update);
    expect(mocks.remove.mock.invocationCallOrder[0]).toBeGreaterThan(
      mocks.assets.mock.invocationCallOrder[0],
    );
  });
  it('rejects a destination that is the category itself', async () => {
    expect(
      (
        await request(app())
          .delete('/categories/' + id)
          .send({ replacementId: id })
      ).status,
    ).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it('rejects an inactive destination', async () => {
    mocks.find
      .mockResolvedValueOnce({ id, active: true })
      .mockResolvedValueOnce({ id: destination, active: false });
    expect(
      (
        await request(app())
          .delete('/categories/' + id)
          .send({ replacementId: destination })
      ).status,
    ).toBe(400);
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it('reports a missing category', async () => {
    mocks.find.mockResolvedValue(null);
    expect(
      (
        await request(app())
          .delete('/categories/' + id)
          .send({})
      ).status,
    ).toBe(404);
  });
});
