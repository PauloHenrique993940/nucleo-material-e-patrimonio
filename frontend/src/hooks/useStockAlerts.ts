import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { useApp } from '../contexts/AppContext';

export interface StockAlert {
  id: string;
  name: string;
  code: string;
  quantity: number;
  minimum: number;
  unit: string;
  status: string;
}

export function useStockAlerts() {
  const { toast } = useApp();
  const previous = useRef<Map<string, number> | null>(null);
  const query = useQuery({
    queryKey: ['stock-alerts'],
    queryFn: () => api<StockAlert[]>('/alerts'),
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
  useEffect(() => {
    if (!query.data) return;
    const changed = query.data.filter((item) => !previous.current?.has(item.id) ||
      (item.quantity === 0 && previous.current.get(item.id) !== 0));
    previous.current = new Map(query.data.map((item) => [item.id, item.quantity]));
    if (changed.length === 1) {
      const item = changed[0];
      toast(`Estoque ${item.quantity === 0 ? 'esgotado' : 'baixo'}: ${item.name}. Saldo: ${item.quantity} ${item.unit}; mínimo: ${item.minimum}.`, true);
    } else if (changed.length > 1) {
      toast(`${changed.length} itens com estoque baixo ou esgotado. Consulte o sino de alertas.`, true);
    }
  }, [query.data, toast]);
  return query;
}
