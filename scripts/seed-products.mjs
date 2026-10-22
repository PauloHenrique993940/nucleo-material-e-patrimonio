import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: 'backend/.env', quiet: true });
const db = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL || process.env.DATABASE_URL });
const prefix = 'DEMO-5000-';
try {
  const result = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(50002026)`;
    const before = await tx.material.count();
    const category = await tx.category.upsert({
      where: { name: 'Produtos demonstrativos' },
      update: {},
      create: { name: 'Produtos demonstrativos', description: '5.000 cadastros fictícios adicionados a pedido para demonstração.' },
    });
    let inserted = 0;
    for (let offset = 0; offset < 5000; offset += 500) {
      const batch = await tx.material.createMany({
        skipDuplicates: true,
        data: Array.from({ length: 500 }, (_, index) => {
          const number = String(offset + index + 1).padStart(5, '0');
          return {
            code: `${prefix}${number}`,
            name: `Produto demonstrativo ${number}`,
            categoryId: category.id,
            description: 'Cadastro fictício para demonstração do sistema.',
            notes: 'Dados demonstrativos. Saldo zero; preço não informado.',
            quantity: 0,
            unitPrice: 0,
          };
        }),
      });
      inserted += batch.count;
    }
    const demo = await tx.material.count({ where: { code: { startsWith: prefix } } });
    if (demo !== 5000) throw new Error(`Contagem inesperada: ${demo}`);
    const total = await tx.material.count();
    if (total !== before + inserted) throw new Error('Contagem total divergente.');
    return { before, inserted, demo, total };
  }, { timeout: 120000 });
  console.log(JSON.stringify(result));
} finally {
  await db.$disconnect();
}
