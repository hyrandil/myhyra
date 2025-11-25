import axios from 'axios';
import { AbsenceRequest, AttendanceReport, DailySummary, Department, Employee, TimeEntry, UserInfo } from './types';

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
    tracking_start_date: payload.trackingStartDate,
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
    tracking_start_date: payload.trackingStartDate,
    active: payload.active,
    personnel_number: payload.personnelNumber,
  });
  return res.data as Employee;
}

export async function fetchDepartments() {
  const res = await api.get<{ departments: any[]; members: any[] }>('/departments');
  const map = new Map<number, Department>();
  res.data.departments.forEach((dept: any) => {
    map.set(dept.id, { ...dept, members: [] });
  });
  res.data.members.forEach((m: any) => {
    const dept = map.get(m.department_id);
    if (dept) {
      dept.members.push({
        userId: m.user_id,
        name: m.name,
        email: m.email,
        role: m.role,
      });
    }
  });
  return Array.from(map.values()) as Department[];
}

export async function createDepartment(payload: { name: string; description?: string }) {
  const res = await api.post('/departments', payload);
  return res.data as { id: number; name: string; description?: string };
}

export async function updateDepartment(id: number, payload: { name: string; description?: string }) {
  const res = await api.patch(`/departments/${id}`, payload);
  return res.data;
}

export async function upsertDepartmentMember(
  departmentId: number,
  payload: { userId: number; role?: 'member' | 'lead' | 'hr' }
) {
  const res = await api.post(`/departments/${departmentId}/members`, payload);
  return res.data;
}

export async function updateDepartmentMemberRole(
  departmentId: number,
  userId: number,
  role: 'member' | 'lead' | 'hr'
) {
  const res = await api.patch(`/departments/${departmentId}/members/${userId}`, { role });
  return res.data;
}

export async function removeDepartmentMember(departmentId: number, userId: number) {
  const res = await api.delete(`/departments/${departmentId}/members/${userId}`);
  return res.data;
}

export async function deleteDepartment(id: number) {
  const res = await api.delete(`/departments/${id}`);
  return res.data;
}

export async function fetchEntries() {
  const res = await api.get<TimeEntry[]>('/time/me');
  return res.data;
}

export async function punch(
  type: 'CLOCK_IN' | 'CLOCK_OUT' | 'BREAK_START' | 'BREAK_END',
  location?: { lat: number; lng: number }
) {
  const endpoint =
    type === 'CLOCK_IN'
      ? '/time/clock-in'
      : type === 'CLOCK_OUT'
        ? '/time/clock-out'
        : type === 'BREAK_START'
          ? '/time/break-start'
          : '/time/break-end';
  const res = await api.post(endpoint, { source: 'WEB', location });
  return res.data;
}

export async function fetchDaily(month?: string) {
  const res = await api.get<{ month: string; days: Record<string, DailySummary> }>('/time/me/daily', {
    params: month ? { month } : undefined,
  });
  return res.data;
}

export async function fetchDailyForUser(userId: number, month?: string) {
  const res = await api.get<{ month: string; days: Record<string, DailySummary> }>(`/time/user/${userId}/daily`, {
    params: month ? { month } : undefined,
  });
  return res.data;
}

export async function fetchDailyOverview(month?: string, department?: string) {
  const res = await api.get<{ month: string; days: Record<string, DailySummary> }>('/time/overview', {
    params: { month, department },
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

export async function createAbsenceForUser(
  userId: number,
  payload: { start_date: string; end_date: string; type: string; duration?: 'full' | 'half'; note?: string }
) {
  const res = await api.post(`/absences/user/${userId}`, payload);
  return res.data;
}

export async function createManualTimeEntry(
  userId: number,
  payload: { timestamp: string; type: 'CLOCK_IN' | 'CLOCK_OUT' | 'BREAK_START' | 'BREAK_END'; source?: string; location?: { lat?: number; lng?: number } }
) {
  const res = await api.post(`/time/user/${userId}/manual`, payload);
  return res.data;
}

export async function fetchAttendance(month?: string) {
  const res = await api.get<AttendanceReport>('/reports/attendance', { params: month ? { month } : undefined });
  return res.data;
}

export default api;
