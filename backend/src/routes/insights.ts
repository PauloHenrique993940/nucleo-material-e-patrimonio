import { Router } from 'express';
import { z } from 'zod';
import { db } from '../repositories/db.js';
import { stockStatus } from '../utils/status.js';
import { AppError } from '../utils/stock.js';
export const insights = Router();
insights.get('/search', async (req, res) => {
  const q = z.string().trim().min(2).max(100).parse(req.query.q);
  const contains = { contains: q, mode: 'insensitive' as const };
  const [materials, assets, suppliers, departments] = await Promise.all([
    db.material.findMany({
      where: {
        deletedAt: null,
        OR: [{ name: contains }, { code: contains }, { barcode: contains }],
      },
      take: 8,
      select: { id: true, name: true, code: true },
    }),
    db.patrimony.findMany({
      where: { OR: [{ name: contains }, { number: contains }] },
      take: 8,
      select: { id: true, name: true, number: true },
    }),
    db.supplier.findMany({
      where: { OR: [{ name: contains }, { cnpj: contains }] },
      take: 8,
      select: { id: true, name: true },
    }),
    db.department.findMany({
      where: { OR: [{ name: contains }, { acronym: contains }] },
      take: 8,
      select: { id: true, name: true },
    }),
  ]);
  res.json({ materials, assets, suppliers, departments });
});
insights.get('/dashboard', async (_req, res) => {
  const now = new Date();
  const month = new Date(now.getFullYear(), now.getMonth(), 1);
  const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const [materials, movements, latest, assets] = await Promise.all([
    db.material.findMany({ where: { active: true, deletedAt: null }, include: { category: true } }),
    db.stockMovement.findMany({
      where: { date: { gte: start, lte: now } },
      include: { material: { select: { name: true } } },
      orderBy: { date: 'asc' },
    }),
    db.stockMovement.findMany({
      take: 8,
      orderBy: { createdAt: 'desc' },
      include: { material: true, department: true, user: { select: { name: true } } },
    }),
    db.patrimony.count(),
  ]);
  const series = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    return {
      key: `${d.getFullYear()}-${d.getMonth()}`,
      month: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
      entrada: 0,
      saida: 0,
      estoque: 0,
    };
  });
  const top = new Map<string, { name: string; quantity: number }>();
  for (const m of movements) {
    const point = series.find((x) => x.key === `${m.date.getFullYear()}-${m.date.getMonth()}`);
    if (point) point[m.type === 'IN' ? 'entrada' : 'saida'] += m.quantity;
    const item = top.get(m.materialId) || { name: m.material.name, quantity: 0 };
    item.quantity += m.quantity;
    top.set(m.materialId, item);
  }
  const quantity = materials.reduce((n, m) => n + m.quantity, 0);
  // Replay the ledger by creation time, including inactive materials; operational dates may be backdated.
  const ledger = await db.stockMovement.findMany({
    where: { createdAt: { gte: start, lte: now } },
    select: { createdAt: true, type: true, quantity: true },
  });
  const currentTotal = await db.material.aggregate({ _sum: { quantity: true } });
  let balance =
    (currentTotal._sum.quantity || 0) -
    ledger.reduce((n, m) => n + (m.type === 'IN' ? m.quantity : -m.quantity), 0);
  for (const point of series) {
    for (const m of ledger)
      if (point.key === `${m.createdAt.getFullYear()}-${m.createdAt.getMonth()}`)
        balance += m.type === 'IN' ? m.quantity : -m.quantity;
    point.estoque = balance;
  }
  const categories = new Map<string, number>();
  for (const m of materials)
    categories.set(m.category.name, (categories.get(m.category.name) || 0) + 1);
  res.json({
    cards: {
      materials: materials.length,
      quantity,
      low: materials.filter((m) => m.quantity > 0 && m.quantity <= m.minimum).length,
      empty: materials.filter((m) => m.quantity === 0).length,
      entries: movements
        .filter((m) => m.type === 'IN' && m.date >= month)
        .reduce((n, m) => n + m.quantity, 0),
      exits: movements
        .filter((m) => m.type === 'OUT' && m.date >= month)
        .reduce((n, m) => n + m.quantity, 0),
      value: materials.reduce((n, m) => n + m.quantity * Number(m.unitPrice), 0),
      assets,
    },
    series,
    top: [...top.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 6),
    categories: [...categories].map(([name, value]) => ({ name, value })),
    latest,
    alerts: materials
      .filter((m) => m.quantity <= m.minimum)
      .map((m) => ({
        id: m.id,
        name: m.name,
        quantity: m.quantity,
        status: stockStatus(m.quantity, m.minimum),
      })),
  });
});
const kinds = [
  'stock',
  'low',
  'empty',
  'entries',
  'exits',
  'movements',
  'department',
  'period',
  'used',
  'suppliers',
  'assets',
  'transfers',
] as const;
insights.get('/reports/:kind', async (req, res) => {
  if (!['ADMIN', 'MANAGER', 'VIEWER'].includes(req.session.role))
    throw new AppError(403, 'Seu perfil não permite relatórios.');
  const kind = z.enum(kinds).parse(req.params.kind);
  const from = req.query.from ? new Date(z.string().datetime().parse(req.query.from)) : undefined;
  const to = req.query.to ? new Date(z.string().datetime().parse(req.query.to)) : undefined;
  if (from && to && from > to) throw new AppError(400, 'Período inválido.');
  const date = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
  let rows: Record<string, unknown>[];
  if (['stock', 'low', 'empty'].includes(kind)) {
    const materials = await db.material.findMany({
      where: { deletedAt: null },
      include: { category: true, supplier: true },
      orderBy: { name: 'asc' },
    });
    rows = materials
      .filter(
        (m) => kind === 'stock' || (kind === 'empty' ? m.quantity === 0 : m.quantity <= m.minimum),
      )
      .map((m) => ({
        Código: m.code,
        Material: m.name,
        Categoria: m.category.name,
        Unidade: m.unit,
        Validade: m.expiryDate
          ? m.expiryDate.toISOString().slice(0, 10).split('-').reverse().join('/')
          : 'Não informada',
        Quantidade: m.quantity,
        Mínimo: m.minimum,
        'Valor unitário': Number(m.unitPrice),
        'Valor total': m.quantity * Number(m.unitPrice),
        Situação: stockStatus(m.quantity, m.minimum),
        Ativo: m.active ? 'Sim' : 'Não',
      }));
  } else if (kind === 'suppliers')
    rows = (await db.supplier.findMany({ orderBy: { name: 'asc' } })).map((s) => ({
      'Razão social': s.name,
      'Nome fantasia': s.tradeName,
      CNPJ: s.cnpj,
      Telefone: s.phone,
      'E-mail': s.email,
      Responsável: s.responsible,
      Ativo: s.active ? 'Sim' : 'Não',
    }));
  else if (kind === 'assets')
    rows = (
      await db.patrimony.findMany({
        include: { category: true, department: true },
        where: { acquisitionDate: date },
      })
    ).map((a) => ({
      Tombamento: a.number,
      Bem: a.name,
      Categoria: a.category.name,
      Setor: a.department.name,
      Responsável: a.responsible,
      Situação: a.status,
      Aquisição: a.acquisitionDate.toISOString(),
      Valor: Number(a.value),
    }));
  else if (kind === 'transfers')
    rows = (
      await db.patrimonyTransfer.findMany({
        where: { date },
        include: { patrimony: true, from: true, to: true, user: true },
      })
    ).map((t) => ({
      Data: t.date.toISOString(),
      Tombamento: t.patrimony.number,
      Origem: t.from.name,
      Destino: t.to.name,
      Responsável: t.responsible,
      Operador: t.user.name,
    }));
  else {
    const movements = await db.stockMovement.findMany({
      where: {
        date,
        ...(kind === 'entries'
          ? { type: 'IN' as const }
          : kind === 'exits'
            ? { type: 'OUT' as const }
            : ['department', 'period', 'used'].includes(kind)
              ? {
                  OR: [
                    { type: 'OUT' as const, reversalOfId: null },
                    { type: 'IN' as const, reversalOf: { type: 'OUT' as const } },
                  ],
                }
              : {}),
        ...(req.query.departmentId
          ? { departmentId: z.string().uuid().parse(req.query.departmentId) }
          : {}),
      },
      include: { material: true, department: true, supplier: true, user: true },
      orderBy: { date: 'asc' },
    });
    if (['department', 'period', 'used'].includes(kind)) {
      const groups = new Map<string, { quantity: number; value: number }>();
      for (const m of movements) {
        const key =
          kind === 'department'
            ? m.department?.name || 'Sem setor'
            : kind === 'period'
              ? m.date.toISOString().slice(0, 7)
              : `${m.material.code} — ${m.material.name}`;
        const row = groups.get(key) || { quantity: 0, value: 0 };
        const signed = m.type === 'OUT' ? m.quantity : -m.quantity;
        row.quantity += signed;
        row.value += signed * Number(m.unitPrice);
        groups.set(key, row);
      }
      rows = [...groups]
        .map(([name, v]) => ({ Grupo: name, Quantidade: v.quantity, 'Valor total': v.value }))
        .sort((a, b) => b.Quantidade - a.Quantidade);
    } else
      rows = movements.map((m) => ({
        Data: m.date.toISOString(),
        Material: m.material.name,
        Código: m.material.code,
        Tipo: m.type === 'IN' ? 'Entrada' : 'Saída',
        Quantidade: m.quantity,
        'Saldo anterior': m.previousBalance,
        'Saldo atual': m.currentBalance,
        Setor: m.department?.name || '',
        Fornecedor: m.supplier?.name || '',
        Responsável: m.user.name,
        'Valor total': m.quantity * Number(m.unitPrice),
        'Estorno de': m.reversalOfId || '',
      }));
  }
  const user = await db.user.findUniqueOrThrow({ where: { id: req.session.id } });
  await db.auditLog.create({
    data: { userId: req.session.id, operation: 'RELATÓRIO', recordId: kind, ip: req.ip },
  });
  res.json({
    title: 'Núcleo de Material e Patrimônio',
    issuedAt: new Date().toISOString(),
    user: user.name,
    from: from?.toISOString(),
    to: to?.toISOString(),
    kind,
    rows,
  });
});
