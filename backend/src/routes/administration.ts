import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { db } from '../repositories/db.js';
import { AppError } from '../utils/stock.js';
import { passwordSchema, userSchema } from '../schemas/index.js';
export const administration = Router();
administration.post('/auth/logout', async (req, res) => {
  await db.user.update({
    where: { id: req.session.id },
    data: { sessionVersion: { increment: 1 } },
  });
  res.status(204).end();
});
administration.post('/auth/change-password', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  keyGenerator: (req) => req.session.id,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Muitas tentativas de alteração de senha. Aguarde 15 minutos.' },
}), async (req, res) => {
  const d = z.object({ currentPassword: z.string().min(1).max(200), password: passwordSchema }).parse(req.body);
  const u = await db.user.findUniqueOrThrow({ where: { id: req.session.id } });
  if (!(await bcrypt.compare(d.currentPassword, u.passwordHash)))
    throw new AppError(400, 'Senha atual incorreta.');
  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: u.id },
      data: { passwordHash: await bcrypt.hash(d.password, 12), sessionVersion: { increment: 1 } },
    });
    await tx.auditLog.create({
      data: { userId: u.id, operation: 'ALTERAÇÃO SENHA', recordId: u.id, ip: req.ip },
    });
  });
  res.json({ message: 'Senha atualizada. Entre novamente.' });
});
administration.put('/users/:id', async (req, res) => {
  if (req.session.role !== 'ADMIN')
    throw new AppError(403, 'Apenas administradores podem alterar usuários.');
  const d = userSchema
    .extend({ active: z.boolean(), password: passwordSchema.optional() })
    .parse(req.body);
  const id = String(req.params.id);
  const existing = await db.user.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) throw new AppError(404, 'Usuário não disponível.');
  if (id === req.session.id && (!d.active || d.role !== 'ADMIN'))
    throw new AppError(409, 'Você não pode remover seu próprio acesso administrativo.');
  const role = await db.role.findUniqueOrThrow({ where: { name: d.role } });
  const u = await db.$transaction(async (tx) => {
    const u = await tx.user.update({
      where: { id },
      data: {
        name: d.name,
        email: d.email,
        registration: d.registration,
        active: d.active,
        roleId: role.id,
        sessionVersion: { increment: 1 },
        ...(d.password ? { passwordHash: await bcrypt.hash(d.password, 12) } : {}),
      },
      include: { role: true },
    });
    await tx.auditLog.create({
      data: {
        userId: req.session.id,
        operation: d.active ? 'ALTERAÇÃO USUÁRIO' : 'INATIVAÇÃO USUÁRIO',
        recordId: id,
        ip: req.ip,
      },
    });
    return u;
  });
  res.json({
    id: u.id,
    name: u.name,
    email: u.email,
    registration: u.registration,
    active: u.active,
    role: u.role.name,
  });
});
administration.delete('/users/:id', async (req, res) => {
  if (req.session.role !== 'ADMIN')
    throw new AppError(403, 'Apenas administradores podem excluir usuários.');
  const id = String(req.params.id);
  if (id === req.session.id) throw new AppError(409, 'Você não pode excluir sua própria conta.');
  await db.$transaction(async (tx) => {
    const result = await tx.user.updateMany({
      where: { id, deletedAt: null },
      data: { active: false, deletedAt: new Date(), sessionVersion: { increment: 1 } },
    });
    if (!result.count) throw new AppError(404, 'Usuário não disponível.');
    await tx.passwordReset.deleteMany({ where: { userId: id } });
    await tx.auditLog.create({
      data: { userId: req.session.id, operation: 'EXCLUSÃO USUÁRIO', recordId: id, ip: req.ip },
    });
  });
  res.status(204).end();
});
administration.get('/suppliers/:id/history', async (req, res) =>
  res.json(
    await db.stockMovement.findMany({
      where: { supplierId: String(req.params.id) },
      include: { material: true, user: { select: { name: true } } },
      orderBy: { date: 'desc' },
    }),
  ),
);
administration.get('/departments/:id/history', async (req, res) =>
  res.json(
    await db.stockMovement.findMany({
      where: { departmentId: String(req.params.id), type: 'OUT' },
      include: { material: true, user: { select: { name: true } } },
      orderBy: { date: 'desc' },
    }),
  ),
);
administration.get('/assets/:id/history', async (req, res) =>
  res.json(
    await db.patrimonyTransfer.findMany({
      where: { patrimonyId: String(req.params.id) },
      include: { from: true, to: true, user: { select: { name: true } } },
      orderBy: { date: 'desc' },
    }),
  ),
);

administration.delete('/audit', async (req, res) => {
  if (req.session.role !== 'ADMIN')
    throw new AppError(403, 'Apenas administradores podem limpar a auditoria.');
  z.object({ confirmation: z.literal('LIMPAR AUDITORIA') }).parse(req.body);
  const result = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.purge_audit', 'true', true)`;
    return tx.auditLog.deleteMany({});
  });
  res.json({ deleted: result.count });
});
administration.delete('/audit/:id', async (req, res) => {
  if (req.session.role !== 'ADMIN')
    throw new AppError(403, 'Apenas administradores podem excluir registros de auditoria.');
  const id = z.string().uuid().parse(req.params.id);
  z.object({ confirmation: z.literal('EXCLUIR') }).parse(req.body);
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.purge_audit', 'true', true)`;
    const result = await tx.auditLog.deleteMany({ where: { id } });
    if (!result.count) throw new AppError(404, 'Registro de auditoria não encontrado.');
  });
  res.status(204).end();
});
