import { useState } from 'react';
import { api } from '../services/api';
import { useApp } from '../contexts/AppContext';
import { exportExcelBundle, type Report } from '../utils/export';
import { periodQuery } from '../utils/format';

const options = {
  stock: 'Estoque completo',
  low: 'Abaixo do mínimo',
  empty: 'Sem estoque',
  entries: 'Entradas',
  exits: 'Saídas',
  movements: 'Movimentações',
  department: 'Consumo por setor',
  used: 'Materiais mais utilizados',
  assets: 'Patrimônios',
};
export function StockExcelExport() {
  const { toast } = useApp();
  const [selected, setSelected] = useState<string[]>(['stock', 'low', 'empty']);
  const [categories, setCategories] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const download = async () => {
    setBusy(true);
    try {
      const kinds = [...new Set([...selected, ...(categories ? ['stock'] : [])])];
      const data = await Promise.all(
        kinds.map(async (kind) => ({
          report: await api<Report>('/reports/' + kind + '?' + periodQuery(from, to)),
          label: options[kind as keyof typeof options],
        })),
      );
      const sheets = data.filter(({ report }) => selected.includes(report.kind));
      if (categories) {
        const stock = data.find(({ report }) => report.kind === 'stock')!.report;
        const grouped = new Map<string, Report['rows']>();
        for (const row of stock.rows) {
          const name = String(row.Categoria || 'Sem categoria');
          const rows = grouped.get(name) || [];
          rows.push(row);
          grouped.set(name, rows);
        }
        for (const [name, rows] of grouped)
          sheets.push({ report: { ...stock, rows }, label: name });
        if (!grouped.size && !sheets.length) sheets.push({ report: stock, label: 'Sem registros' });
      }
      await exportExcelBundle(sheets);
      toast('Excel gerado com ' + sheets.length + ' aba(s).');
    } catch (error) {
      toast((error as Error).message, true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card no-print">
      <h2>Exportação de estoque para Excel</h2>
      <p>
        Selecione vários tipos para baixar em um único arquivo .xlsx, com abas separadas, filtros,
        cabeçalhos fixos e totais. A exportação inclui todos os registros de cada relatório.
      </p>
      <fieldset disabled={busy}>
        <legend>Relatórios e organização das abas</legend>
        <div className="appearance-grid">
          {Object.entries(options).map(([key, label]) => (
            <label className="appearance-uppercase" key={key}>
              <input
                type="checkbox"
                checked={selected.includes(key)}
                onChange={(e) =>
                  setSelected((current) =>
                    e.target.checked ? [...current, key] : current.filter((item) => item !== key),
                  )
                }
              />
              {label}
            </label>
          ))}
          <label className="appearance-uppercase">
            <input
              type="checkbox"
              checked={categories}
              onChange={(e) => setCategories(e.target.checked)}
            />
            Uma aba por categoria de material
          </label>
        </div>
        <div className="filters filters-labelled">
          <label>
            Data inicial
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            Data final
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <button type="button" onClick={() => setSelected(Object.keys(options))}>
            Selecionar todos
          </button>
          <button
            type="button"
            onClick={() => {
              setSelected([]);
              setCategories(false);
            }}
          >
            Limpar seleção
          </button>
          <button
            className="primary"
            type="button"
            disabled={(!selected.length && !categories) || !!(from && to && from > to)}
            onClick={download}
          >
            {busy ? 'Gerando Excel…' : 'Baixar Excel com as abas selecionadas'}
          </button>
        </div>
      </fieldset>
      <p className="hint">
        As datas filtram movimentações e aquisição de patrimônios. Os relatórios de estoque
        representam o saldo atual.
      </p>
    </section>
  );
}
