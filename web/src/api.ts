import axios from 'axios';
import { AbsenceRequest, AttendanceReport, DailySummary, Employee, TimeEntry, UserInfo } from './types';

const api = axios.create({
  // Default to the Express port (4000) so local dev works without extra env config
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export async function login(email: string, password: string) {
  const res = await api.post('/auth/login', { email, password });
  return res.data as { token: string; user: UserInfo };
}

export async function fetchMe() {
  const res = await api.get('/users/me/settings');
  return res.data;
}

export async function fetchEmployees(search?: string) {
  const res = await api.get<Employee[]>('/users', { params: search ? { q: search } : undefined });
  return res.data;
}

export async function createEmployee(payload: Partial<Employee> & { email: string; name: string; password: string; role: Employee['role'] }) {
  const res = await api.post('/users', {
    name: payload.name,
    email: payload.email,
    password: payload.password,
    role: payload.role,
    personnel_number: payload.personnelNumber,
    department: payload.department,
    location: payload.location,
  });
  return res.data as Employee;
}

export async function updateEmployee(id: number, payload: Partial<Employee> & { role: Employee['role'] }) {
  const res = await api.patch(`/users/${id}`, {
    name: payload.name,
    email: payload.email,
    role: payload.role,
    location: payload.location,
    department: payload.department,
    active: payload.active,
  });
  return res.data as Employee;
}

export async function fetchEntries() {
  const res = await api.get<TimeEntry[]>('/time/me');
  return res.data;
}

export async function punch(type: 'CLOCK_IN' | 'CLOCK_OUT' | 'BREAK_START' | 'BREAK_END') {
  const endpoint =
    type === 'CLOCK_IN'
      ? '/time/clock-in'
      : type === 'CLOCK_OUT'
        ? '/time/clock-out'
        : type === 'BREAK_START'
          ? '/time/break-start'
          : '/time/break-end';
  const res = await api.post(endpoint, { source: 'WEB' });
  return res.data;
}

export async function fetchDaily(month?: string) {
  const res = await api.get<{ month: string; days: Record<string, DailySummary> }>('/time/me/daily', {
    params: month ? { month } : undefined,
  });
  return res.data;
}

export async function createAbsenceRequest(data: { start_date: string; end_date: string; type: string; comment?: string }) {
  const res = await api.post('/absences/request', data);
  return res.data;
}

export async function fetchMyAbsenceRequests() {
  const res = await api.get<AbsenceRequest[]>('/absences/requests/me');
  return res.data;
}

export async function fetchAbsenceInbox() {
  const res = await api.get<AbsenceRequest[]>('/absences/requests');
  return res.data;
}

export async function updateAbsenceStatus(id: number, status: 'approved' | 'rejected') {
  const res = await api.patch(`/absences/requests/${id}/status`, { status });
  return res.data;
}

export async function fetchAttendance(month?: string) {
  const res = await api.get<AttendanceReport>('/reports/attendance', { params: month ? { month } : undefined });
  return res.data;
}

export default api;
