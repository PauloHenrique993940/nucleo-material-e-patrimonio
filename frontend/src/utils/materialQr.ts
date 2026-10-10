import type { Row } from '../types';

export function materialQrPayload(material: Row) {
  return JSON.stringify({
    system: 'estoque-material',
    version: 1,
    materialId: material.id,
    generatedAt: new Date().toISOString(),
    material: Object.fromEntries(
      [
        'code',
        'barcode',
        'name',
        'description',
        'quantity',
        'unit',
        'minimum',
        'maximum',
        'location',
        'shelf',
        'unitPrice',
        'expiryDate',
        'active',
        'notes',
      ].map((key) => [key, material[key] ?? null]),
    ),
    category: material.category?.name ?? null,
    supplier: material.supplier?.name ?? null,
  });
}

export function findScannedMaterial(code: string, materials: Row[]) {
  const value = code.trim();
  try {
    const qr = JSON.parse(value);
    if (qr?.system === 'estoque-material' && qr.version === 1 && typeof qr.materialId === 'string')
      return materials.find((m) => m.id === qr.materialId && m.active !== false);
  } catch {
    /* Also accept existing barcode labels. */
  }
  return materials.find((m) => m.active !== false && (m.code === value || m.barcode === value));
}
