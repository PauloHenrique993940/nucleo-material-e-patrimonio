import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';

dotenv.config({ path: 'backend/.env', quiet: true });
const db = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL || process.env.DATABASE_URL });
const prefix = 'TESTE-10000-';
const groups = [
  ['Expediente - Teste', ['Caneta azul', 'Papel A4', 'Pasta arquivo', 'Grampeador', 'Caderno']],
  ['Informatica - Teste', ['Mouse USB', 'Teclado USB', 'Cabo HDMI', 'Adaptador USB', 'Pendrive']],
  ['Limpeza - Teste', ['Detergente', 'Sabao liquido', 'Pano de limpeza', 'Vassoura', 'Esponja']],
  ['Ferramentas - Teste', ['Chave de fenda', 'Alicate', 'Martelo', 'Trena', 'Chave inglesa']],
  ['Copa - Teste', ['Copo', 'Xicara', 'Garrafa termica', 'Prato', 'Talher']],
  ['Eletrica - Teste', ['Lampada LED', 'Tomada', 'Interruptor', 'Extensao', 'Cabo eletrico']],
  ['Hidraulica - Teste', ['Torneira', 'Conexao PVC', 'Registro', 'Mangueira', 'Fita veda rosca']],
  ['Protecao - Teste', ['Luva de protecao', 'Oculos de seguranca', 'Capacete', 'Protetor auricular', 'Mascara']],
  ['Organizacao - Teste', ['Caixa organizadora', 'Etiqueta', 'Bandeja', 'Porta documentos', 'Divisoria']],
  ['Manutencao - Teste', ['Parafuso', 'Porca', 'Arruela', 'Bucha', 'Fita isolante']],
];
try {
  const result = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(100002026)`;
    const user = await tx.user.findFirst({ where: { active: true, deletedAt: null, role: { name: 'ADMIN' } }, select: { id: true } });
    if (!user) throw new Error('Administrador ativo necessario para registrar a carga.');
    const before = await tx.material.count();
    const categories = [];
    for (const [name] of groups) categories.push(await tx.category.upsert({ where: { name }, update: {}, create: { name, description: 'Categoria ficticia para testes de 10 mil itens.' } }));
    const existing = new Set((await tx.material.findMany({ where: { code: { startsWith: prefix } }, select: { code: true } })).map(m => m.code));
    let inserted = 0;
    for (let offset = 0; offset < 10000; offset += 500) {
      const materials = Array.from({ length: 500 }, (_, index) => {
        const n = offset + index;
        const group = n % groups.length;
        const number = String(n + 1).padStart(5, '0');
        return { id: randomUUID(), code: `${prefix}${number}`, name: `${groups[group][1][Math.floor(n / groups.length) % 5]} - Teste ${number}`, categoryId: categories[group].id, quantity: (n % 200) + 1, minimum: 10, maximum: 1000, unitPrice: 0, location: 'Estoque de teste', description: 'Item ficticio para teste do sistema.', notes: 'Carga de teste de 10.000 itens; sem valor comercial.' };
      }).filter(m => !existing.has(m.code));
      if (!materials.length) continue;
      await tx.material.createMany({ data: materials });
      await tx.stockMovement.createMany({ data: materials.map(m => ({ materialId: m.id, type: 'IN', quantity: m.quantity, previousBalance: 0, currentBalance: m.quantity, userId: user.id, receiver: 'Carga de teste', notes: 'Saldo inicial ficticio para teste de 10 mil itens.', unitPrice: 0 })) });
      await tx.auditLog.createMany({ data: materials.map(m => ({ userId: user.id, operation: 'CARGA INICIAL TESTE 10000', recordId: m.id })) });
      inserted += materials.length;
    }
    const where = { code: { startsWith: prefix } };
    const count = await tx.material.count({ where });
    const movements = await tx.stockMovement.count({ where: { material: where } });
    const totals = await tx.material.aggregate({ where, _sum: { quantity: true }, _min: { quantity: true }, _max: { quantity: true } });
    const total = await tx.material.count();
    if (count !== 10000 || movements !== 10000 || total !== before + inserted) throw new Error('Contagens divergentes; carga cancelada.');
    return { before, inserted, testItems: count, initialMovements: movements, total, quantities: totals, categories: categories.length };
  }, { maxWait: 30000, timeout: 240000 });
  console.log(JSON.stringify(result));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
