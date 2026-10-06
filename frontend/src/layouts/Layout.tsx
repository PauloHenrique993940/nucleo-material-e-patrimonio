import { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
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
  Search,
  Bell,
  LogOut,
  Menu,
  Sun,
  Moon,
  X,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { api } from '../services/api';
import { roles } from '../utils/format';
import { useDebounce } from '../hooks/useDebounce';
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
] as const;
export function Layout() {
  const location = useLocation();
  const current = links.find(([path]) => path === location.pathname) || links[0];
  const ModuleIcon = current[2];
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
  const dashboard = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api('/dashboard'),
    refetchInterval: 30000,
  });
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
        inert={mobile && !open}
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
          <span>
            <Package size={25} />
          </span>
          <div>
            Núcleo<small>SSP · MATERIAL E PATRIMÔNIO</small>
          </div>
        </Link>
        <span className="nav-label">ÁREA DE TRABALHO</span>
        <nav aria-label="Menu principal">
          {allowed.map(([path, label, Icon]) => (
            <NavLink key={path} to={path} end={path === '/'} onClick={closeMenu}>
              <Icon size={19} />
              {label}
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
          <div className="module-indicator">
            <span>
              <ModuleIcon size={20} />
            </span>
            <div>
              <small>ÁREA DE TRABALHO</small>
              <strong>{current[1]}</strong>
            </div>
          </div>
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
              onClick={toggleTheme}
              aria-label={dark ? 'Ativar tema claro' : 'Ativar tema escuro'}
            >
              {dark ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <div className="notifications">
              <button
                aria-label={`Alertas de estoque: ${dashboard.data?.alerts.length || 0}`}
                onClick={() => setNotifications((v) => !v)}
              >
                <Bell size={20} />
                {!!dashboard.data?.alerts.length && <span className="notification-dot" />}
              </button>
              {notifications && (
                <div className="notification-panel">
                  <h3>Alertas de estoque</h3>
                  {dashboard.data?.alerts.length ? (
                    dashboard.data.alerts.slice(0, 8).map((a: any) => (
                      <Link
                        key={a.id}
                        to={`/materials?q=${encodeURIComponent(a.name)}`}
                        onClick={() => setNotifications(false)}
                      >
                        {a.name}
                        <small>
                          {a.status} · {a.quantity} unidades
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
          SSP · Núcleo de Material e Patrimônio <span>Gestão com rastreabilidade</span>
        </footer>
      </div>
    </div>
  );
}
