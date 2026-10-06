import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { date } from '../utils/format';
import type { Row } from '../types';
export function Audit() {
  const [q, setQ] = useState(''),
    [page, setPage] = useState(1);
  const query = useQuery<Row[]>({ queryKey: ['audit'], queryFn: () => api('/audit') });
  const rows = (query.data || []).filter((r) =>
    JSON.stringify(r).toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">SEGURANÇA E CONTROLE</span>
          <h1>Auditoria</h1>
          <p>Registro das operações importantes e dos usuários responsáveis.</p>
        </div>
      </div>
      <section className="card">
        <div className="filters">
          <input
            aria-label="Pesquisar auditoria"
            placeholder="Buscar usuário, operação ou registro…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
          <span>Últimos 1.000 registros</span>
        </div>
        {query.isPending ? (
          <p role="status" className="empty">
            Carregando auditoria…
          </p>
        ) : query.isError ? (
          <p className="error-box" role="alert">
            {query.error.message}
          </p>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {['Data/hora', 'Usuário', 'Operação', 'Registro afetado', 'IP'].map((x) => (
                      <th key={x}>{x}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice((page - 1) * 20, page * 20).map((r) => (
                    <tr key={r.id}>
                      <td>{date(r.date)}</td>
                      <td>{r.user.name}</td>
                      <td>
                        <span className="badge normal">{r.operation}</span>
                      </td>
                      <td className="mono">{r.recordId}</td>
                      <td>{r.ip || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!rows.length && <p className="empty">Nenhum registro encontrado.</p>}
            </div>
            <div className="pagination">
              <span>
                {rows.length} registros · Página {page}
              </span>
              <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                Anterior
              </button>
              <button disabled={page * 20 >= rows.length} onClick={() => setPage((p) => p + 1)}>
                Próxima
              </button>
            </div>
          </>
        )}
      </section>
    </>
  );
}
