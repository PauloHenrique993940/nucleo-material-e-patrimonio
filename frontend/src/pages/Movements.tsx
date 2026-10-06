import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RotateCcw } from 'lucide-react';
import { api } from '../services/api';
import { date, periodQuery } from '../utils/format';
import { useApp } from '../contexts/AppContext';
import { Modal } from '../components/Modal';
import type { Row } from '../types';
export function Movements() {
  const { user, toast } = useApp();
  const cache = useQueryClient();
  const [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [type, setType] = useState(''),
    [material, setMaterial] = useState(''),
    [category, setCategory] = useState(''),
    [department, setDepartment] = useState(''),
    [responsible, setResponsible] = useState(''),
    [page, setPage] = useState(1),
    [reverse, setReverse] = useState<Row | null>(null),
    [notes, setNotes] = useState(''),
    [busy, setBusy] = useState(false);
  const params = new URLSearchParams(periodQuery(from, to));
  if (type) params.set('type', type);
  if (material) params.set('materialId', material);
  if (department) params.set('departmentId', department);
  if (category) params.set('categoryId', category);
  const query = useQuery<Row[]>({
    queryKey: ['movements', params.toString()],
    queryFn: () => api('/movements?' + params),
  });
  const lookups = useQuery<Record<string, Row[]>>({
    queryKey: ['lookups'],
    queryFn: async () => {
      const [categories, suppliers, departments, materials] = await Promise.all(
        ['categories', 'suppliers', 'departments', 'materials'].map((k) => api<Row[]>('/' + k)),
      );
      return { categories, suppliers, departments, materials };
    },
  });
  const rows = (query.data || []).filter((m) =>
    m.user?.name.toLowerCase().includes(responsible.toLowerCase()),
  );
  const pages = Math.max(1, Math.ceil(rows.length / 20));
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">RASTREABILIDADE</span>
          <h1>Movimentações</h1>
          <p>Histórico preservado de todas as entradas, saídas e correções.</p>
        </div>
      </div>
      <section className="card">
        <div className="filters filters-labelled">
          <label>
            Data inicial
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
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
                setPage(1);
              }}
            />
          </label>
          <label>
            Tipo
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todos</option>
              <option value="IN">Entrada</option>
              <option value="OUT">Saída</option>
            </select>
          </label>
          {[
            ['materialId', 'Material', 'materials', material, setMaterial],
            ['categoryId', 'Categoria', 'categories', category, setCategory],
            ['departmentId', 'Setor', 'departments', department, setDepartment],
          ].map(([key, label, source, value, setter]) => (
            <label key={key as string}>
              {label as string}
              <select
                aria-label={label as string}
                value={value as string}
                onChange={(e) => {
                  (setter as (v: string) => void)(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Todos</option>
                {lookups.data?.[source as string]?.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <label>
            Responsável
            <input
              value={responsible}
              onChange={(e) => {
                setResponsible(e.target.value);
                setPage(1);
              }}
              placeholder="Nome do operador"
            />
          </label>
        </div>
        {query.isPending ? (
          <p className="empty" role="status">
            Carregando histórico…
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
                    {[
                      'Data',
                      'Material',
                      'Tipo',
                      'Qtd.',
                      'Saldo anterior',
                      'Saldo atual',
                      'Setor',
                      'Responsável',
                      'Correção',
                    ].map((s) => (
                      <th key={s}>{s}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice((page - 1) * 20, page * 20).map((m) => (
                    <tr key={m.id}>
                      <td>{date(m.date)}</td>
                      <td>
                        {m.material.name}
                        <small>{m.material.code}</small>
                      </td>
                      <td>
                        <span className={`badge ${m.type === 'IN' ? 'normal' : 'low'}`}>
                          {m.type === 'IN' ? '↙ Entrada' : '↗ Saída'}
                        </span>
                      </td>
                      <td>{m.quantity}</td>
                      <td>{m.previousBalance}</td>
                      <td>{m.currentBalance}</td>
                      <td>{m.department?.name || '—'}</td>
                      <td>{m.user.name}</td>
                      <td>
                        {m.reversalOfId ? (
                          'Estorno'
                        ) : m.reversal ? (
                          'Estornado'
                        ) : ['ADMIN', 'MANAGER'].includes(user!.role) ? (
                          <button
                            aria-label={`Estornar movimento de ${m.material.name}`}
                            onClick={() => {
                              setReverse(m);
                              setNotes('');
                            }}
                          >
                            <RotateCcw size={16} /> Estornar
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!rows.length && (
                <p className="empty">Nenhuma movimentação no período selecionado.</p>
              )}
            </div>
            <div className="pagination">
              <span>
                {rows.length} registros · Página {page} de {pages}
              </span>
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Anterior
              </button>
              <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                Próxima
              </button>
            </div>
          </>
        )}
      </section>
      {reverse && (
        <Modal title="Estornar movimentação" onClose={() => !busy && setReverse(null)}>
          <p>
            Será criada uma operação inversa de{' '}
            <strong>
              {reverse.quantity} unidades de {reverse.material.name}
            </strong>
            , preservando o lançamento original.
          </p>
          <label>
            Motivo do estorno
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} minLength={5} />
          </label>
          <div className="form-actions">
            <button disabled={busy} onClick={() => setReverse(null)}>
              Cancelar
            </button>
            <button
              className="danger"
              disabled={busy || notes.trim().length < 5}
              onClick={async () => {
                setBusy(true);
                try {
                  await api(`/movements/${reverse.id}/reverse`, 'POST', { notes });
                  setReverse(null);
                  toast('Estorno registrado.');
                  await Promise.all(
                    ['movements', 'materials', 'lookups', 'dashboard'].map((key) =>
                      cache.invalidateQueries({ queryKey: [key] }),
                    ),
                  );
                } catch (e) {
                  toast((e as Error).message, true);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? 'Registrando…' : 'Confirmar estorno'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
