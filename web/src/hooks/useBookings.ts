import { useQuery } from '@tanstack/react-query';
import api from '../api';
import type { Booking } from '../types';

export function useMyBookings() {
  return useQuery({
    queryKey: ['bookings', 'me'],
    queryFn: async () => {
      const { data } = await api.get<Booking[]>('/bookings/me');
      return data;
    },
  });
}

export function useUserBookings(userId?: number | null) {
  return useQuery({
    queryKey: ['bookings', 'user', userId],
    queryFn: async () => {
      if (!userId) {
        return [] as Booking[];
      }
      const { data } = await api.get<Booking[]>(`/bookings/user/${userId}`);
      return data;
    },
    enabled: Boolean(userId),
  });
}
