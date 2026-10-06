import { describe, it, expect } from 'vitest';
import { materialSchema } from '../src/schemas/index.js';
const material = {
  code: 'VALIDADE',
  name: 'Material de teste',
  categoryId: 'b554ab48-c893-47f6-8cc9-c91518951132',
};
describe('validade do material', () => {
  it('aceita validade opcional, nula e data sem horário', () => {
    expect(materialSchema.parse(material).expiryDate).toBeUndefined();
    expect(materialSchema.parse({ ...material, expiryDate: null }).expiryDate).toBeNull();
    expect(
      materialSchema.parse({ ...material, expiryDate: '2028-02-29' }).expiryDate?.toISOString(),
    ).toBe('2028-02-29T00:00:00.000Z');
  });
  it('rejeita dias inexistentes e datas com horário', () => {
    for (const expiryDate of ['2026-02-29', '2026-02-30', '2026-13-01', '2026-10-06T12:00:00Z'])
      expect(materialSchema.safeParse({ ...material, expiryDate }).success).toBe(false);
  });
});
