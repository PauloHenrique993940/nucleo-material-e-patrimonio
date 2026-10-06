import 'dotenv/config';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
const url = process.env.TEST_DATABASE_URL;
// This suite deliberately requires a separate database and never truncates application data.
const suite = url ? describe : describe.skip;
suite('API e PostgreSQL', () => {
  let app: typeof import('../src/app.js').app;
  let db: PrismaClient;
  let token = '';
  let viewerToken = '';
  let operatorToken = '';
  let categoryId = '';
  let materialId = '';
  let departmentId = '';
  let destinationId = '';
  let assetId = '';
  let resetUserId = '';
  const suffix = randomUUID().slice(0, 8);
  const password = 'Integration-test-12345!';
  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    process.env.JWT_SECRET = 'integration-secret-with-at-least-32-characters';
    app = (await import('../src/app.js')).app;
    db = new PrismaClient();
    for (const name of ['ADMIN', 'MANAGER', 'OPERATOR', 'VIEWER'] as const)
      await db.role.upsert({ where: { name }, update: {}, create: { name } });
    for (const [role, login] of [
      ['ADMIN', 'admin'],
      ['VIEWER', 'viewer'],
      ['OPERATOR', 'operator'],
    ] as const) {
      const r = await db.role.findUniqueOrThrow({ where: { name: role } });
      const u = await db.user.create({
        data: {
          name: login,
          email: `${login}-${suffix}@test.local`,
          registration: `${login}-${suffix}`,
          passwordHash: await bcrypt.hash(password, 4),
          roleId: r.id,
        },
      });
      if (role === 'VIEWER') resetUserId = u.id;
      const response = await request(app)
        .post('/api/auth/login')
        .send({ login: u.email, password });
      expect(response.status).toBe(200);
      if (role === 'ADMIN') token = response.body.token;
      else if (role === 'VIEWER') viewerToken = response.body.token;
      else operatorToken = response.body.token;
    }
    const category = await request(app)
      .post('/api/categories')
      .auth(token, { type: 'bearer' })
      .send({ name: `Categoria ${suffix}` });
    expect(category.status).toBe(201);
    categoryId = category.body.id;
    const department = await request(app)
      .post('/api/departments')
      .auth(token, { type: 'bearer' })
      .send({ name: `Setor ${suffix}`, acronym: 'TST' });
    expect(department.status).toBe(201);
    departmentId = department.body.id;
    const destination = await request(app)
      .post('/api/departments')
      .auth(token, { type: 'bearer' })
      .send({ name: `Destino ${suffix}`, acronym: 'DST' });
    destinationId = destination.body.id;
  });
  it('permite ao administrador excluir outros usuários e preserva a auditoria', async () => {
    const role = await db.role.findUniqueOrThrow({ where: { name: 'ADMIN' } });
    const target = await db.user.create({
      data: {
        name: 'Administrador removido',
        email: `remove-${suffix}@test.local`,
        registration: `remove-${suffix}`,
        roleId: role.id,
        passwordHash: await bcrypt.hash(password, 4),
      },
    });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ login: target.email, password });
    expect(login.status).toBe(200);
    expect(
      (await request(app).delete(`/api/users/${target.id}`).auth(operatorToken, { type: 'bearer' }))
        .status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .delete(`/api/users/${target.id}`)
          .auth(login.body.token, { type: 'bearer' })
      ).status,
    ).toBe(409);
    expect(
      (await request(app).delete(`/api/users/${target.id}`).auth(token, { type: 'bearer' })).status,
    ).toBe(204);
    const users = await request(app).get('/api/users').auth(token, { type: 'bearer' });
    expect(users.body.some((u: { id: string }) => u.id === target.id)).toBe(false);
    expect(
      (await request(app).get('/api/materials').auth(login.body.token, { type: 'bearer' })).status,
    ).toBe(401);
    expect(
      (await request(app).post('/api/auth/login').send({ login: target.email, password })).status,
    ).toBe(401);
    expect(await db.auditLog.count({ where: { userId: target.id } })).toBeGreaterThan(0);
    expect(
      await db.auditLog.count({ where: { operation: 'EXCLUSÃO USUÁRIO', recordId: target.id } }),
    ).toBe(1);
    expect(
      (
        await request(app).put(`/api/users/${target.id}`).auth(token, { type: 'bearer' }).send({
          name: target.name,
          email: target.email,
          registration: target.registration,
          role: 'ADMIN',
          active: true,
        })
      ).status,
    ).toBe(404);
    expect(
      (await request(app).delete(`/api/users/${target.id}`).auth(token, { type: 'bearer' })).status,
    ).toBe(404);
  });
  afterAll(async () => {
    await db?.$disconnect();
    const shared = await import('../src/repositories/db.js');
    await shared.db.$disconnect();
  });
  it('nega login inválido e acesso sem sessão', async () => {
    expect(
      (
        await request(app)
          .post('/api/auth/login')
          .send({ login: `admin-${suffix}@test.local`, password: 'wrong' })
      ).status,
    ).toBe(401);
    expect((await request(app).get('/api/materials')).status).toBe(401);
  });
  it('aplica permissões no backend', async () => {
    expect(
      (await request(app).post('/api/materials').auth(viewerToken, { type: 'bearer' }).send({}))
        .status,
    ).toBe(403);
    expect(
      (await request(app).get('/api/users').auth(operatorToken, { type: 'bearer' })).status,
    ).toBe(403);
    expect(
      (await request(app).get('/api/reports/stock').auth(operatorToken, { type: 'bearer' })).status,
    ).toBe(403);
  });
  it('cadastra material sem permitir código duplicado ou saldo direto', async () => {
    const data = { code: `TEST-${suffix}`, name: 'Material de teste', categoryId, quantity: 999 };
    const response = await request(app)
      .post('/api/materials')
      .auth(token, { type: 'bearer' })
      .send(data);
    expect(response.status).toBe(201);
    materialId = response.body.id;
    expect(response.body.quantity).toBe(0);
    expect(
      (await request(app).post('/api/materials').auth(token, { type: 'bearer' }).send(data)).status,
    ).toBe(409);
  });
  it('entrada atualiza saldo, movimento e auditoria atomicamente', async () => {
    const response = await request(app)
      .post('/api/movements')
      .auth(token, { type: 'bearer' })
      .send({ materialId, type: 'IN', quantity: 10, receiver: 'Servidor' });
    expect(response.status).toBe(201);
    expect(response.body.previousBalance).toBe(0);
    expect(response.body.currentBalance).toBe(10);
    expect(
      await db.auditLog.count({ where: { recordId: response.body.id, operation: 'ENTRADA' } }),
    ).toBe(1);
  });
  it('salva, consulta e remove a data de validade do material', async () => {
    const data = {
      code: `EXP-${suffix}`,
      name: 'Material com validade',
      categoryId,
      expiryDate: '2027-05-20',
    };
    const created = await request(app)
      .post('/api/materials')
      .auth(token, { type: 'bearer' })
      .send(data);
    expect(created.status).toBe(201);
    expect(created.body.expiryDate).toBe('2027-05-20T00:00:00.000Z');
    const listed = await request(app).get('/api/materials').auth(token, { type: 'bearer' });
    expect(listed.body.find((row: { id: string }) => row.id === created.body.id).expiryDate).toBe(
      '2027-05-20T00:00:00.000Z',
    );
    const updated = await request(app)
      .put(`/api/materials/${created.body.id}`)
      .auth(token, { type: 'bearer' })
      .send({ ...data, expiryDate: null });
    expect(updated.status).toBe(200);
    expect(
      (await db.material.findUniqueOrThrow({ where: { id: created.body.id } })).expiryDate,
    ).toBeNull();
  });
  it('nega saída superior ao estoque e não altera histórico', async () => {
    const before = await db.stockMovement.count({ where: { materialId } });
    const response = await request(app)
      .post('/api/movements')
      .auth(token, { type: 'bearer' })
      .send({
        materialId,
        type: 'OUT',
        quantity: 11,
        departmentId,
        receiver: 'Servidor',
        deliverer: 'Operador',
      });
    expect(response.status).toBe(409);
    expect((await db.material.findUniqueOrThrow({ where: { id: materialId } })).quantity).toBe(10);
    expect(await db.stockMovement.count({ where: { materialId } })).toBe(before);
  });
  it('serializa duas saídas concorrentes sem estoque negativo', async () => {
    const responses = await Promise.all(
      [1, 2].map(() =>
        request(app).post('/api/movements').auth(token, { type: 'bearer' }).send({
          materialId,
          type: 'OUT',
          quantity: 7,
          departmentId,
          receiver: 'Servidor',
          deliverer: 'Operador',
        }),
      ),
    );
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    expect((await db.material.findUniqueOrThrow({ where: { id: materialId } })).quantity).toBe(3);
  });
  it('estorno preserva original e só permite uma correção', async () => {
    const original = await db.stockMovement.findFirstOrThrow({
      where: { materialId, type: 'OUT' },
    });
    const response = await request(app)
      .post(`/api/movements/${original.id}/reverse`)
      .auth(token, { type: 'bearer' })
      .send({ notes: 'Correção de lançamento' });
    expect(response.status).toBe(200);
    expect(response.body.reversalOfId).toBe(original.id);
    expect((await db.material.findUniqueOrThrow({ where: { id: materialId } })).quantity).toBe(10);
    expect(
      (
        await request(app)
          .post(`/api/movements/${original.id}/reverse`)
          .auth(token, { type: 'bearer' })
          .send({ notes: 'Segunda correção' })
      ).status,
    ).toBe(409);
    expect(
      (
        await request(app)
          .delete(`/api/materials/${materialId}`)
          .auth(token, { type: 'bearer' })
          .send({ mode: 'permanent', confirmation: 'incorreto' })
      ).status,
    ).toBe(400);
  });
  it('protege o histórico também no banco', async () => {
    await expect(db.stockMovement.deleteMany({ where: { materialId } })).rejects.toThrow();
  });
  it('remove dos cadastros preservando histórico e permite exclusão definitiva confirmada', async () => {
    const material = await db.material.create({
      data: {
        code: `DEL-${suffix}`,
        name: 'Material de exclusão',
        categoryId,
        minimum: 0,
        maximum: 100,
      },
    });
    const movement = await request(app)
      .post('/api/movements')
      .auth(token, { type: 'bearer' })
      .send({
        materialId: material.id,
        type: 'IN',
        quantity: 5,
        receiver: 'Servidor de teste',
        notes: 'Teste de exclusão',
      });
    expect(movement.status).toBe(201);
    const reversal = await request(app)
      .post(`/api/movements/${movement.body.id}/reverse`)
      .auth(token, { type: 'bearer' })
      .send({ notes: 'Correção para teste' });
    expect(reversal.status).toBe(200);
    expect(
      (
        await request(app)
          .delete(`/api/materials/${material.id}`)
          .auth(operatorToken, { type: 'bearer' })
          .send({ mode: 'preserve' })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .delete(`/api/materials/${material.id}`)
          .auth(token, { type: 'bearer' })
          .send({ mode: 'preserve' })
      ).status,
    ).toBe(204);
    expect(
      (await db.material.findUniqueOrThrow({ where: { id: material.id } })).deletedAt,
    ).not.toBeNull();
    expect(await db.stockMovement.count({ where: { materialId: material.id } })).toBe(2);
    const listed = await request(app)
      .get('/api/materials?active=false')
      .auth(token, { type: 'bearer' });
    expect(listed.body.some((row: { id: string }) => row.id === material.id)).toBe(false);
    expect(
      (
        await request(app)
          .put(`/api/materials/${material.id}`)
          .auth(token, { type: 'bearer' })
          .send({ ...material, unitPrice: 0, active: true })
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .delete(`/api/materials/${material.id}`)
          .auth(token, { type: 'bearer' })
          .send({ mode: 'permanent', confirmation: 'errado' })
      ).status,
    ).toBe(400);
    expect(await db.stockMovement.count({ where: { materialId: material.id } })).toBe(2);
    expect(
      (
        await request(app)
          .delete(`/api/materials/${material.id}`)
          .auth(token, { type: 'bearer' })
          .send({ mode: 'permanent', confirmation: material.code })
      ).status,
    ).toBe(204);
    expect(await db.material.findUnique({ where: { id: material.id } })).toBeNull();
    expect(await db.stockMovement.count({ where: { materialId: material.id } })).toBe(0);
    expect(await db.auditLog.count({ where: { recordId: material.id } })).toBeGreaterThan(0);
    await expect(db.stockMovement.deleteMany({ where: { materialId } })).rejects.toThrow();
  });
  it('transfere patrimônio e preserva o setor da transferência', async () => {
    const created = await request(app)
      .post('/api/assets')
      .auth(token, { type: 'bearer' })
      .send({
        number: `PAT-${suffix}`,
        name: 'Notebook teste',
        categoryId,
        departmentId,
        responsible: 'Equipe',
        acquisitionDate: new Date().toISOString(),
        value: 2000,
        condition: 'Bom',
      });
    expect(created.status).toBe(201);
    assetId = created.body.id;
    expect(
      (
        await request(app)
          .post(`/api/assets/${assetId}/transfer`)
          .auth(token, { type: 'bearer' })
          .send({ departmentId: destinationId, responsible: 'Nova equipe' })
      ).status,
    ).toBe(200);
    expect((await db.patrimony.findUniqueOrThrow({ where: { id: assetId } })).departmentId).toBe(
      destinationId,
    );
    expect(await db.patrimonyTransfer.count({ where: { patrimonyId: assetId } })).toBe(1);
    expect(
      (
        await request(app)
          .put(`/api/assets/${assetId}`)
          .auth(token, { type: 'bearer' })
          .send({ ...created.body, departmentId, value: 2000 })
      ).status,
    ).toBe(400);
  });
  it('gera relatórios auditados e busca global', async () => {
    const report = await request(app).get('/api/reports/movements').auth(token, { type: 'bearer' });
    expect(report.status).toBe(200);
    expect(report.body.rows.some((r: any) => r['Código'] === `TEST-${suffix}`)).toBe(true);
    expect(
      await db.auditLog.count({ where: { operation: 'RELATÓRIO', recordId: 'movements' } }),
    ).toBeGreaterThan(0);
    expect(
      (
        await request(app)
          .get('/api/search?q=TEST-' + suffix)
          .auth(token, { type: 'bearer' })
      ).body.materials[0].id,
    ).toBe(materialId);
  });
  it('redefine a senha uma vez e revoga a sessão anterior', async () => {
    const raw = randomBytes(32).toString('hex');
    await db.passwordReset.create({
      data: {
        userId: resetUserId,
        tokenHash: createHash('sha256').update(raw).digest('hex'),
        expiresAt: new Date(Date.now() + 60000),
      },
    });
    const response = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: raw, password: 'Nova-senha-segura-123!' });
    expect(response.status).toBe(200);
    expect(
      (await request(app).get('/api/auth/me').auth(viewerToken, { type: 'bearer' })).status,
    ).toBe(401);
    expect(
      (
        await request(app)
          .post('/api/auth/reset-password')
          .send({ token: raw, password: 'Outra-senha-segura-123!' })
      ).status,
    ).toBe(400);
  });
});
