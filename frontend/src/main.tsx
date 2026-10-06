import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider, useApp } from './contexts/AppContext';
import { Layout } from './layouts/Layout';
import { Login } from './pages/Login';
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const Entities = lazy(() => import('./pages/Entities').then((m) => ({ default: m.Entities })));
const Stock = lazy(() => import('./pages/Stock').then((m) => ({ default: m.Stock })));
const Movements = lazy(() => import('./pages/Movements').then((m) => ({ default: m.Movements })));
const Reports = lazy(() => import('./pages/Reports').then((m) => ({ default: m.Reports })));
const Audit = lazy(() => import('./pages/Audit').then((m) => ({ default: m.Audit })));
const Settings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })));
import './styles.css';
import './internal.css';
import './login.css';
const client = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 15000 } } });
function App() {
  const { user, ready } = useApp();
  if (!ready)
    return (
      <main className="boot" role="status">
        Carregando sessão…
      </main>
    );
  return (
    <Suspense
      fallback={
        <p role="status" className="empty">
          Carregando página…
        </p>
      }
    >
      <Routes>
        <Route path="/reset-password" element={<Login reset />} />
        <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
        <Route element={user ? <Layout /> : <Navigate to="/login" replace />}>
          <Route index element={<Dashboard />} />
          {['materials', 'categories', 'suppliers', 'departments', 'assets', 'users'].map(
            (kind) => (
              <Route
                path={kind}
                key={kind}
                element={
                  kind === 'users' && user?.role !== 'ADMIN' ? (
                    <Navigate to="/" />
                  ) : (
                    <Entities key={kind} kind={kind} />
                  )
                }
              />
            ),
          )}
          <Route
            path="entries"
            element={user?.role === 'VIEWER' ? <Navigate to="/" /> : <Stock key="IN" type="IN" />}
          />
          <Route
            path="exits"
            element={user?.role === 'VIEWER' ? <Navigate to="/" /> : <Stock key="OUT" type="OUT" />}
          />
          <Route path="movements" element={<Movements />} />
          <Route
            path="reports"
            element={user?.role === 'OPERATOR' ? <Navigate to="/" /> : <Reports />}
          />
          <Route path="audit" element={user?.role === 'ADMIN' ? <Audit /> : <Navigate to="/" />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <AppProvider>
          <App />
        </AppProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
