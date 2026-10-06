import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
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
import { api } from '../services/api';
import { currency, date } from '../utils/format';
export function Dashboard() {
  const query = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api('/dashboard'),
    refetchInterval: 30000,
  });
  if (query.isPending) return <p role="status">Carregando visão geral…</p>;
  if (query.isError)
    return (
      <div className="error-box" role="alert">
        {query.error.message}
        <button onClick={() => query.refetch()}>Tentar novamente</button>
      </div>
    );
  const d = query.data;
  const cards = [
    ['Materiais cadastrados', d.cards.materials, Package],
    ['Itens em estoque', d.cards.quantity, Boxes],
    ['Estoque baixo', d.cards.low, TriangleAlert],
    ['Sem estoque', d.cards.empty, PackageX],
    ['Entradas no mês', d.cards.entries, ArrowDownLeft],
    ['Saídas no mês', d.cards.exits, ArrowUpRight],
    ['Valor do estoque', currency(d.cards.value), Wallet],
    ['Bens patrimoniais', d.cards.assets, Building2],
  ] as const;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">VISÃO GERAL</span>
          <h1>Dashboard</h1>
          <p>Saldos de materiais, movimentações e bens patrimoniais.</p>
        </div>
        <span className="date-chip">
          {new Date().toLocaleDateString('pt-BR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </span>
      </div>
      <div className="stat-grid">
        {cards.map(([label, value, Icon], i) => (
          <article className="stat-card" key={label}>
            <div className={`stat-icon tone-${i}`}>
              <Icon size={20} />
            </div>
            <span>{label}</span>
            <strong>{typeof value === 'number' ? value.toLocaleString('pt-BR') : value}</strong>
            <small>
              {i === 2 || i === 3
                ? 'Acompanhe a reposição'
                : i === 4 || i === 5
                  ? 'Quantidade movimentada'
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
                fill="#24734e"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                isAnimationActive={false}
                dataKey="saida"
                name="Saídas"
                fill="#d6ab32"
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
                          ['#22658a', '#d6ab32', '#7395a8', '#64777f', '#b9ccd5', '#b33434'][i % 6]
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
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={d.top} layout="vertical">
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar
                  isAnimationActive={false}
                  dataKey="quantity"
                  name="Quantidade"
                  fill="#22658a"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
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
                stroke="#22658a"
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
    </>
  );
}
