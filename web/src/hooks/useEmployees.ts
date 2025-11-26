import { useQuery } from '@tanstack/react-query';
import api from '../api';
import type { EmployeeSummary } from '../types';

export function useEmployees() {
  return useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const { data } = await api.get<EmployeeSummary[]>('/users');
      return data;
    },
  });
}
