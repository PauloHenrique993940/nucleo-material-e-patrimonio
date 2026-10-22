import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { api } from '../services/api';
import { useApp } from '../contexts/AppContext';
import type { Row } from '../types';

function qrImage(row: Row, color: string) {
  return QRCode.toDataURL(
    JSON.stringify({ system: 'estoque-material', version: 1, materialId: row.id }),
    {
      width: 400,
      margin: 4,
      errorCorrectionLevel: 'M',
      color: { dark: color, light: '#ffffff' },
    },
  );
}

export function QrLabelEditor() {
  const { toast } = useApp();
  const query = useQuery<Row[]>({ queryKey: ['qr-materials'], queryFn: () => api('/materials') });
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState('all');
  const [category, setCategory] = useState('');
  const [heading, setHeading] = useState('Núcleo de Material e Patrimônio');
  const [columns, setColumns] = useState(3);
  const [copies, setCopies] = useState(1);
  const [fontSize, setFontSize] = useState(10);
  const [font, setFont] = useState('helvetica');
  const [color, setColor] = useState('#174b70');
  const [showName, setShowName] = useState(true);
  const [showBalance, setShowBalance] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [previewPage, setPreviewPage] = useState(0);
  const [images, setImages] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const filtered = useMemo(
    () =>
      (query.data || []).filter(
        (row) =>
          (!category || row.categoryId === category) &&
          (scope !== 'active' || row.active !== false) &&
          (scope !== 'selected' || selected[row.id]) &&
          `${row.name} ${row.code}`
            .toLocaleLowerCase('pt-BR')
            .includes(search.toLocaleLowerCase('pt-BR')),
      ),
    [query.data, category, scope, selected, search],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 12));
  const currentPage = Math.min(previewPage, pages - 1);
  const preview = useMemo(
    () => filtered.slice(currentPage * 12, currentPage * 12 + 12),
    [filtered, currentPage],
  );
  useEffect(() => {
    let cancelled = false;
    setImages({});
    Promise.all(preview.map(async (row) => [row.id, await qrImage(row, color)] as const))
      .then((entries) => {
        if (!cancelled) setImages(Object.fromEntries(entries));
      })
      .catch(() => {
        if (!cancelled) toast('Não foi possível gerar a prévia dos QR Codes.', true);
      });
    return () => {
      cancelled = true;
    };
  }, [preview, color, toast]);
  const exportPDF = async () => {
    setBusy(true);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      const width = 190 / columns;
      const height = columns === 2 ? 86 : columns === 3 ? 68 : 62;
      const rowsPerPage = Math.floor(277 / height);
      const perPage = rowsPerPage * columns;
      let index = 0;
      for (let i = 0; i < filtered.length; i++) {
        const row = filtered[i];
        const image = await qrImage(row, color);
        for (let copy = 0; copy < copies; copy++) {
          if (index > 0 && index % perPage === 0) doc.addPage();
          const slot = index % perPage;
          const x = 10 + (slot % columns) * width;
          const y = 10 + Math.floor(slot / columns) * height;
          doc.setDrawColor(210);
          doc.rect(x, y, width, height);
          doc.setTextColor(25);
          doc.setFont(font, 'normal');
          doc.setFontSize(fontSize);
          if (heading)
            doc.text(doc.splitTextToSize(heading, width - 8).slice(0, 1), x + width / 2, y + 6, {
              align: 'center',
            });
          const size = Math.min(width - 12, height - (showBalance ? 30 : 25));
          doc.addImage(image, 'PNG', x + (width - size) / 2, y + 9, size, size, row.id, 'FAST');
          let textY = y + 11 + size;
          doc.setFontSize(fontSize);
          doc.text(doc.splitTextToSize(row.code, width - 6).slice(0, 1), x + width / 2, textY, {
            align: 'center',
          });
          if (showName) {
            textY += 4;
            doc.setFontSize(Math.min(fontSize, 9));
            doc.text(
              doc.splitTextToSize(row.name || row.code, width - 6).slice(0, 2),
              x + width / 2,
              textY,
              {
                align: 'center',
              },
            );
          }
          if (showBalance) {
            doc.setFontSize(8);
            doc.text(`Saldo: ${row.quantity} ${row.unit}`, x + width / 2, y + height - 4, {
              align: 'center',
            });
          }
          index++;
        }
        if (i % 10 === 0) {
          setProgress(`${i + 1} / ${filtered.length} materiais`);
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
      doc.save('etiquetas-qrcode.pdf');
      toast(`${index} etiquetas geradas em ${doc.getNumberOfPages()} páginas.`);
    } catch (error) {
      toast((error as Error).message, true);
    } finally {
      setBusy(false);
      setProgress('');
    }
  };
  if (query.isPending) return <p role="status">Carregando todos os materiais…</p>;
  if (query.isError)
    return (
      <p role="alert">
        {query.error.message} <button onClick={() => query.refetch()}>Tentar novamente</button>
      </p>
    );
  const categories = [
    ...new Map((query.data || []).map((row) => [row.categoryId, row.category?.name])).entries(),
  ];
  return (
    <div className="qr-editor">
      <p>
        Gere etiquetas de todos os materiais, inclusive os de outras páginas do cadastro. Os QR
        Codes identificam o material e consultam o saldo atual ao serem lidos pelo sistema.
      </p>
      <fieldset disabled={busy} className="document-fields">
        <div className="form-grid">
          <label>
            Pesquisar materiais
            <input value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <label>
            Incluir
            <select value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="all">Todos os materiais</option>
              <option value="active">Somente ativos</option>
              <option value="selected">Somente selecionados</option>
            </select>
          </label>
          <label>
            Categoria
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Todas as categorias</option>
              {categories.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Cabeçalho da etiqueta
            <input maxLength={80} value={heading} onChange={(e) => setHeading(e.target.value)} />
          </label>
          <label>
            Etiquetas por linha
            <select value={columns} onChange={(e) => setColumns(Number(e.target.value))}>
              {[2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            Cópias de cada etiqueta
            <select value={copies} onChange={(e) => setCopies(Number(e.target.value))}>
              {[1, 2, 3, 4, 5, 10].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <label>
            Fonte
            <select value={font} onChange={(e) => setFont(e.target.value)}>
              <option value="helvetica">Arial / Helvetica</option>
              <option value="times">Times</option>
              <option value="courier">Courier</option>
            </select>
          </label>
          <label>
            Tamanho do texto
            <select value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))}>
              {[8, 9, 10, 11, 12].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <label>
            Cor do QR Code
            <select value={color} onChange={(e) => setColor(e.target.value)}>
              <option value="#174b70">Azul escuro</option>
              <option value="#000000">Preto</option>
              <option value="#14532d">Verde escuro</option>
            </select>
          </label>
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={showName}
              onChange={(e) => setShowName(e.target.checked)}
            />{' '}
            Mostrar nome
          </label>
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={showBalance}
              onChange={(e) => setShowBalance(e.target.checked)}
            />{' '}
            Mostrar saldo na geração
          </label>
        </div>
      </fieldset>
      <p role="status">
        {filtered.length} materiais · {filtered.length * copies} etiquetas
        {progress && ` · Gerando ${progress}`}
      </p>
      <div className="form-actions">
        <button className="primary" disabled={busy || !filtered.length} onClick={exportPDF}>
          {busy ? 'Gerando…' : 'Baixar PDF de todos os QR Codes'}
        </button>
      </div>
      <p className="hint">
        Prévia de até 12 materiais por página. Marque as etiquetas para usar a opção “Somente
        selecionados”. O PDF usa papel A4; imprima em escala de 100%.
      </p>
      <div
        className="qr-preview-grid"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {preview.map((row) => (
          <article
            className="qr-preview-label"
            key={row.id}
            style={{
              fontFamily:
                font === 'times' ? 'Times New Roman' : font === 'courier' ? 'Courier New' : 'Arial',
              fontSize,
            }}
          >
            <label className="checkbox-field no-print">
              <input
                type="checkbox"
                aria-label={`Selecionar ${row.name}`}
                checked={!!selected[row.id]}
                onChange={(e) =>
                  setSelected((previous) => ({ ...previous, [row.id]: e.target.checked }))
                }
                disabled={busy}
              />{' '}
              Selecionar
            </label>
            <small>{heading}</small>
            {images[row.id] ? (
              <img src={images[row.id]} alt={`QR Code de ${row.name}`} />
            ) : (
              <span>Gerando…</span>
            )}
            <strong>{row.code}</strong>
            {showName && <span>{row.name}</span>}
            {showBalance && (
              <small>
                Saldo: {row.quantity} {row.unit}
              </small>
            )}
            {images[row.id] && (
              <a download={`qr-${row.id}.png`} href={images[row.id]}>
                Baixar PNG
              </a>
            )}
          </article>
        ))}
      </div>
      <div className="pagination">
        <button disabled={!currentPage || busy} onClick={() => setPreviewPage(currentPage - 1)}>
          Anterior
        </button>
        <span>
          Prévia {currentPage + 1} de {pages}
        </span>
        <button
          disabled={currentPage + 1 >= pages || busy}
          onClick={() => setPreviewPage(currentPage + 1)}
        >
          Próxima
        </button>
      </div>
    </div>
  );
}
