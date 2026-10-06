import { useState } from 'react';
import { FileDown, Printer, Table2, FileChartColumn } from 'lucide-react';
import { api } from '../services/api';
import { useApp } from '../contexts/AppContext';
import { periodQuery, date } from '../utils/format';
import { exportPDF, exportExcel, type Report } from '../utils/export';
const kinds: Record<string, string> = {
  stock: 'Estoque atual',
  low: 'Abaixo do estoque mínimo',
  empty: 'Materiais sem estoque',
  entries: 'Entradas',
  exits: 'Saídas',
  movements: 'Movimentações',
  department: 'Consumo por setor',
  period: 'Consumo por período',
  used: 'Materiais mais utilizados',
  suppliers: 'Fornecedores',
  assets: 'Patrimônios',
  transfers: 'Histórico patrimonial',
};
export function Reports() {
  const { toast } = useApp();
  const [kind, setKind] = useState('stock'),
    [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [report, setReport] = useState<Report | null>(null),
    [busy, setBusy] = useState(false);
  const generate = async () => {
    setBusy(true);
    try {
      setReport(await api('/reports/' + kind + '?' + periodQuery(from, to)));
      toast('Relatório gerado.');
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">INFORMAÇÃO PARA DECIDIR</span>
          <h1>Relatórios</h1>
          <p>Consulte, exporte e compartilhe os dados do núcleo.</p>
        </div>
        <FileChartColumn className="large-icon" />
      </div>
      <section className="card no-print">
        <div className="filters filters-labelled">
          <label>
            Relatório
            <select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value);
                setReport(null);
              }}
            >
              {Object.entries(kinds).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label>
            Data inicial
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setReport(null);
              }}
            />
          </label>
          <label>
            Data final
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setReport(null);
              }}
            />
          </label>
          <button
            className="primary"
            disabled={busy || !!(from && to && from > to)}
            onClick={generate}
          >
            {busy ? 'Gerando…' : 'Gerar relatório'}
          </button>
        </div>
        <p className="hint">
          O período filtra movimentações e transferências pela data da operação e patrimônios pela
          aquisição. Estoque e fornecedores representam o cadastro atual.
        </p>
      </section>
      {report ? (
        <section className="card report-preview">
          <div className="report-heading">
            <div>
              <span className="eyebrow">{report.title}</span>
              <h2>{kinds[report.kind]}</h2>
              <p>
                Emissão: {date(report.issuedAt)} · Responsável: {report.user}
              </p>
              <p>
                Período: {report.from ? date(report.from) : 'Sem limite inicial'} a{' '}
                {report.to ? date(report.to) : 'Sem limite final'}
              </p>
            </div>
            <div className="row-actions no-print">
              <button
                onClick={() =>
                  exportPDF(report, kinds[report.kind]).catch((e) => toast(e.message, true))
                }
              >
                <FileDown size={17} /> PDF
              </button>
              <button
                onClick={() =>
                  exportExcel(report, kinds[report.kind]).catch((e) => toast(e.message, true))
                }
              >
                <Table2 size={17} /> Excel
              </button>
              <button onClick={() => window.print()}>
                <Printer size={17} /> Imprimir
              </button>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {Object.keys(report.rows[0] || {}).map((k) => (
                    <th key={k}>{k}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r, i) => (
                  <tr key={i}>
                    {Object.entries(r).map(([k, v]) => (
                      <td key={k}>{String(v ?? '')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {!report.rows.length && <p className="empty">Nenhum registro para este relatório.</p>}
          </div>
        </section>
      ) : (
        <section className="card empty">
          <FileChartColumn size={40} />
          <h2>Escolha o relatório que você precisa.</h2>
          <p>Defina o período e clique em gerar para visualizar os dados.</p>
        </section>
      )}
    </>
  );
}
