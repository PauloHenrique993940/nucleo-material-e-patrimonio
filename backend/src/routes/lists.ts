import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { db } from '../repositories/db.js';
import { stockStatus } from '../utils/status.js';
import { AppError } from '../utils/stock.js';
export const lists = Router();
const pagination = (query: Record<string, unknown>) =>
  query.page
    ? {
        page: z.coerce.number().int().min(1).parse(query.page),
        size: z.coerce.number().int().min(1).max(100).default(20).parse(query.pageSize),
      }
    : null;
lists.get('/materials', async (req, res) => {
  const q = z.string().max(200).default('').parse(req.query.q);
  const sort = z
    .enum(['name', 'code', 'quantity', 'unitPrice', 'createdAt'])
    .default('name')
    .parse(req.query.sort);
  const order = z.enum(['asc', 'desc']).default('asc').parse(req.query.order);
  const paging = pagination(req.query);
  const where: Prisma.MaterialWhereInput = {
    OR: [
      { name: { contains: q, mode: 'insensitive' } },
      { code: { contains: q, mode: 'insensitive' } },
      { barcode: { contains: q, mode: 'insensitive' } },
    ],
    ...(req.query.categoryId ? { categoryId: z.string().uuid().parse(req.query.categoryId) } : {}),
    ...(req.query.supplierId ? { supplierId: z.string().uuid().parse(req.query.supplierId) } : {}),
    ...(req.query.active
      ? { active: z.enum(['true', 'false']).parse(req.query.active) === 'true' }
      : {}),
  };
  const rows = await db.material.findMany({
    where,
    include: { category: true, supplier: true },
    orderBy: { [sort]: order },
  });
  const filtered = req.query.stock
    ? rows.filter((m) => stockStatus(m.quantity, m.minimum) === req.query.stock)
    : rows;
  res.json(
    paging
      ? {
          rows: filtered.slice((paging.page - 1) * paging.size, paging.page * paging.size),
          total: filtered.length,
          page: paging.page,
          pageSize: paging.size,
        }
      : filtered,
  );
});
lists.get('/movements', async (req, res) => {
  const where: Prisma.StockMovementWhereInput = {};
  if (req.query.type) where.type = z.enum(['IN', 'OUT']).parse(req.query.type);
  for (const key of ['materialId', 'departmentId', 'userId', 'supplierId'] as const)
    if (req.query[key]) where[key] = z.string().uuid().parse(req.query[key]);
  if (req.query.categoryId)
    where.material = { categoryId: z.string().uuid().parse(req.query.categoryId) };
  if (req.query.from || req.query.to)
    where.date = {
      ...(req.query.from ? { gte: new Date(z.string().datetime().parse(req.query.from)) } : {}),
      ...(req.query.to ? { lte: new Date(z.string().datetime().parse(req.query.to)) } : {}),
    };
  if (
    req.query.from &&
    req.query.to &&
    new Date(String(req.query.from)) > new Date(String(req.query.to))
  )
    throw new AppError(400, 'Período inválido.');
  const paging = pagination(req.query);
  const rows = await db.stockMovement.findMany({
    where,
    include: {
      material: { include: { category: true } },
      user: { select: { name: true } },
      department: true,
      supplier: true,
      reversal: true,
    },
    orderBy: { createdAt: 'desc' },
    ...(paging ? { skip: (paging.page - 1) * paging.size, take: paging.size } : {}),
  });
  res.json(
    paging
      ? {
          rows,
          total: await db.stockMovement.count({ where }),
          page: paging.page,
          pageSize: paging.size,
        }
      : rows,
  );
});
