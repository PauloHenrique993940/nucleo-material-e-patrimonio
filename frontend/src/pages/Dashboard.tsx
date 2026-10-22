import { useDashboard } from '../hooks/useDashboard';
import { Link } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import {
  Package,
  Boxes,
  TriangleAlert,
  PackageX,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  Building2,
  ArrowRight,
  Truck,
  Network,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import { currency, date } from '../utils/format';
export function Dashboard() {
  const query = useDashboard();
  const { user } = useApp();
  if (query.isPending) return <p role="status">Carregando visão geral…</p>;
  if (query.isError && !query.data)
    return (
      <div className="error-box" role="alert">
        {query.error.message}
        <button onClick={() => query.refetch()}>Tentar novamente</button>
      </div>
    );
  const d = query.data;
  const cards = [
    ['Materiais cadastrados', d.cards.materials, Package],
    ['Sem estoque', d.cards.empty, PackageX],
    ['Entradas no mês', d.cards.entries, ArrowDownLeft],
    ['Saídas no mês', d.cards.exits, ArrowUpRight],
    ['Bens patrimoniais', d.cards.assets, Building2],
  ] as const;
  const summary = [
    ['Materiais com estoque baixo', d.cards.low, TriangleAlert, 'warning'],
    ['Quantidade de itens no estoque', d.cards.quantity, Boxes, 'quantity'],
    ['Custo total do estoque', currency(d.cards.value), Wallet, 'value'],
  ] as const;
  const shortcuts = [
    ['/materials', 'Materiais', 'Cadastro de materiais.', Boxes],
    ['/entries', 'Entradas', 'Gerenciar entradas de materiais no estoque.', Package],
    ['/exits', 'Saídas', 'Gerenciar saídas de materiais do estoque.', Package],
    ['/assets', 'Patrimônio', 'Consultar e gerenciar bens patrimoniais.', Building2],
    ['/suppliers', 'Fornecedores', 'Cadastro de fornecedores.', Truck],
    ['/departments', 'Setores', 'Cadastro de setores.', Network],
  ] as const;
  return (
    <div className="reference-dashboard">
      <div className="page-heading dashboard-heading">
        <h1>Dashboard</h1>
      </div>
      <div className="dashboard-summary">
        {summary.map(([label, value, Icon, tone]) => (
          <article className={'summary-card summary-' + tone} key={label}>
            <div>
              <span>{label}</span>
              <strong>{typeof value === 'number' ? value.toLocaleString('pt-BR') : value}</strong>
            </div>
            <Icon size={32} aria-hidden="true" />
          </article>
        ))}
      </div>
      <section className="dashboard-shortcuts" aria-labelledby="shortcuts-heading">
        <h2 id="shortcuts-heading">Atalhos</h2>
        <div className="shortcut-grid">
          {shortcuts
            .filter(([path]) => !(user?.role === 'VIEWER' && ['/entries', '/exits'].includes(path)))
            .map(([path, label, description, Icon]) => (
              <Link className="shortcut-card" to={path} key={path}>
                <Icon size={48} strokeWidth={1.6} aria-hidden="true" />
                <span className="shortcut-label">{label}</span>
                <p>{description}</p>
              </Link>
            ))}
        </div>
      </section>
      <div className="stat-grid">
        {cards.map(([label, value, Icon], i) => (
          <article className="stat-card" key={label}>
            <div className={`stat-icon tone-${[0, 3, 4, 5, 7][i]}`}>
              <Icon size={20} />
            </div>
            <span>{label}</span>
            <strong>{typeof value === 'number' ? value.toLocaleString('pt-BR') : value}</strong>
            <small>
              {i === 1
                ? 'Acompanhe a reposição'
                : i === 2
                  ? 'Unidades recebidas no mês'
                  : i === 3
                    ? 'Unidades entregues no mês'
                    : 'Dados do cadastro atual'}
            </small>
          </article>
        ))}
      </div>
      <div className="chart-grid">
        <section className="card">
          <div className="card-heading">
            <h2>Entradas e saídas</h2>
            <span>Últimos 12 meses</span>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={d.series}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis width={40} />
              <Tooltip />
              <Bar
                isAnimationActive={false}
                dataKey="entrada"
                name="Entradas"
                fill="var(--chart-in)"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                isAnimationActive={false}
                dataKey="saida"
                name="Saídas"
                fill="var(--chart-out)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
          <div className="chart-legend">
            <span>● Entradas</span>
            <span>● Saídas</span>
          </div>
        </section>
        <section className="card">
          <div className="card-heading">
            <h2>Materiais por categoria</h2>
            <span>Cadastros ativos</span>
          </div>
          {d.categories.length ? (
            <>
              <ResponsiveContainer width="100%" height={215}>
                <PieChart>
                  <Pie
                    isAnimationActive={false}
                    data={d.categories}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={65}
                    outerRadius={90}
                    paddingAngle={3}
                  >
                    {d.categories.map((_: unknown, i: number) => (
                      <Cell
                        key={i}
                        fill={
                          ['#19456b', '#168064', '#c65a12', '#d69a27', '#6d8ba3', '#4e988a'][i % 6]
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="category-legend">
                {d.categories.map((c: any) => (
                  <span key={c.name}>
                    {c.name} <b>{c.value}</b>
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p className="empty">Cadastre materiais para visualizar a distribuição.</p>
          )}
        </section>
        <section className="card">
          <div className="card-heading">
            <h2>Mais movimentados</h2>
            <span>Últimos 12 meses</span>
          </div>
          {d.top.length ? (
            <div
              className="ranking-chart-scroll"
              tabIndex={0}
              role="region"
              aria-label="Materiais mais movimentados, role para ver todos"
            >
              <div
                className="ranking-chart-canvas"
                style={{ height: Math.max(260, d.top.length * 72 + 40) }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={d.top}
                    layout="vertical"
                    margin={{ top: 8, right: 24, bottom: 8, left: 8 }}
                    barSize={28}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={180}
                      interval={0}
                      tick={({ x, y, payload }) => (
                        <g transform={`translate(${x},${y})`}>
                          <foreignObject x={-176} y={-27} width={168} height={54}>
                            <div className="ranking-chart-label" title={String(payload.value)}>
                              <span>{payload.value}</span>
                            </div>
                          </foreignObject>
                        </g>
                      )}
                    />
                    <Tooltip />
                    <Bar
                      isAnimationActive={false}
                      dataKey="quantity"
                      name="Quantidade"
                      fill="#174b70"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <p className="empty">Nenhuma movimentação no período.</p>
          )}
        </section>
        <section className="card">
          <div className="card-heading">
            <h2>Evolução do estoque</h2>
            <span>Saldo por mês de registro</span>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={d.series}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis width={45} />
              <Tooltip />
              <Line
                isAnimationActive={false}
                type="monotone"
                dataKey="estoque"
                name="Saldo"
                stroke="var(--chart-stock)"
                strokeWidth={3}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </section>
      </div>
      <section className="card">
        <div className="card-heading">
          <h2>Últimas movimentações</h2>
          <Link to="/movements">
            Ver histórico <ArrowRight size={15} />
          </Link>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {['Data', 'Material', 'Tipo', 'Quantidade', 'Responsável', 'Setor'].map((s) => (
                  <th key={s}>{s}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.latest.map((m: any) => (
                <tr key={m.id}>
                  <td>{date(m.date)}</td>
                  <td>
                    <strong>{m.material.name}</strong>
                    <small>{m.material.code}</small>
                  </td>
                  <td>
                    <span className={`badge ${m.type === 'IN' ? 'normal' : 'low'}`}>
                      {m.type === 'IN' ? '↙ Entrada' : '↗ Saída'}
                    </span>
                  </td>
                  <td>{m.quantity}</td>
                  <td>{m.user.name}</td>
                  <td>{m.department?.name || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!d.latest.length && <p className="empty">Nenhuma movimentação registrada.</p>}
        </div>
      </section>
    </div>
  );
}
