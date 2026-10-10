import { test, expect } from '@playwright/test';
import QRCode from 'qrcode';
import { BinaryBitmap, HybridBinarizer, RGBLuminanceSource, QRCodeReader } from '@zxing/library';
import { materialQrPayload, findScannedMaterial } from '../src/utils/materialQr';

test('QR preserves description and snapshot; stock selection uses current balance', () => {
  const material = {
    id: 'material-id',
    code: 'MAT-001',
    name: 'Álcool em gel',
    description: 'Descrição completa com acentos',
    quantity: 12,
    unit: 'UN',
    active: true,
  };
  const payload = materialQrPayload(material);
  const qr = QRCode.create(payload);
  const scale = 5;
  const size = (qr.modules.size + 8) * scale;
  const pixels = new Int32Array(size * size).fill(0xffffff);
  for (let y = 0; y < qr.modules.size; y++)
    for (let x = 0; x < qr.modules.size; x++)
      if (qr.modules.get(y, x))
        for (let dy = 0; dy < scale; dy++)
          for (let dx = 0; dx < scale; dx++)
            pixels[((y + 4) * scale + dy) * size + (x + 4) * scale + dx] = 0;
  const decoded = new QRCodeReader()
    .decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(pixels, size, size))))
    .getText();
  expect(decoded).toBe(payload);
  expect(JSON.parse(decoded).material.description).toBe(material.description);
  expect(JSON.parse(decoded).material.quantity).toBe(12);
  expect(findScannedMaterial(decoded, [{ ...material, quantity: 7 }])?.quantity).toBe(7);
  expect(findScannedMaterial(decoded, [{ ...material, active: false }])).toBeUndefined();
  expect(findScannedMaterial('MAT-001', [material])?.id).toBe(material.id);
  expect(findScannedMaterial('invalid', [material])).toBeUndefined();
});
