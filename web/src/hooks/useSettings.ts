import { useQuery } from '@tanstack/react-query';
import api from '../api';
import type {
  UserSettingsPayload,
  VacationSummarySnapshot,
  Absence,
  VacationSummaryRow,
  AttendanceReport,
  UserProfilePayload,
  WorkSchedulePayload,
} from '../types';

export function useUserSettings() {
  return useQuery({
    queryKey: ['settings', 'me'],
    queryFn: async () => {
      const { data } = await api.get<UserSettingsPayload>('/users/me/settings');
      return data;
    },
  });
}

export function useMyVacationSummary() {
  return useQuery({
    queryKey: ['vacation', 'me', 'summary'],
    queryFn: async () => {
      const { data } = await api.get<VacationSummarySnapshot>('/absences/me/summary');
      return data;
    },
  });
}

export function useMyAbsences() {
  return useQuery({
    queryKey: ['absences', 'me'],
    queryFn: async () => {
      const { data } = await api.get<Absence[]>('/absences/me');
      return data;
    },
  });
}

export function useUserAbsences(userId: number | null) {
  return useQuery({
    queryKey: ['absences', 'user', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const targetId = userId!;
      const { data } = await api.get<Absence[]>(`/absences/user/${targetId}`);
      return data;
    },
  });
}

export function useUserProfile(userId: number | null) {
  return useQuery({
    queryKey: ['profile', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data } = await api.get<UserProfilePayload>(`/users/${userId}/profile`);
      return data;
    },
  });
}

export function useUserSchedule(userId: number | null) {
  return useQuery({
    queryKey: ['schedule', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data } = await api.get<WorkSchedulePayload>(`/users/${userId}/schedule`);
      return data;
    },
  });
}

export function useVacationSummary() {
  return useQuery({
    queryKey: ['vacation', 'summary'],
    queryFn: async () => {
      const { data } = await api.get<VacationSummaryRow[]>('/absences/summary');
      return data;
    },
  });
}

export function useAttendanceReport(month: string) {
  return useQuery({
    queryKey: ['attendance', month],
    queryFn: async () => {
      const { data } = await api.get<AttendanceReport>('/reports/attendance', { params: { month } });
      return data;
    },
  });
}
