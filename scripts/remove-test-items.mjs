import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'node:fs';
dotenv.config({ path: 'backend/.env', quiet: true });
const db = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL || process.env.DATABASE_URL });
try {
 const result = await db.$transaction(async tx => {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(100002026)`;
  const where = { code: { startsWith: 'TESTE-10000-' } };
  const materials = await tx.material.findMany({ where });
  if (materials.length === 0) return { removed: 0, remainingTestItems: 0 };
  if (materials.length !== 10000 || materials.some(m => !/^TESTE-10000-(0[0-9]{4}|10000)$/.test(m.code) || m.notes !== 'Carga de teste de 10.000 itens; sem valor comercial.' || m.description !== 'Item ficticio para teste do sistema.')) throw new Error('Lote diferente do esperado; nenhuma exclusao realizada.');
  const ids = materials.map(m => m.id);
  const movements = await tx.stockMovement.findMany({ where: { materialId: { in: ids } } });
  if (movements.some(m => m.notes !== 'Saldo inicial ficticio para teste de 10 mil itens.' || m.type !== 'IN' || m.reversalOfId)) throw new Error('Ha movimentacoes posteriores no lote; nenhuma exclusao realizada.');
  const auditLogs = await tx.auditLog.findMany({ where: { recordId: { in: ids } } });
  const beforeOther = await tx.material.count({ where: { NOT: where } });
  if (!process.argv.includes('--execute')) return { testItems: materials.length, movements: movements.length, otherItems: beforeOther };
  const backup = `backups/test-items-before-removal-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  writeFileSync(backup, JSON.stringify({ materials, movements, auditLogs }, null, 2), { flag: 'wx' });
  await tx.$executeRawUnsafe(`DO $purge$ DECLARE item RECORD; BEGIN FOR item IN SELECT id FROM public."Material" WHERE code LIKE 'TESTE-10000-%' LOOP PERFORM set_config('app.purge_material_id', item.id, true); DELETE FROM public."StockMovement" WHERE "materialId" = item.id; END LOOP; END $purge$;`);
  const deletedMovements = { count: movements.length };
  if (await tx.stockMovement.count({ where: { materialId: { in: ids } } }) !== 0) throw new Error('Movimentacoes remanescentes; transacao revertida.');
  const deletedMaterials = await tx.material.deleteMany({ where: { id: { in: ids } } });
  const remainingTestItems = await tx.material.count({ where });
  const afterOther = await tx.material.count({ where: { NOT: where } });
  if (remainingTestItems !== 0 || beforeOther !== afterOther || deletedMaterials.count !== 10000) throw new Error('Verificacao falhou; transacao revertida.');
  return { removed: deletedMaterials.count, removedTestMovements: deletedMovements.count, remainingTestItems, preservedOtherItems: afterOther, backup };
 }, { maxWait: 30000, timeout: 240000 });
 console.log(JSON.stringify(result));
} catch (e) { console.error(e.message); process.exitCode = 1; }
finally { await db.$disconnect(); }
