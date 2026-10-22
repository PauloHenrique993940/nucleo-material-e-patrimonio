import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api('/dashboard'),
    staleTime: 0,
    refetchInterval: 1000,
    refetchIntervalInBackground: true,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
  });
}
