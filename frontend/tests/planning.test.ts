import { describe, expect, it } from 'vitest';
import { replenishment, countDifference, readCounts } from '../src/utils/planning';

describe('planejamento de reposição', () => {
  it('sugere compra até o máximo quando o saldo chega ao mínimo', () => {
    expect(replenishment({ quantity: 5, minimum: 5, maximum: 20, unitPrice: '2.35' })).toEqual({
      target: 20,
      quantity: 15,
      cost: 35.25,
    });
  });
  it('não sugere compra de material inativo nem acima do mínimo', () => {
    expect(replenishment({ quantity: 6, minimum: 5, maximum: 20 }).quantity).toBe(0);
    expect(replenishment({ quantity: 0, minimum: 5, active: false }).quantity).toBe(0);
  });
  it('usa mínimo mais um quando o máximo não está configurado ou é menor', () => {
    expect(replenishment({ quantity: 0, minimum: 0 }).quantity).toBe(1);
    expect(replenishment({ quantity: 2, minimum: 5, maximum: 3 }).quantity).toBe(4);
  });
});
describe('contagem física', () => {
  const at = '2026-10-21T12:00:00Z';
  it('distingue não contado de contagem zero e preserva a referência original', () => {
    expect(countDifference(undefined, 5)).toBeNull();
    expect(countDifference({ quantity: 0, expected: 5, at }, 5)).toEqual({
      difference: -5,
      stale: false,
    });
    expect(countDifference({ quantity: 3, expected: 5, at }, 8)).toEqual({
      difference: -2,
      stale: true,
    });
  });
  it('descarta rascunhos corrompidos e valores inválidos', () => {
    expect(readCounts('{')).toEqual({});
    expect(readCounts('[]')).toEqual({});
    expect(
      readCounts(
        JSON.stringify({
          good: { quantity: 0, expected: 5, at },
          negative: { quantity: -1, expected: 5, at },
          fraction: { quantity: 1.5, expected: 5, at },
          invalidDate: { quantity: 1, expected: 5, at: 'bad' },
        }),
      ),
    ).toEqual({ good: { quantity: 0, expected: 5, at } });
  });
});
