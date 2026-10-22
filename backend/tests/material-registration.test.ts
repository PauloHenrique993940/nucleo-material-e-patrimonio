import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { movementSchema } from '../src/schemas/index.js';
const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  create: vi.fn(),
  movement: vi.fn(),
  audit: vi.fn(),
  category: vi.fn(),
}));
vi.mock('../src/repositories/db.js', () => ({ db: { $transaction: mocks.transaction } }));
import { catalog } from '../src/routes/catalog.js';
import { errorHandler } from '../src/middlewares/errors.js';
const id = '00000000-0000-4000-8000-000000000001';
const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.session = { id, role: 'OPERATOR' };
  next();
});
app.use(catalog);
app.use(errorHandler);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.category.mockResolvedValue({ id });
  mocks.create.mockImplementation(({ data }) => Promise.resolve({ ...data, id }));
  mocks.movement.mockResolvedValue({ id: 'movement' });
  mocks.audit.mockResolvedValue({});
  mocks.transaction.mockImplementation((callback) =>
    callback({
      material: { create: mocks.create },
      category: { upsert: mocks.category },
      stockMovement: { create: mocks.movement },
      auditLog: { create: mocks.audit },
    }),
  );
});
describe('optional material registration and initial stock', () => {
  it('creates a material with an empty form and zero balance', async () => {
    const response = await request(app).post('/materials').send({});
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ quantity: 0, unit: 'UN', categoryId: id });
    expect(response.body.code).toMatch(/^MAT-/);
    expect(response.body.name).toContain(response.body.code);
    expect(mocks.movement).not.toHaveBeenCalled();
  });
  it('records initial stock and its audit in the same transaction', async () => {
    const response = await request(app)
      .post('/materials')
      .send({ initialBalance: 12, code: '', name: '', unit: '' });
    expect(response.status).toBe(201);
    expect(response.body.quantity).toBe(12);
    expect(mocks.movement).toHaveBeenCalledWith({
      data: expect.objectContaining({
        materialId: id,
        quantity: 12,
        previousBalance: 0,
        currentBalance: 12,
        type: 'IN',
        userId: id,
      }),
    });
    expect(mocks.audit).toHaveBeenCalledWith({
      data: expect.objectContaining({ operation: 'ENTRADA', recordId: 'movement' }),
    });
  });
  it.each([-1, 1.5, 2147483648])('rejects invalid initial balance %s', async (initialBalance) => {
    expect((await request(app).post('/materials').send({ initialBalance })).status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it('allows an entry without receiver or date, keeping withdrawal validation', () => {
    expect(movementSchema.safeParse({ materialId: id, type: 'IN', quantity: 2 }).success).toBe(
      true,
    );
    expect(movementSchema.safeParse({ materialId: id, type: 'OUT', quantity: 2 }).success).toBe(
      false,
    );
  });
});
