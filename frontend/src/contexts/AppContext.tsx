import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { User } from '../types';
const Context = createContext<{
  user: User | null;
  ready: boolean;
  login: (login: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  toast: (message: string, error?: boolean) => void;
  dark: boolean;
  toggleTheme: () => void;
}>(null!);
export const useApp = () => useContext(Context);
export function AppProvider({ children }: { children: ReactNode }) {
  const cache = useQueryClient();
  const [user, setUser] = useState<User | null>(null),
    [ready, setReady] = useState(false),
    [message, setMessage] = useState<{ text: string; error: boolean } | null>(null),
    [dark, setDark] = useState(localStorage.getItem('nucleo-theme') === 'dark');
  useEffect(() => {
    if (localStorage.getItem('nucleo-token'))
      api<User>('/auth/me')
        .then(setUser)
        .catch(() => localStorage.removeItem('nucleo-token'))
        .finally(() => setReady(true));
    else setReady(true);
    const expire = () => {
      localStorage.removeItem('nucleo-token');
      setUser(null);
      cache.clear();
    };
    window.addEventListener('session-expired', expire);
    return () => window.removeEventListener('session-expired', expire);
  }, [cache]);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    localStorage.setItem('nucleo-theme', dark ? 'dark' : 'light');
  }, [dark]);
  useEffect(() => {
    if (message) {
      const id = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(id);
    }
  }, [message]);
  const login = async (login: string, password: string) => {
    const d = await api<{ token: string; user: User }>('/auth/login', 'POST', { login, password });
    cache.clear();
    localStorage.setItem('nucleo-token', d.token);
    setUser(d.user);
  };
  const logout = async () => {
    try {
      await api('/auth/logout', 'POST');
    } finally {
      localStorage.removeItem('nucleo-token');
      setUser(null);
      cache.clear();
    }
  };
  const toast = useCallback((text: string, error = false) => setMessage({ text, error }), []);
  return (
    <Context.Provider
      value={{ user, ready, login, logout, toast, dark, toggleTheme: () => setDark((v) => !v) }}
    >
      {children}
      {message && (
        <div
          className={`toast ${message.error ? 'error' : ''}`}
          role={message.error ? 'alert' : 'status'}
        >
          {message.text}
          <button aria-label="Fechar aviso" onClick={() => setMessage(null)}>
            ×
          </button>
        </div>
      )}
    </Context.Provider>
  );
}
