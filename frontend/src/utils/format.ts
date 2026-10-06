export const currency = (n: unknown) =>
  Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const date = (n: unknown) => (n ? new Date(String(n)).toLocaleString('pt-BR') : '—');
export const status = (q: number, min: number) =>
  q === 0
    ? 'Sem estoque'
    : q <= min && q <= Math.max(1, Math.floor(min * 0.25))
      ? 'Crítico'
      : q <= min
        ? 'Baixo'
        : 'Normal';
export const roles: Record<string, string> = {
  ADMIN: 'Administrador',
  MANAGER: 'Gestor',
  OPERATOR: 'Operador',
  VIEWER: 'Consulta',
};
export const assetStatuses: Record<string, string> = {
  IN_USE: 'Em uso',
  AVAILABLE: 'Disponível',
  MAINTENANCE: 'Em manutenção',
  TRANSFERRED: 'Transferido',
  DISPOSED: 'Baixado',
};
export const periodQuery = (from: string, to: string) => {
  const p = new URLSearchParams();
  if (from) p.set('from', new Date(from + 'T00:00:00').toISOString());
  if (to) p.set('to', new Date(to + 'T23:59:59.999').toISOString());
  return p.toString();
};
