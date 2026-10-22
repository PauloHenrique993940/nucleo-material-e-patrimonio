import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useApp } from '../contexts/AppContext';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { date } from '../utils/format';
import type { Row } from '../types';
export function Audit() {
  const { user, toast } = useApp();
  const [removal, setRemoval] = useState<Row | 'all' | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const admin = user?.role === 'ADMIN';
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
        {admin && (
          <button
            className="danger"
            disabled={query.isPending || query.isError || !query.data?.length || busy}
            onClick={() => {
              setRemoval('all');
              setConfirmation('');
            }}
          >
            <Trash2 size={17} />
            Limpar auditoria
          </button>
        )}
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
                    {admin && <th>Ações</th>}
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
                      {admin && (
                        <td>
                          <div className="row-actions">
                            <button
                              className="action-delete"
                              aria-label={'Excluir registro de ' + date(r.date)}
                              title="Excluir registro"
                              disabled={busy}
                              onClick={() => {
                                setRemoval(r);
                                setConfirmation('');
                              }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      )}
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
      {removal && (
        <Modal
          title={removal === 'all' ? 'Limpar auditoria' : 'Excluir registro de auditoria'}
          onClose={() => {
            if (!busy) setRemoval(null);
          }}
        >
          <p>
            {removal === 'all'
              ? 'Todos os registros de auditoria serão apagados, inclusive os que não aparecem nesta página ou na busca. Novas operações continuarão sendo registradas.'
              : 'Este registro de auditoria será apagado definitivamente.'}
          </p>
          {removal !== 'all' && (
            <p>
              <strong>{removal.operation}</strong> · {date(removal.date)} · {removal.user.name}
            </p>
          )}
          <p className="field-error">A exclusão não pode ser desfeita.</p>
          <label>
            Digite {removal === 'all' ? 'LIMPAR AUDITORIA' : 'EXCLUIR'} para confirmar
            <input
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              disabled={busy}
              autoComplete="off"
            />
          </label>
          <div className="form-actions">
            <button disabled={busy} onClick={() => setRemoval(null)}>
              Cancelar
            </button>
            <button
              className="danger"
              disabled={
                busy || confirmation !== (removal === 'all' ? 'LIMPAR AUDITORIA' : 'EXCLUIR')
              }
              onClick={async () => {
                setBusy(true);
                try {
                  if (removal === 'all') {
                    const result = await api<{ deleted: number }>('/audit', 'DELETE', {
                      confirmation,
                    });
                    toast(result.deleted + ' registros de auditoria apagados.');
                    setQ('');
                  } else {
                    await api('/audit/' + removal.id, 'DELETE', { confirmation });
                    toast('Registro de auditoria apagado.');
                  }
                  setPage(1);
                  setRemoval(null);
                  setConfirmation('');
                  await query.refetch();
                } catch (e) {
                  toast((e as Error).message, true);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy
                ? 'Apagando…'
                : removal === 'all'
                  ? 'Confirmar e limpar tudo'
                  : 'Confirmar exclusão'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
