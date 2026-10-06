import { useEffect, useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  Plus,
  Search,
  Pencil,
  History,
  ArrowLeftRight,
  Barcode,
  Trash2,
  ArrowUpDown,
} from 'lucide-react';
import JsBarcode from 'jsbarcode';
import { api } from '../services/api';
import { entities } from '../schemas/entities';
import { useApp } from '../contexts/AppContext';
import { Modal } from '../components/Modal';
import { EntityForm } from '../components/EntityForm';
import { currency, date, status, roles, assetStatuses } from '../utils/format';
import type { Row } from '../types';
function BarcodeLabel({ row }: { row: Row }) {
  const ref = useRef<SVGSVGElement>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    try {
      JsBarcode(ref.current, row.barcode || row.code, {
        format: 'CODE128',
        width: 2,
        height: 65,
        fontSize: 16,
      });
    } catch {
      setError(
        'Cadastre um código de barras com letras sem acentos e números para gerar a etiqueta.',
      );
    }
  }, [row]);
  return (
    <div className="barcode-label">
      <h3>{row.name}</h3>
      <svg ref={ref} role="img" aria-label={`Código de barras ${row.barcode || row.code}`} />
      {error && (
        <p className="error-box" role="alert">
          {error}
        </p>
      )}
      <button disabled={!!error} className="primary" onClick={() => window.print()}>
        Imprimir etiqueta
      </button>
    </div>
  );
}
export function Entities({ kind }: { kind: string }) {
  const config = entities[kind];
  const { user, toast } = useApp();
  const cache = useQueryClient();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || ''),
    [active, setActive] = useState(''),
    [category, setCategory] = useState(''),
    [stock, setStock] = useState(''),
    [sort, setSort] = useState('name'),
    [desc, setDesc] = useState(false),
    [page, setPage] = useState(1),
    [editor, setEditor] = useState<Row | undefined | null>(null),
    [detail, setDetail] = useState<Row | null>(null),
    [transfer, setTransfer] = useState<Row | null>(null),
    [barcode, setBarcode] = useState<Row | null>(null),
    [remove, setRemove] = useState<Row | null>(null);
  const writable = !!user && config.writers.includes(user.role);
  const query = useQuery<Row[]>({ queryKey: [kind], queryFn: () => api('/' + kind) });
  const lookups = useQuery<Record<string, Row[]>>({
    queryKey: ['lookups'],
    queryFn: async () => {
      const [categories, suppliers, departments, materials] = await Promise.all(
        ['categories', 'suppliers', 'departments', 'materials'].map((k) => api<Row[]>('/' + k)),
      );
      return { categories, suppliers, departments, materials };
    },
  });
  const history = useQuery<Row[]>({
    queryKey: [kind, 'history', detail?.id],
    queryFn: () => api(`/${kind}/${detail!.id}/history`),
    enabled: !!detail && ['assets', 'suppliers', 'departments'].includes(kind),
  });
  useEffect(() => {
    setQ(params.get('q') || '');
  }, [params]);
  useEffect(() => {
    setPage(1);
  }, [q, active, category, stock, kind]);
  const value = (r: Row, key: string): any => key.split('.').reduce((v, k) => v?.[k], r);
  const filtered = (query.data || [])
    .filter(
      (r) =>
        JSON.stringify(r).toLowerCase().includes(q.toLowerCase()) &&
        (!active || String(r.active) === active) &&
        (!category || r.categoryId === category) &&
        (!stock || status(r.quantity, r.minimum) === stock),
    )
    .sort((a, b) => {
      const av = value(a, sort),
        bv = value(b, sort);
      return (
        (typeof av === 'number'
          ? av - bv
          : String(av || '').localeCompare(String(bv || ''), 'pt-BR')) * (desc ? -1 : 1)
      );
    });
  const totalPages = Math.max(1, Math.ceil(filtered.length / 15));
  const rows = filtered.slice((page - 1) * 15, page * 15);
  const invalidate = async () => {
    await Promise.all([
      cache.invalidateQueries({ queryKey: [kind] }),
      cache.invalidateQueries({ queryKey: ['lookups'] }),
      cache.invalidateQueries({ queryKey: ['dashboard'] }),
    ]);
  };
  const save = async (data: any) => {
    if (kind === 'materials' && !data.supplierId) data.supplierId = null;
    try {
      await api(`/${kind}${editor?.id ? '/' + editor.id : ''}`, editor?.id ? 'PUT' : 'POST', data);
      toast('Cadastro salvo com sucesso.');
      setEditor(null);
      await invalidate();
    } catch (e) {
      toast((e as Error).message, true);
    }
  };
  const render = (r: Row, key: string) => {
    if (key === 'stockStatus') {
      const s = status(r.quantity, r.minimum);
      return (
        <span
          className={`badge ${s === 'Normal' ? 'normal' : s === 'Sem estoque' || s === 'Crítico' ? 'critical' : 'low'}`}
        >
          {s}
        </span>
      );
    }
    if (key === 'active')
      return (
        <span className={`badge ${r.active ? 'normal' : 'muted'}`}>
          {r.active ? 'Ativo' : 'Inativo'}
        </span>
      );
    if (['unitPrice', 'value'].includes(key)) return currency(r[key]);
    if (key === 'status') return assetStatuses[r.status] || r.status;
    if (key === 'role') return roles[r.role];
    return String(value(r, key) ?? '—');
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">GESTÃO DO NÚCLEO</span>
          <h1>{config.title}</h1>
          <p>{config.description}</p>
        </div>
        {writable && (
          <button className="primary" onClick={() => setEditor(undefined)}>
            <Plus size={18} /> Novo cadastro
          </button>
        )}
      </div>
      <section className="card">
        <div className="filters">
          <div className="search-input">
            <Search size={17} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Pesquisar…"
              aria-label={`Pesquisar ${config.title}`}
            />
          </div>
          {kind !== 'assets' && (
            <select
              aria-label="Status do cadastro"
              value={active}
              onChange={(e) => setActive(e.target.value)}
            >
              <option value="">Todos os status</option>
              <option value="true">Ativos</option>
              <option value="false">Inativos</option>
            </select>
          )}
          {['materials', 'assets'].includes(kind) && (
            <select
              aria-label="Categoria"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Todas as categorias</option>
              {lookups.data?.categories.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          {kind === 'materials' && (
            <select
              aria-label="Situação do estoque"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
            >
              <option value="">Todos os saldos</option>
              {['Normal', 'Baixo', 'Crítico', 'Sem estoque'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          )}
          <span className="record-count">{filtered.length} registros</span>
        </div>
        {query.isPending ? (
          <p className="empty" role="status">
            Carregando cadastros…
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
                    {config.columns.map((c) => (
                      <th key={c.key}>
                        <button
                          className="sort-button"
                          onClick={() => {
                            setSort(c.key);
                            setDesc(sort === c.key ? !desc : false);
                          }}
                        >
                          {c.label}
                          <ArrowUpDown size={12} />
                        </button>
                      </th>
                    ))}
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      {config.columns.map((c) => (
                        <td key={c.key}>{render(r, c.key)}</td>
                      ))}
                      <td>
                        <div className="row-actions">
                          <button
                            aria-label={`Consultar ${r.name}`}
                            title="Consultar detalhes"
                            onClick={() => setDetail(r)}
                          >
                            <History size={17} />
                          </button>
                          {writable && (
                            <button aria-label={`Editar ${r.name}`} onClick={() => setEditor(r)}>
                              <Pencil size={17} />
                            </button>
                          )}
                          {kind === 'assets' && writable && (
                            <button
                              aria-label={`Transferir ${r.name}`}
                              onClick={() => setTransfer(r)}
                            >
                              <ArrowLeftRight size={17} />
                            </button>
                          )}
                          {kind === 'materials' && (
                            <button
                              aria-label={`Código de barras de ${r.name}`}
                              onClick={() => setBarcode(r)}
                            >
                              <Barcode size={17} />
                            </button>
                          )}
                          {kind === 'materials' && user?.role === 'ADMIN' && (
                            <button aria-label={`Excluir ${r.name}`} onClick={() => setRemove(r)}>
                              <Trash2 size={17} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!rows.length && (
                <p className="empty">
                  Nenhum registro encontrado. Ajuste os filtros ou crie um cadastro.
                </p>
              )}
            </div>
            <div className="pagination">
              <span>
                Página {Math.min(page, totalPages)} de {totalPages}
              </span>
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Anterior
              </button>
              <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Próxima
              </button>
            </div>
          </>
        )}
      </section>
      {editor !== null && (
        <Modal
          title={`${editor ? 'Editar' : 'Novo'} ${config.singular}`}
          onClose={() => setEditor(null)}
        >
          <EntityForm
            key={editor?.id || 'new'}
            fields={config.fields.map((f) =>
              kind === 'users' && f.key === 'password' ? { ...f, required: !editor } : f,
            )}
            initial={editor || {}}
            lookups={lookups.data}
            onSubmit={save}
          />
          {kind === 'assets' && editor && (
            <p className="hint">Para alterar o setor, utilize a ação de transferência.</p>
          )}
        </Modal>
      )}
      {detail && (
        <Modal title={detail.name || 'Detalhes'} onClose={() => setDetail(null)}>
          <dl className="detail-grid">
            {config.fields
              .filter((f) => f.key !== 'password')
              .map((f) => (
                <div key={f.key}>
                  <dt>{f.label}</dt>
                  <dd>
                    {f.source
                      ? lookups.data?.[f.source]?.find((r) => r.id === detail[f.key])?.name || '—'
                      : f.type === 'date'
                        ? date(detail[f.key])
                        : typeof detail[f.key] === 'boolean'
                          ? detail[f.key]
                            ? 'Sim'
                            : 'Não'
                          : String(detail[f.key] ?? '—')}
                  </dd>
                </div>
              ))}
            {kind === 'materials' && (
              <div>
                <dt>Quantidade atual</dt>
                <dd>{detail.quantity}</dd>
              </div>
            )}
          </dl>
          {detail.createdAt && <p className="hint">Cadastrado em {date(detail.createdAt)}</p>}
          {['assets', 'suppliers', 'departments'].includes(kind) && (
            <>
              <h3>Histórico</h3>
              {history.isPending ? (
                <p>Carregando…</p>
              ) : history.isError ? (
                <p role="alert">{history.error.message}</p>
              ) : (
                <div className="history-list">
                  {history.data?.map((h) => (
                    <article key={h.id}>
                      <strong>{h.material?.name || `${h.from?.name} → ${h.to?.name}`}</strong>
                      <span>
                        {date(h.date)} · {h.quantity ? `${h.quantity} unidades · ` : ''}
                        {h.user?.name}
                      </span>
                    </article>
                  ))}
                  {!history.data?.length && <p>Nenhum registro no histórico.</p>}
                </div>
              )}
            </>
          )}
        </Modal>
      )}
      {transfer && (
        <Modal title={`Transferir ${transfer.name}`} onClose={() => setTransfer(null)}>
          <EntityForm
            fields={[
              {
                key: 'departmentId',
                label: 'Setor de destino',
                type: 'select',
                source: 'departments',
                required: true,
              },
              { key: 'responsible', label: 'Novo responsável', required: true },
              { key: 'notes', label: 'Observações', type: 'textarea' },
            ]}
            lookups={lookups.data}
            onSubmit={async (data) => {
              try {
                await api(`/assets/${transfer.id}/transfer`, 'POST', data);
                toast('Transferência registrada.');
                setTransfer(null);
                await invalidate();
              } catch (e) {
                toast((e as Error).message, true);
              }
            }}
          />
        </Modal>
      )}
      {barcode && (
        <Modal title="Etiqueta do material" onClose={() => setBarcode(null)}>
          <BarcodeLabel row={barcode} />
        </Modal>
      )}
      {remove && (
        <Modal title="Confirmar exclusão" onClose={() => setRemove(null)}>
          <p>
            Excluir o material <strong>{remove.name}</strong>? Materiais com histórico devem ser
            inativados.
          </p>
          <div className="form-actions">
            <button onClick={() => setRemove(null)}>Cancelar</button>
            <button
              className="danger"
              onClick={async () => {
                try {
                  await api('/materials/' + remove.id, 'DELETE');
                  setRemove(null);
                  toast('Material excluído.');
                  await invalidate();
                } catch (e) {
                  toast((e as Error).message, true);
                }
              }}
            >
              Excluir material
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
