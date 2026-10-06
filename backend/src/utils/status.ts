export function stockStatus(quantity: number, minimum: number) {
  if (quantity === 0) return 'Sem estoque';
  if (quantity <= minimum && quantity <= Math.max(1, Math.floor(minimum * 0.25))) return 'Crítico';
  if (quantity <= minimum) return 'Baixo';
  return 'Normal';
}
