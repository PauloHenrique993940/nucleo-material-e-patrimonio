import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Link } from 'react-router-dom';
import type { Row } from '../types';
import { materialQrPayload } from '../utils/materialQr';

export function MaterialQrLabel({ row }: { row: Row }) {
  const [image, setImage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    setImage('');
    setError('');
    QRCode.toDataURL(materialQrPayload(row), { width: 640, margin: 4, errorCorrectionLevel: 'L' })
      .then((url) => {
        if (!cancelled) setImage(url);
      })
      .catch(() => {
        if (!cancelled)
          setError(
            'A descrição excede a capacidade de uma etiqueta QR Code. Reduza os textos do cadastro para gerar a etiqueta.',
          );
      });
    return () => {
      cancelled = true;
    };
  }, [row]);
  return (
    <div className="barcode-label material-qr-label">
      <h3>{row.name}</h3>
      <p>
        {row.code} · Saldo na geração: {row.quantity} {row.unit}
      </p>
      <p>{row.description || 'Sem descrição adicional.'}</p>
      {image && (
        <img src={image} alt={`QR Code de ${row.name}`} style={{ width: '100%', maxWidth: 420 }} />
      )}
      {error && (
        <p className="error-box" role="alert">
          {error}
        </p>
      )}
      {!image && !error && <p role="status">Gerando QR Code…</p>}
      <p className="hint">
        QR Code sem vencimento. O saldo impresso é o da geração; a saída usa o saldo atual do
        sistema.
      </p>
      <div className="form-actions">
        <button disabled={!image} className="primary" onClick={() => window.print()}>
          Imprimir QR Code
        </button>
        {image && (
          <a download={`material-${row.code.replace(/[^a-zA-Z0-9_-]/g, '-')}.png`} href={image}>
            Baixar QR Code
          </a>
        )}
        <Link to="/exits?qr=1">Saída por QR Code</Link>
      </div>
    </div>
  );
}
