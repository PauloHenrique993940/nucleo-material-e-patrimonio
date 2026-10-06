import { z } from 'zod';
const text = z.string().trim().max(2000).default('');
const id = z.string().uuid();
export const passwordSchema = z
  .string()
  .min(12, 'Use pelo menos 12 caracteres.')
  .max(72)
  .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, {
    message: 'A senha deve ter até 72 bytes em UTF-8.',
  });
export const userSchema = z.object({
  name: z.string().trim().min(2).max(200),
  email: z.string().trim().email().toLowerCase(),
  registration: z.string().trim().min(1).max(60),
  password: passwordSchema,
  role: z.enum(['ADMIN', 'MANAGER', 'OPERATOR', 'VIEWER']),
  active: z.boolean().default(true),
});
export const materialSchema = z
  .object({
    code: z.string().trim().min(1).max(60),
    barcode: z.string().trim().max(100).nullable().optional(),
    name: z.string().trim().min(2).max(200),
    description: text,
    categoryId: id,
    unit: z.string().min(1).max(20).default('UN'),
    minimum: z.number().int().min(0).max(2147483647).default(5),
    maximum: z.number().int().min(0).max(2147483647).default(1000),
    location: text,
    shelf: text,
    unitPrice: z.number().min(0).max(99999999999).default(0),
    supplierId: id.nullable().optional(),
    active: z.boolean().default(true),
    notes: text,
  })
  .refine((x) => x.maximum >= x.minimum, {
    message: 'Estoque máximo deve ser maior ou igual ao mínimo.',
  });
export const movementSchema = z
  .object({
    materialId: id,
    type: z.enum(['IN', 'OUT']),
    quantity: z.number().int().positive().max(2147483647),
    date: z.string().datetime().optional(),
    departmentId: id.optional(),
    supplierId: id.optional(),
    invoice: text,
    process: text,
    requestNumber: text,
    receiver: z.string().trim().min(2),
    deliverer: text,
    purpose: text,
    notes: text,
    unitPrice: z.number().min(0).max(999999999999.99).default(0),
  })
  .refine((x) => x.type === 'IN' || !!x.departmentId, {
    message: 'Selecione o setor solicitante.',
  })
  .refine((x) => x.type === 'IN' || x.deliverer.trim().length >= 2, {
    message: 'Informe o responsável pela entrega.',
  });
export const categorySchema = z.object({
  name: z.string().trim().min(2),
  description: text,
  active: z.boolean().default(true),
});
export const departmentSchema = z.object({
  name: z.string().trim().min(2),
  acronym: z.string().trim().min(1),
  responsible: text,
  phone: text,
  email: z.union([z.string().email(), z.literal('')]).default(''),
  active: z.boolean().default(true),
});
export const supplierSchema = z.object({
  name: z.string().trim().min(2),
  tradeName: text,
  cnpj: z.string().regex(/^\d{14}$/, 'CNPJ deve conter 14 dígitos.'),
  phone: text,
  email: z.union([z.string().email(), z.literal('')]).default(''),
  address: text,
  responsible: text,
  notes: text,
  active: z.boolean().default(true),
});
export const assetSchema = z.object({
  number: z.string().trim().min(1),
  name: z.string().trim().min(2),
  description: text,
  categoryId: id,
  brand: text,
  model: text,
  serialNumber: text,
  acquisitionDate: z
    .string()
    .datetime()
    .transform((x) => new Date(x)),
  value: z.number().min(0).max(999999999999.99),
  condition: text,
  location: text,
  departmentId: id,
  responsible: z.string().trim().min(2),
  status: z
    .enum(['IN_USE', 'AVAILABLE', 'MAINTENANCE', 'TRANSFERRED', 'DISPOSED'])
    .default('IN_USE'),
});
