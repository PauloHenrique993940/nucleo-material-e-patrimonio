import { describe, it, expect } from 'vitest';
import { nextBalance } from '../src/utils/stock.js';
describe('Invariantes de estoque', () => {
  it('entrada soma e saída subtrai', () => {
    expect(nextBalance(10, 5, 'IN')).toBe(15);
    expect(nextBalance(10, 5, 'OUT')).toBe(5);
  });
  it('permite consumir exatamente o saldo', () => expect(nextBalance(10, 10, 'OUT')).toBe(0));
  it('bloqueia saldo negativo', () =>
    expect(() => nextBalance(2, 3, 'OUT')).toThrow('Saldo insuficiente'));
  it.each([0, -1, 1.5, NaN, Infinity])('rejeita quantidade inválida %s', (q) =>
    expect(() => nextBalance(10, q, 'IN')).toThrow(),
  );
  it('bloqueia overflow do PostgreSQL', () =>
    expect(() => nextBalance(2147483647, 1, 'IN')).toThrow());
});
