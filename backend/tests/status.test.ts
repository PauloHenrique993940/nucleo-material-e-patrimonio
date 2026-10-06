import { describe, it, expect } from 'vitest';
import { stockStatus } from '../src/utils/status.js';
import { materialSchema, movementSchema } from '../src/schemas/index.js';
describe('Alertas e validação', () => {
  it.each([
    [0, 10, 'Sem estoque'],
    [1, 10, 'Crítico'],
    [2, 10, 'Crítico'],
    [3, 10, 'Baixo'],
    [10, 10, 'Baixo'],
    [11, 10, 'Normal'],
    [1, 0, 'Normal'],
  ])('classifica saldo %s mínimo %s', (q, m, status) =>
    expect(stockStatus(q as number, m as number)).toBe(status),
  );
  it('rejeita limites inconsistentes', () =>
    expect(
      materialSchema.safeParse({
        code: 'A',
        name: 'Papel',
        categoryId: '00000000-0000-4000-8000-000000000001',
        minimum: 10,
        maximum: 5,
      }).success,
    ).toBe(false));
  it('exige setor na saída', () =>
    expect(
      movementSchema.safeParse({
        materialId: '00000000-0000-4000-8000-000000000001',
        type: 'OUT',
        quantity: 1,
        receiver: 'Servidor',
      }).success,
    ).toBe(false));
});
