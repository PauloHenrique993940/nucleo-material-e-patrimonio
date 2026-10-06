const base = import.meta.env.VITE_API_URL || '/api';
export async function api<T = any>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const token = localStorage.getItem('nucleo-token');
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    if (response.status === 401 && path !== '/auth/login')
      window.dispatchEvent(new Event('session-expired'));
    throw new Error(data?.message || 'Não foi possível concluir a operação.');
  }
  return data;
}
