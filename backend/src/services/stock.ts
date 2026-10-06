import { db } from '../repositories/db.js';
import { nextBalance, AppError } from '../utils/stock.js';
import { movementSchema } from '../schemas/index.js';
import { z } from 'zod';
export async function move(
  data: z.infer<typeof movementSchema>,
  userId: string,
  ip?: string,
  reversalOfId?: string,
) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Material" WHERE id = ${data.materialId} FOR UPDATE`;
    const m = await tx.material.findUnique({ where: { id: data.materialId } });
    if (!m || m.deletedAt || (!m.active && !reversalOfId))
      throw new AppError(404, 'Material não disponível.');
    if (!reversalOfId && data.departmentId) {
      const department = await tx.department.findUnique({ where: { id: data.departmentId } });
      if (!department?.active) throw new AppError(400, 'Setor não disponível.');
    }
    if (!reversalOfId && data.supplierId) {
      const supplier = await tx.supplier.findUnique({ where: { id: data.supplierId } });
      if (!supplier?.active) throw new AppError(400, 'Fornecedor não disponível.');
    }
    const balance = nextBalance(m.quantity, data.quantity, data.type);
    await tx.material.update({ where: { id: m.id }, data: { quantity: balance } });
    const movement = await tx.stockMovement.create({
      data: {
        ...data,
        unitPrice: data.type === 'OUT' && !reversalOfId ? m.unitPrice : data.unitPrice,
        date: data.date ? new Date(data.date) : new Date(),
        previousBalance: m.quantity,
        currentBalance: balance,
        userId,
        reversalOfId,
      },
    });
    await tx.auditLog.create({
      data: {
        userId,
        operation: reversalOfId ? 'ESTORNO' : data.type === 'IN' ? 'ENTRADA' : 'SAÍDA',
        recordId: movement.id,
        ip,
      },
    });
    return movement;
  });
}
