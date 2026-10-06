export function expiryInfo(value: unknown, now = new Date()) {
  if (!value) return { state: 'missing', label: 'Não informada', date: '—' };
  const day = String(value).slice(0, 10);
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (name: string) => parts.find((p) => p.type === name)!.value;
  const today = `${part('year')}-${part('month')}-${part('day')}`;
  const days = Math.round(
    (Date.parse(day + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 86400000,
  );
  return {
    state: days < 0 ? 'expired' : days <= 30 ? 'soon' : 'valid',
    label:
      days < 0
        ? 'Vencido'
        : days === 0
          ? 'Vence hoje'
          : days <= 30
            ? `Vence em ${days} dias`
            : 'Dentro da validade',
    date: day.split('-').reverse().join('/'),
  };
}
