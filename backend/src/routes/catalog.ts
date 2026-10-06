import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '../repositories/db.js';
import { AppError } from '../utils/stock.js';
import { move } from '../services/stock.js';
import { allow, writers } from '../middlewares/auth.js';
import { publicUser } from '../utils/session.js';
import {
  materialSchema,
  movementSchema,
  categorySchema,
  departmentSchema,
  supplierSchema,
  assetSchema,
  userSchema,
} from '../schemas/index.js';
export const catalog = Router();
const app = catalog;
app.get('/auth/me', async (req, res) =>
  res.json(
    publicUser(
      await db.user.findUniqueOrThrow({ where: { id: req.session.id }, include: { role: true } }),
    ),
  ),
);
app.post('/materials', allow(writers), async (req, res) => {
  const data = materialSchema.parse(req.body);
  const row = await db.$transaction(async (tx) => {
    const row = await tx.material.create({ data });
    await tx.auditLog.create({
      data: { userId: req.session.id, operation: 'CADASTRO', recordId: row.id, ip: req.ip },
    });
    return row;
  });
  res.status(201).json(row);
});
app.put('/materials/:id', allow(writers), async (req, res) => {
  const data = materialSchema.parse(req.body);
  const row = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Material" WHERE id = ${String(req.params.id)} FOR UPDATE`;
    const existing = await tx.material.findUnique({ where: { id: String(req.params.id) } });
    if (!existing || existing.deletedAt) throw new AppError(404, 'Material não disponível.');
    const row = await tx.material.update({ where: { id: String(req.params.id) }, data });
    await tx.auditLog.create({
      data: {
        userId: req.session.id,
        operation: data.active ? 'ALTERAÇÃO' : 'INATIVAÇÃO',
        recordId: row.id,
        ip: req.ip,
      },
    });
    return row;
  });
  res.json(row);
});
app.delete('/materials/:id', allow(['ADMIN']), async (req, res) => {
  const { mode, confirmation } = z
    .object({
      mode: z.enum(['preserve', 'permanent']).default('preserve'),
      confirmation: z.string().optional(),
    })
    .parse(req.body || {});
  await db.$transaction(async (tx) => {
    const id = String(req.params.id);
    await tx.$queryRaw`SELECT id FROM "Material" WHERE id = ${id} FOR UPDATE`;
    const material = await tx.material.findUnique({ where: { id } });
    if (!material) throw new AppError(404, 'Material não encontrado.');
    if (mode === 'permanent') {
      if (confirmation !== material.code)
        throw new AppError(
          400,
          'Digite o código do material para confirmar a exclusão definitiva.',
        );
      await tx.$queryRaw`SELECT set_config('app.purge_material_id', ${id}, true)`;
      // Delete reversals first so their originals do not trigger FK updates.
      await tx.stockMovement.deleteMany({ where: { materialId: id, reversalOfId: { not: null } } });
      await tx.stockMovement.deleteMany({ where: { materialId: id } });
      await tx.material.delete({ where: { id } });
    } else {
      await tx.material.update({ where: { id }, data: { active: false, deletedAt: new Date() } });
    }
    await tx.auditLog.create({
      data: {
        userId: req.session.id,
        operation: mode === 'permanent' ? 'EXCLUSÃO DEFINITIVA' : 'REMOÇÃO DO CADASTRO',
        recordId: id,
        ip: req.ip,
      },
    });
  });
  res.status(204).end();
});
app.post('/movements', allow(writers), async (req, res) =>
  res.status(201).json(await move(movementSchema.parse(req.body), req.session.id, req.ip)),
);
app.post('/movements/:id/reverse', allow(['ADMIN', 'MANAGER']), async (req, res) => {
  const notes = z.string().min(5).parse(req.body.notes);
  const row = await db.stockMovement.findUnique({ where: { id: String(req.params.id) } });
  if (!row || row.reversalOfId) throw new AppError(409, 'Movimentação não pode ser estornada.');
  res.json(
    await move(
      {
        materialId: row.materialId,
        type: row.type === 'IN' ? 'OUT' : 'IN',
        quantity: row.quantity,
        departmentId: row.departmentId || undefined,
        supplierId: row.supplierId || undefined,
        receiver: 'Estorno',
        deliverer: '',
        invoice: '',
        process: '',
        requestNumber: '',
        purpose: 'Correção',
        notes,
        unitPrice: Number(row.unitPrice),
      },
      req.session.id,
      req.ip,
      row.id,
    ),
  );
});
for (const [path, model, schema] of [
  ['categories', 'category', categorySchema],
  ['suppliers', 'supplier', supplierSchema],
  ['departments', 'department', departmentSchema],
  ['assets', 'patrimony', assetSchema],
] as const) {
  app.get('/' + path, async (_req, res) =>
    res.json(await (db[model] as any).findMany({ orderBy: { name: 'asc' } })),
  );
  const roles =
    path === 'assets' ? ['ADMIN', 'MANAGER'] : path === 'categories' ? writers : ['ADMIN'];
  for (const method of ['post', 'put'] as const)
    app[method]('/' + path + (method === 'put' ? '/:id' : ''), allow(roles), async (req, res) => {
      const data = schema.parse(req.body);
      const row = await db.$transaction(async (tx) => {
        if (path === 'assets' && method === 'put') {
          const id = String(req.params.id);
          await tx.$queryRaw`SELECT id FROM "Patrimony" WHERE id = ${id} FOR UPDATE`;
          const old = await tx.patrimony.findUniqueOrThrow({ where: { id } });
          if (old.departmentId !== (data as any).departmentId)
            throw new AppError(400, 'Utilize a transferência para alterar o setor.');
        }
        const row = await (tx[model] as any)[method === 'post' ? 'create' : 'update']({
          ...(method === 'put' ? { where: { id: String(req.params.id) } } : {}),
          data,
        });
        await tx.auditLog.create({
          data: {
            userId: req.session.id,
            operation:
              method === 'post'
                ? 'CADASTRO'
                : 'active' in data && !data.active
                  ? 'INATIVAÇÃO'
                  : 'ALTERAÇÃO',
            recordId: row.id,
            ip: req.ip,
          },
        });
        return row;
      });
      res.status(method === 'post' ? 201 : 200).json(row);
    });
}
app.get('/transfers', async (_req, res) =>
  res.json(
    await db.patrimonyTransfer.findMany({
      include: { patrimony: true, from: true, to: true, user: { select: { name: true } } },
      orderBy: { date: 'desc' },
    }),
  ),
);
app.post('/assets/:id/transfer', allow(['ADMIN', 'MANAGER']), async (req, res) => {
  const data = z
    .object({
      departmentId: z.string().uuid(),
      responsible: z.string().min(2),
      notes: z.string().default(''),
    })
    .parse(req.body);
  res.json(
    await db.$transaction(async (tx) => {
      const id = String(req.params.id);
      await tx.$queryRaw`SELECT id FROM "Patrimony" WHERE id = ${id} FOR UPDATE`;
      const asset = await tx.patrimony.findUniqueOrThrow({ where: { id } });
      if (asset.status === 'DISPOSED' || asset.departmentId === data.departmentId)
        throw new AppError(409, 'Transferência não permitida.');
      const destination = await tx.department.findUnique({ where: { id: data.departmentId } });
      if (!destination?.active) throw new AppError(400, 'Setor de destino não disponível.');
      const row = await tx.patrimonyTransfer.create({
        data: {
          patrimonyId: id,
          fromId: asset.departmentId,
          toId: data.departmentId,
          responsible: data.responsible,
          notes: data.notes,
          userId: req.session.id,
        },
      });
      await tx.patrimony.update({
        where: { id },
        data: {
          departmentId: data.departmentId,
          responsible: data.responsible,
          status: 'TRANSFERRED',
        },
      });
      await tx.auditLog.create({
        data: { userId: req.session.id, operation: 'TRANSFERÊNCIA', recordId: row.id, ip: req.ip },
      });
      return row;
    }),
  );
});
app.get('/users', allow(['ADMIN']), async (_req, res) =>
  res.json(
    (
      await db.user.findMany({
        where: { deletedAt: null },
        include: { role: true },
        orderBy: { name: 'asc' },
      })
    ).map(publicUser),
  ),
);
app.post('/users', allow(['ADMIN']), async (req, res) => {
  const data = userSchema.parse(req.body);
  const role = await db.role.findUniqueOrThrow({ where: { name: data.role } });
  const row = await db.$transaction(async (tx) => {
    const row = await tx.user.create({
      data: {
        name: data.name,
        email: data.email,
        registration: data.registration,
        passwordHash: await bcrypt.hash(data.password, 12),
        roleId: role.id,
        active: data.active,
      },
      include: { role: true },
    });
    await tx.auditLog.create({
      data: { userId: req.session.id, operation: 'CADASTRO USUÁRIO', recordId: row.id, ip: req.ip },
    });
    return row;
  });
  res.status(201).json(publicUser(row));
});
app.get('/audit', allow(['ADMIN']), async (_req, res) =>
  res.json(
    await db.auditLog.findMany({
      include: { user: { select: { name: true } } },
      orderBy: { date: 'desc' },
      take: 1000,
    }),
  ),
);
app.post('/reports/log', allow(['ADMIN', 'MANAGER', 'VIEWER']), async (req, res) => {
  const report = z.string().min(1).max(100).parse(req.body.report);
  await db.auditLog.create({
    data: { userId: req.session.id, operation: 'RELATÓRIO', recordId: report, ip: req.ip },
  });
  res.json({ ok: true });
});
