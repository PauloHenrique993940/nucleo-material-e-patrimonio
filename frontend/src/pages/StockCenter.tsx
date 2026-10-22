import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ClipboardCheck, Download, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import { useApp } from '../contexts/AppContext';
import { Modal } from '../components/Modal';
import { currency } from '../utils/format';
import { expiryInfo } from '../utils/expiry';
import { exportExcelBundle, type Report } from '../utils/export';
import { countDifference, readCounts, replenishment, type Count } from '../utils/planning';
import type { Row } from '../types';
import './StockCenter.css';

const tabs = {
  inventory: 'Inventário físico',
  purchase: 'Reposição de estoque',
  expiry: 'Validades',
} as const;
type Tab = keyof typeof tabs;
const planFor = (row: Row) =>
  replenishment({
    quantity: Number(row.quantity),
    minimum: Number(row.minimum || 0),
    maximum: Number(row.maximum || 0),
    unitPrice: row.unitPrice,
    active: row.active,
  });
export function StockCenter() {
  const { user, toast } = useApp();
  // Remount the draft when a different user starts a session.
  return (
    <StockCenterContent key={user!.id} userId={user!.id} userName={user!.name} toast={toast} />
  );
}
function StockCenterContent({
  userId,
  userName,
  toast,
}: {
  userId: string;
  userName: string;
  toast: (text: string, error?: boolean) => void;
}) {
  const storageKey = 'nucleo-inventory-v1-' + userId;
  const [counts, setCounts] = useState<Record<string, Count>>(() => {
    try {
      return readCounts(localStorage.getItem(storageKey));
    } catch {
      return {};
    }
  });
  const [tab, setTab] = useState<Tab>('inventory');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [scope, setScope] = useState('all');
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [clear, setClear] = useState(false);
  const [saved, setSaved] = useState(true);
  const query = useQuery<Row[]>({
    queryKey: ['stock-center-materials'],
    queryFn: () => api('/materials'),
    refetchOnWindowFocus: false,
  });
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(counts));
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }, [counts, storageKey]);
  const materials = query.data || [];
  const active = materials.filter((row) => row.active !== false);
  const categories = [
    ...new Set(materials.map((row) => String(row.category?.name || 'Sem categoria'))),
  ].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const visible = active.filter((row) => {
    const info = expiryInfo(row.expiryDate);
    const count = countDifference(counts[row.id], row.quantity);
    return (
      (!search ||
        [row.code, row.name, row.location, row.shelf, row.supplier?.name]
          .join(' ')
          .toLocaleLowerCase('pt-BR')
          .includes(search.toLocaleLowerCase('pt-BR'))) &&
      (!category || (row.category?.name || 'Sem categoria') === category) &&
      (tab !== 'purchase' || planFor(row).quantity > 0) &&
      (scope === 'all' ||
        (tab === 'inventory'
          ? scope === 'pending'
            ? !count
            : scope === 'stale'
              ? count?.stale
              : count && count.difference !== 0
          : info.state === scope))
    );
  });
  const pages = Math.max(1, Math.ceil(visible.length / 20));
  const currentPage = Math.min(page, pages);
  const countRows = active.filter((row) => counts[row.id]);
  const divergences = countRows.filter(
    (row) => countDifference(counts[row.id], row.quantity)?.difference !== 0,
  );
  const purchaseRows = active.filter((row) => planFor(row).quantity > 0);
  const expiryRows = active.filter((row) =>
    ['expired', 'soon'].includes(expiryInfo(row.expiryDate).state),
  );
  const updateCount = (row: Row, input: string) => {
    if (input === '') {
      setCounts((value) => {
        const next = { ...value };
        delete next[row.id];
        return next;
      });
      return;
    }
    const quantity = Number(input);
    if (!Number.isSafeInteger(quantity) || quantity < 0) return;
    setCounts((value) => ({
      ...value,
      [row.id]: {
        quantity,
        expected: value[row.id]?.expected ?? row.quantity,
        at: new Date().toISOString(),
      },
    }));
  };
  const exportRows = (rows: Row[], kind: Tab): Report => ({
    title: 'Central de estoque · ' + tabs[kind],
    issuedAt: new Date().toISOString(),
    user: userName,
    kind,
    rows: rows.map((row) => {
      const base = {
        Código: String(row.code),
        Material: row.name,
        Categoria: row.category?.name || '',
        Unidade: row.unit,
        Localização: [row.location, row.shelf].filter(Boolean).join(' · '),
      };
      const count = counts[row.id];
      if (kind === 'inventory')
        return {
          ...base,
          'Saldo atual': row.quantity,
          'Saldo na contagem': count?.expected ?? '',
          Contagem: count?.quantity ?? '',
          Divergência: count ? count.quantity - count.expected : '',
          Conferência: !count
            ? 'Pendente'
            : count.expected !== row.quantity
              ? 'Saldo mudou; reconferir'
              : count.quantity !== count.expected
                ? 'Divergente'
                : 'Conferido',
          'Contado em': count?.at || '',
        };
      if (kind === 'purchase') {
        const plan = planFor(row);
        return {
          ...base,
          Fornecedor: row.supplier?.name || '',
          'Saldo atual': row.quantity,
          Mínimo: row.minimum,
          'Saldo alvo': plan.target,
          Quantidade: plan.quantity,
          'Valor unitário': Number(row.unitPrice || 0),
          'Valor total': plan.cost,
        };
      }
      const info = expiryInfo(row.expiryDate);
      return { ...base, Quantidade: row.quantity, Validade: info.date, Situação: info.label };
    }),
  });
  const download = async (all = false) => {
    setExporting(true);
    try {
      const sheets = all
        ? [
            { report: exportRows(active, 'inventory'), label: tabs.inventory },
            { report: exportRows(purchaseRows, 'purchase'), label: tabs.purchase },
            { report: exportRows(expiryRows, 'expiry'), label: tabs.expiry },
          ]
        : [{ report: exportRows(visible, tab), label: tabs[tab] }];
      await exportExcelBundle(sheets);
      toast('Planilha gerada.');
    } catch (error) {
      toast((error as Error).message, true);
    } finally {
      setExporting(false);
    }
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">CONFERÊNCIA E PLANEJAMENTO</span>
          <h1>Central de estoque</h1>
          <p>Conte os materiais, planeje reposições e acompanhe os vencimentos.</p>
        </div>
        <ClipboardCheck className="large-icon" />
      </div>
      <div className="stock-center-summary">
        <article className="card">
          <span>Materiais contados</span>
          <strong>
            {countRows.length} / {active.length}
          </strong>
        </article>
        <article className="card">
          <span>Com divergência</span>
          <strong>{divergences.length}</strong>
        </article>
        <article className="card">
          <span>Precisam de reposição</span>
          <strong>{purchaseRows.length}</strong>
        </article>
        <article className="card">
          <span>Vencidos ou a vencer</span>
          <strong>{expiryRows.length}</strong>
        </article>
      </div>
      <section className="card">
        <div className="stock-center-tabs" role="group" aria-label="Consulta de estoque">
          {Object.entries(tabs).map(([key, label]) => (
            <button
              type="button"
              key={key}
              aria-pressed={tab === key}
              className={tab === key ? 'primary' : ''}
              onClick={() => {
                setTab(key as Tab);
                setScope('all');
                setPage(1);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="filters filters-labelled">
          <label>
            Pesquisar
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Código, material, local ou fornecedor"
            />
          </label>
          <label>
            Categoria
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todas</option>
              {categories.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
          {tab !== 'purchase' && (
            <label>
              Situação
              <select
                value={scope}
                onChange={(e) => {
                  setScope(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">Todas</option>
                {tab === 'inventory' ? (
                  <>
                    <option value="pending">Não contados</option>
                    <option value="difference">Com divergência</option>
                    <option value="stale">Saldo alterado após contagem</option>
                  </>
                ) : (
                  <>
                    <option value="expired">Vencidos</option>
                    <option value="soon">Vencem em até 30 dias</option>
                    <option value="valid">Dentro da validade</option>
                    <option value="missing">Sem validade informada</option>
                  </>
                )}
              </select>
            </label>
          )}
          <button type="button" disabled={query.isFetching} onClick={() => query.refetch()}>
            <RefreshCw size={16} /> Atualizar saldos
          </button>
          <button
            type="button"
            disabled={exporting || !query.data || query.isError}
            onClick={() => download()}
          >
            <Download size={16} /> Exportar consulta
          </button>
          <button
            type="button"
            disabled={exporting || !query.data || query.isError}
            onClick={() => download(true)}
          >
            Excel completo da central
          </button>
        </div>
        {tab === 'inventory' && (
          <div className="stock-center-note">
            <p>
              Rascunho de conferência salvo neste navegador para seu usuário. A contagem não altera
              o saldo. Se o saldo mudar depois da contagem, reconfira o material antes de registrar
              uma correção.
            </p>
            <p role="status">
              {saved
                ? 'Rascunho salvo neste navegador.'
                : 'Não foi possível salvar. Exporte a contagem antes de sair.'}
            </p>
            <button
              type="button"
              disabled={!Object.keys(counts).length}
              onClick={() => setClear(true)}
            >
              Iniciar nova contagem
            </button>
          </div>
        )}
        {tab === 'purchase' && (
          <p>
            Reposição sugerida para materiais no mínimo ou abaixo dele, até o máximo cadastrado. Sem
            máximo, o alvo é o mínimo + 1. Custo estimado da consulta:{' '}
            <strong>{currency(visible.reduce((sum, row) => sum + planFor(row).cost, 0))}</strong>. A
            sugestão não emite pedido de compra.
          </p>
        )}
        {tab === 'expiry' && (
          <p>
            Validade do cadastro do material, com referência ao dia em Brasília. Confira os lotes
            físicos antes da distribuição.
          </p>
        )}
        {query.isPending ? (
          <p role="status">Carregando materiais…</p>
        ) : query.isError ? (
          <div className="error-box" role="alert">
            {query.error.message}
            <button onClick={() => query.refetch()}>Tentar novamente</button>
          </div>
        ) : (
          <>
            <p>
              {visible.length} materiais na consulta · Atualização:{' '}
              {new Date(query.dataUpdatedAt).toLocaleString('pt-BR')}
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Material / localização</th>
                    <th>Categoria</th>
                    <th>Saldo</th>
                    {tab === 'inventory' ? (
                      <>
                        <th>Contagem física</th>
                        <th>Divergência</th>
                        <th>Conferência</th>
                      </>
                    ) : tab === 'purchase' ? (
                      <>
                        <th>Mínimo / alvo</th>
                        <th>Comprar</th>
                        <th>Custo estimado</th>
                      </>
                    ) : (
                      <>
                        <th>Validade</th>
                        <th>Situação</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {visible.slice((currentPage - 1) * 20, currentPage * 20).map((row) => {
                    const count = counts[row.id];
                    const result = countDifference(count, row.quantity);
                    const plan = planFor(row);
                    const info = expiryInfo(row.expiryDate);
                    return (
                      <tr key={row.id}>
                        <td>{row.code}</td>
                        <td>
                          <Link to={'/materials?q=' + encodeURIComponent(row.code)}>
                            {row.name}
                          </Link>
                          <small className="stock-center-location">
                            {[row.location, row.shelf].filter(Boolean).join(' · ') ||
                              'Local não informado'}
                          </small>
                        </td>
                        <td>{row.category?.name}</td>
                        <td>
                          {row.quantity} {row.unit}
                        </td>
                        {tab === 'inventory' ? (
                          <>
                            <td>
                              <input
                                className="stock-count-input"
                                type="number"
                                min="0"
                                step="1"
                                aria-label={'Contagem de ' + row.code}
                                value={count?.quantity ?? ''}
                                placeholder="Não contado"
                                onChange={(e) => updateCount(row, e.target.value)}
                              />
                            </td>
                            <td>
                              {result
                                ? (result.difference > 0 ? '+' : '') + result.difference
                                : '—'}
                            </td>
                            <td>
                              {result?.stale ? (
                                <span className="badge warning">Saldo mudou; reconferir</span>
                              ) : !result ? (
                                'Pendente'
                              ) : result.difference ? (
                                <span className="badge warning">Divergente</span>
                              ) : (
                                <span className="badge success">Conferido</span>
                              )}
                              {result?.stale && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setCounts((value) => {
                                      const next = { ...value };
                                      delete next[row.id];
                                      return next;
                                    })
                                  }
                                >
                                  Recontar
                                </button>
                              )}
                            </td>
                          </>
                        ) : tab === 'purchase' ? (
                          <>
                            <td>
                              {row.minimum} / {plan.target}
                            </td>
                            <td>
                              {plan.quantity} {row.unit}
                            </td>
                            <td>{currency(plan.cost)}</td>
                          </>
                        ) : (
                          <>
                            <td>{info.date}</td>
                            <td>
                              <span
                                className={
                                  'badge ' +
                                  (info.state === 'expired'
                                    ? 'danger'
                                    : info.state === 'soon'
                                      ? 'warning'
                                      : '')
                                }
                              >
                                {info.label}
                              </span>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!visible.length && (
              <p className="empty">Nenhum material encontrado para esta consulta.</p>
            )}
            <div className="stock-center-pagination">
              <span>
                Página {currentPage} de {pages}
              </span>
              <button disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>
                Anterior
              </button>
              <button disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}>
                Próxima
              </button>
            </div>
          </>
        )}
      </section>
      {clear && (
        <Modal title="Iniciar nova contagem" onClose={() => setClear(false)}>
          <p>
            O rascunho atual será apagado deste navegador. Exporte o inventário para guardar a
            conferência antes de continuar.
          </p>
          <div className="form-actions">
            <button onClick={() => setClear(false)}>Cancelar</button>
            <button
              className="danger"
              onClick={() => {
                setCounts({});
                setClear(false);
              }}
            >
              Apagar rascunho e iniciar
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
