import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { db } from '../repositories/db.js';
import { listMaterials } from '../repositories/materials.js';
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
  res.json(await listMaterials(req.query));
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
