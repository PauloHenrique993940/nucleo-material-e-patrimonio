import { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  RefreshCw,
  Package,
  LayoutDashboard,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  Landmark,
  Network,
  Tags,
  Truck,
  Users,
  FileChartColumn,
  ShieldCheck,
  Settings,
  Info,
  Search,
  Bell,
  LogOut,
  Menu,
  Sun,
  Moon,
  X,
  Cloud,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { api } from '../services/api';
import { roles } from '../utils/format';
import { useDebounce } from '../hooks/useDebounce';
import { useStockAlerts } from '../hooks/useStockAlerts';
const links = [
  ['/', 'Dashboard', LayoutDashboard],
  ['/materials', 'Materiais', Package],
  ['/entries', 'Entrada', ArrowDownToLine],
  ['/exits', 'Saída', ArrowUpFromLine],
  ['/movements', 'Movimentações', ArrowLeftRight],
  ['/assets', 'Patrimônio', Landmark],
  ['/categories', 'Categorias', Tags],
  ['/suppliers', 'Fornecedores', Truck],
  ['/departments', 'Setores', Network],
  ['/reports', 'Relatórios', FileChartColumn],
  ['/users', 'Usuários', Users],
  ['/audit', 'Auditoria', ShieldCheck],
  ['/settings', 'Configurações', Settings],
  ['/quem-somos', 'Quem somos', Info],
] as const;
export function Layout() {
  const cache = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 900px)').matches);
  const menuRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const wasOpen = useRef(false);
  const { user, logout, dark, toggleTheme, toast } = useApp();
  const [open, setOpen] = useState(false),
    [q, setQ] = useState(''),
    [notifications, setNotifications] = useState(false);
  const debounced = useDebounce(q);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 900px)');
    const change = () => setMobile(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    if (mobile) {
      if (open) sidebarRef.current?.querySelector<HTMLElement>('a')?.focus();
      else if (wasOpen.current) menuRef.current?.focus();
    }
    wasOpen.current = open;
  }, [mobile, open]);
  const closeMenu = () => setOpen(false);
  const search = useQuery({
    queryKey: ['search', debounced],
    queryFn: () => api('/search?q=' + encodeURIComponent(debounced)),
    enabled: debounced.length >= 2,
  });
  const alerts = useStockAlerts();
  const allowed = links.filter(
    ([path]) =>
      !(['/users', '/audit'].includes(path) && user?.role !== 'ADMIN') &&
      !(path === '/reports' && user?.role === 'OPERATOR') &&
      !(['/entries', '/exits'].includes(path) && user?.role === 'VIEWER'),
  );
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Ir para o conteúdo
      </a>
      {open && <button className="sidebar-backdrop" aria-label="Fechar menu" onClick={closeMenu} />}
      <aside
        ref={sidebarRef}
        id="navigation-sidebar"
        className={`sidebar ${open ? 'open' : ''}`}

        role={mobile && open ? 'dialog' : undefined}
        aria-modal={mobile && open ? true : undefined}
        aria-label={mobile && open ? 'Navegação' : undefined}
        onKeyDown={(e) => {
          if (!mobile || !open) return;
          if (e.key === 'Escape') {
            e.preventDefault();
            closeMenu();
          }
          if (e.key === 'Tab') {
            const items = sidebarRef.current!.querySelectorAll<HTMLElement>('a,button');
            const first = items[0],
              last = items[items.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }}
      >
        <Link className="brand" to="/">
          <div>
            Núcleo<small>SSP · MATERIAL E PATRIMÔNIO</small>
          </div>
        </Link>
        <span className="nav-label">ÁREA DE TRABALHO</span>
        <nav aria-label="Menu principal">
          {allowed.map(([path, label, Icon]) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              onClick={closeMenu}
              aria-label={label}
              title={label}
            >
              <Icon size={19} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="avatar">{user?.name.slice(0, 2).toUpperCase()}</span>
          <div>
            {user?.name}
            <small>{roles[user?.role || '']}</small>
          </div>
          <button aria-label="Sair" onClick={() => logout().catch((e) => toast(e.message, true))}>
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      <div className="workspace" inert={mobile && open}>
        <div className="workspace-institutional-bar">
          <span>
            <ShieldCheck size={13} /> PORTAL ADMINISTRATIVO
          </span>
          <span>SSP · Núcleo de Material e Patrimônio</span>
        </div>
        <header className="topbar">
          <button
            ref={menuRef}
            className="mobile-menu"
            onClick={() => setOpen(true)}
            aria-label="Abrir menu"
            aria-expanded={open}
            aria-controls="navigation-sidebar"
          >
            <Menu />
          </button>
          <Link className="header-brand" to="/" aria-label="Núcleo — início">
            <Cloud size={27} aria-hidden="true" />
            <strong>
              Núcleo <span>Material e Patrimônio</span>
            </strong>
          </Link>
          <div className="global-search">
            <Search size={18} />
            <input
              placeholder="Pesquisar no Núcleo…"
              aria-label="Busca global"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {q && (
              <button aria-label="Limpar pesquisa" onClick={() => setQ('')}>
                <X size={16} />
              </button>
            )}
            {debounced.length >= 2 && (
              <div className="search-results">
                {search.isPending ? (
                  'Buscando…'
                ) : search.isError ? (
                  <p role="alert">{search.error.message}</p>
                ) : (
                  Object.entries(search.data || {}).map(([kind, rows]) => (
                    <div key={kind}>
                      {(rows as any[]).map((r) => (
                        <Link
                          key={r.id}
                          to={`/${kind}?q=${encodeURIComponent(r.code || r.number || r.name)}`}
                          onClick={() => setQ('')}
                        >
                          <span>{r.name}</span>
                          <small>
                            {r.code ||
                              r.number ||
                              ({ suppliers: 'Fornecedor', departments: 'Setor' } as any)[kind]}
                          </small>
                        </Link>
                      ))}
                    </div>
                  ))
                )}
                {search.data &&
                  Object.values(search.data).every((r) => (r as any[]).length === 0) && (
                    <p>Nenhum resultado encontrado.</p>
                  )}
              </div>
            )}
          </div>
          <div className="topbar-actions">
            <button
              title="Atualizar página"
              aria-label="Atualizar página"
              disabled={refreshing}
              onClick={async () => {
                setRefreshing(true);
                try {
                  await cache.refetchQueries({ type: 'active' }, { throwOnError: true });
                  toast('Dados atualizados.');
                } catch (error) {
                  toast((error as Error).message, true);
                } finally {
                  setRefreshing(false);
                }
              }}
            >
              <RefreshCw size={20} className={refreshing ? 'refresh-spinning' : ''} />
            </button>
            <button
              onClick={toggleTheme}
              aria-label={dark ? 'Ativar tema claro' : 'Ativar tema escuro'}
            >
              {dark ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <div className="notifications">
              <button
                aria-label={`Alertas de estoque: ${alerts.data?.length || 0}`}
                aria-expanded={notifications}
                onClick={() => setNotifications((v) => !v)}
              >
                <Bell size={20} />
                {!!alerts.data?.length && (
                  <span className="notification-dot">{alerts.data.length}</span>
                )}
              </button>
              {notifications && (
                <div className="notification-panel">
                  <h3>Alertas de estoque</h3>
                  {alerts.isError ? (
                    <p role="alert">Não foi possível atualizar os alertas.</p>
                  ) : alerts.isPending ? (
                    <p>Carregando alertas…</p>
                  ) : alerts.data?.length ? (
                    alerts.data.map((a) => (
                      <Link
                        key={a.id}
                        to={`/materials?q=${encodeURIComponent(a.code)}`}
                        onClick={() => setNotifications(false)}
                      >
                        {a.name}
                        <small>
                          {a.status} · {a.quantity} {a.unit} · mínimo: {a.minimum}
                        </small>
                      </Link>
                    ))
                  ) : (
                    <p>Nenhum alerta no momento.</p>
                  )}
                </div>
              )}
            </div>
            <span className="user-label">
              {user?.name}
              <small>{roles[user?.role || '']}</small>
            </span>
          </div>
        </header>
        <main id="main" className="page-content">
          <Outlet />
        </main>
        <footer className="app-footer">
          <div className="app-footer-copy">
            <span>SSP · Núcleo de Material e Patrimônio</span>
            <span>Gestão com rastreabilidade</span>
          </div>
          <img
            className="app-footer-logo"
            src="/images/governo-bahia.jpg"
            alt="Bahia — Governo do Estado"
            width={180}
            height={56}
          />
        </footer>
      </div>
    </div>
  );
}
