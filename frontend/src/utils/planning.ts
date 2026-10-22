export type Count = { quantity: number; expected: number; at: string };
export type MaterialPlan = {
  quantity: number;
  minimum: number;
  maximum?: number | null;
  unitPrice?: unknown;
  active?: boolean;
};
export function replenishment(material: MaterialPlan) {
  const target = Math.max(material.minimum + 1, material.maximum || 0);
  const quantity =
    material.active === false || material.quantity > material.minimum
      ? 0
      : Math.max(0, target - material.quantity);
  return {
    target,
    quantity,
    cost: Math.round(quantity * Number(material.unitPrice || 0) * 100) / 100,
  };
}
export function countDifference(count: Count | undefined, current: number) {
  if (!count) return null;
  return { difference: count.quantity - count.expected, stale: count.expected !== current };
}
export function readCounts(raw: string | null): Record<string, Count> {
  try {
    const value: unknown = JSON.parse(raw || '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value).filter(
        ([, count]) =>
          count &&
          Number.isSafeInteger(count.quantity) &&
          count.quantity >= 0 &&
          Number.isSafeInteger(count.expected) &&
          count.expected >= 0 &&
          typeof count.at === 'string' &&
          Number.isFinite(Date.parse(count.at)),
      ),
    );
  } catch {
    return {};
  }
}
