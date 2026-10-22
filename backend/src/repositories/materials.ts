import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { db } from './db.js';

const stockExpression = Prisma.sql`CASE
  WHEN m.quantity = 0 THEN 'Sem estoque'
  WHEN m.quantity <= m.minimum AND m.quantity <= GREATEST(1, FLOOR(m.minimum * 0.25)) THEN 'Crítico'
  WHEN m.quantity <= m.minimum THEN 'Baixo'
  ELSE 'Normal' END`;

export async function listMaterials(query: Record<string, unknown>) {
  const q = z.string().max(200).default('').parse(query.q);
  const columns = {
    name: Prisma.sql`m.name`,
    code: Prisma.sql`m.code`,
    quantity: Prisma.sql`m.quantity`,
    unitPrice: Prisma.sql`m."unitPrice"`,
    createdAt: Prisma.sql`m."createdAt"`,
    'category.name': Prisma.sql`c.name`,
    unit: Prisma.sql`m.unit`,
    stockStatus: stockExpression,
    expiryDate: Prisma.sql`m."expiryDate"`,
    active: Prisma.sql`m.active`,
  };
  const sort = z
    .enum([
      'name',
      'code',
      'quantity',
      'unitPrice',
      'createdAt',
      'category.name',
      'unit',
      'stockStatus',
      'expiryDate',
      'active',
    ])
    .default('name')
    .parse(query.sort);
  const order = z.enum(['asc', 'desc']).default('asc').parse(query.order);
  const page = query.page ? z.coerce.number().int().min(1).parse(query.page) : null;
  const size = z.coerce.number().int().min(1).max(100).default(20).parse(query.pageSize);
  // Existing stock forms and exports still request the full list.
  if (!page && !query.stock && !query.expiry && sort !== 'stockStatus') {
    return db.material.findMany({
      where: {
        deletedAt: null,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' as const } },
                { code: { contains: q, mode: 'insensitive' as const } },
                { barcode: { contains: q, mode: 'insensitive' as const } },
              ],
            }
          : {}),
        ...(query.categoryId ? { categoryId: z.string().uuid().parse(query.categoryId) } : {}),
        ...(query.supplierId ? { supplierId: z.string().uuid().parse(query.supplierId) } : {}),
        ...(query.active
          ? { active: z.enum(['true', 'false']).parse(query.active) === 'true' }
          : {}),
      },
      include: { category: true, supplier: true },
      orderBy: [
        sort === 'category.name' ? { category: { name: order } } : { [sort]: order },
        { id: 'asc' },
      ],
    });
  }
  const filters = [Prisma.sql`m."deletedAt" IS NULL`];
  if (q) {
    const pattern = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
    filters.push(Prisma.sql`(m.name ILIKE ${pattern} OR m.code ILIKE ${pattern} OR m.barcode ILIKE ${pattern}
      OR m.description ILIKE ${pattern} OR m.location ILIKE ${pattern} OR m.shelf ILIKE ${pattern}
      OR m.notes ILIKE ${pattern} OR m.unit ILIKE ${pattern} OR c.name ILIKE ${pattern} OR s.name ILIKE ${pattern})`);
  }
  for (const field of ['categoryId', 'supplierId'] as const) {
    if (query[field]) {
      const id = z.string().uuid().parse(query[field]);
      filters.push(
        field === 'categoryId'
          ? Prisma.sql`m."categoryId" = ${id}`
          : Prisma.sql`m."supplierId" = ${id}`,
      );
    }
  }
  if (query.active)
    filters.push(
      Prisma.sql`m.active = ${z.enum(['true', 'false']).parse(query.active) === 'true'}`,
    );
  if (query.stock)
    filters.push(
      Prisma.sql`${stockExpression} = ${z.enum(['Normal', 'Baixo', 'Crítico', 'Sem estoque']).parse(query.stock)}`,
    );
  if (query.expiry) {
    const expiry = z.enum(['expired', 'soon', 'valid', 'missing']).parse(query.expiry);
    const today = Prisma.sql`(CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date`;
    filters.push(
      expiry === 'missing'
        ? Prisma.sql`m."expiryDate" IS NULL`
        : expiry === 'expired'
          ? Prisma.sql`m."expiryDate" < ${today}`
          : expiry === 'soon'
            ? Prisma.sql`m."expiryDate" BETWEEN ${today} AND ${today} + 30`
            : Prisma.sql`m."expiryDate" > ${today} + 30`,
    );
  }
  const from = Prisma.sql`FROM "Material" m JOIN "Category" c ON c.id = m."categoryId"
    LEFT JOIN "Supplier" s ON s.id = m."supplierId" WHERE ${Prisma.join(filters, ' AND ')}`;
  const direction = order === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  const idsQuery = Prisma.sql`SELECT m.id ${from} ORDER BY ${columns[sort]} ${direction} NULLS FIRST, m.id ASC
    ${page ? Prisma.sql`LIMIT ${size} OFFSET ${(page - 1) * size}` : Prisma.empty}`;
  const [ids, counts] = await db.$transaction(
    [
      db.$queryRaw<{ id: string }[]>(idsQuery),
      db.$queryRaw<{ total: number }[]>(Prisma.sql`SELECT COUNT(*)::int AS total ${from}`),
    ],
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
  const found = ids.length
    ? await db.material.findMany({
        where: { id: { in: ids.map((row) => row.id) } },
        include: { category: true, supplier: true },
      })
    : [];
  const byId = new Map(found.map((row) => [row.id, row]));
  const rows = ids.flatMap(({ id }) => (byId.has(id) ? [byId.get(id)!] : []));
  return page ? { rows, total: counts[0].total, page, pageSize: size } : rows;
}
