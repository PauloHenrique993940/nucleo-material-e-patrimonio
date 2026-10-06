import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();
async function main() {
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password || password.length < 12)
    throw new Error('Defina SEED_ADMIN_PASSWORD com pelo menos 12 caracteres.');
  for (const name of ['ADMIN', 'MANAGER', 'OPERATOR', 'VIEWER'] as const)
    await db.role.upsert({ where: { name }, update: {}, create: { name } });
  const role = await db.role.findUniqueOrThrow({ where: { name: 'ADMIN' } });
  const user = await db.user.upsert({
    where: { email: process.env.SEED_ADMIN_EMAIL || 'admin@nucleo.local' },
    update: {},
    create: {
      name: 'Administrador',
      email: process.env.SEED_ADMIN_EMAIL || 'admin@nucleo.local',
      registration: '0001',
      passwordHash: await bcrypt.hash(password, 12),
      roleId: role.id,
    },
  });
  if (process.env.SEED_DEMO_DATA !== 'true') return;
  const categories = [];
  for (const name of [
    'Material de expediente',
    'Informática',
    'Limpeza',
    'Equipamentos',
    'Material operacional',
    'Mobiliário',
    'Consumo',
    'Outros',
  ])
    categories.push(await db.category.upsert({ where: { name }, update: {}, create: { name } }));
  const department = await db.department.upsert({
    where: { name: 'Administração' },
    update: {},
    create: { name: 'Administração', acronym: 'ADM', responsible: 'Equipe administrativa' },
  });
  const supplier = await db.supplier.upsert({
    where: { cnpj: '00000000000000' },
    update: {},
    create: {
      name: 'Fornecedor de demonstração',
      cnpj: '00000000000000',
      tradeName: 'Dados fictícios',
    },
  });
  let sequence = 0;
  for (const [index, name, quantity, price] of [
    [0, 'Papel A4 — resma 500 folhas', 120, 28.9],
    [1, 'Mouse óptico USB', 8, 39.9],
    [2, 'Álcool 70% — 1 litro', 3, 12.5],
    [0, 'Caneta esferográfica azul', 240, 1.8],
    [0, 'Pasta arquivo', 0, 8.5],
  ] as const) {
    const code = 'MAT-' + String(++sequence).padStart(4, '0');
    await db.$transaction(async (tx) => {
      if (await tx.material.findUnique({ where: { code } })) return;
      const material = await tx.material.create({
        data: {
          name,
          code,
          categoryId: categories[index].id,
          minimum: 10,
          unitPrice: price,
          supplierId: supplier.id,
          location: 'Almoxarifado central',
          shelf: 'A-01',
          quantity,
        },
      });
      if (quantity)
        await tx.stockMovement.create({
          data: {
            materialId: material.id,
            type: 'IN',
            quantity,
            previousBalance: 0,
            currentBalance: quantity,
            userId: user.id,
            supplierId: supplier.id,
            receiver: 'Carga inicial',
            unitPrice: price,
          },
        });
      await tx.auditLog.create({
        data: { userId: user.id, operation: 'CARGA INICIAL', recordId: material.id },
      });
    });
  }
  await db.patrimony.upsert({
    where: { number: 'PAT-0001' },
    update: {},
    create: {
      number: 'PAT-0001',
      name: 'Notebook administrativo',
      categoryId: categories[1].id,
      departmentId: department.id,
      responsible: 'Equipe administrativa',
      value: 4200,
      brand: 'Demonstração',
      condition: 'Bom',
    },
  });
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
