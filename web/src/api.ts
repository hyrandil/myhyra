import axios from 'axios';
import {
  AbsenceRequest,
  AttendanceResponse,
  DailySummary,
  DayDetail,
  Department,
  Employee,
  HolidayEntry,
  HolidayProfile,
  InconsistentDay,
  MonthlyReport,
  TimeEntry,
  UserInfo,
} from './types';

const api = axios.create({
  // Default to relative /api so Vite proxy handles dev requests; override via VITE_API_URL for external hosts
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
});

export async function login(email: string, password: string) {
  const res = await api.post('/auth/login', { email, password });
  return res.data as { user: UserInfo };
}

export async function fetchSession() {
  const res = await api.get('/auth/me');
  return res.data as { user: UserInfo };
}

export async function logout() {
  await api.post('/auth/logout');
}

export async function fetchMe() {
  const res = await api.get('/users/me/settings');
  return res.data;
}

export async function fetchEmployees(search?: string) {
  const res = await api.get<Employee[]>('/users', { params: search ? { q: search } : undefined });
  return res.data;
}

export async function fetchPublicDepartments() {
  const res = await api.get<{ id: number; name: string; description?: string }[]>('/departments/public');
  return res.data;
}

export async function fetchHolidayProfiles() {
  const res = await api.get<HolidayProfile[]>('/holidays/profiles');
  return res.data;
}

export async function createHolidayProfile(payload: {
  name: string;
  state: string;
  year?: number;
  years?: number[];
  startYear?: number;
  endYear?: number;
}) {
  const res = await api.post('/holidays/profiles', payload);
  return res.data as HolidayProfile;
}

export async function importHolidayProfile(
  id: number,
  payload: { year?: number; years?: number[]; startYear?: number; endYear?: number }
) {
  const res = await api.post(`/holidays/profiles/${id}/import`, payload);
  return res.data as { message: string; count: number };
}

export async function addCustomHoliday(id: number, payload: { date: string; name: string; duration: 'full' | 'half' }) {
  const res = await api.post(`/holidays/profiles/${id}/holidays`, payload);
  return res.data;
}

export async function fetchProfileHolidays(id: number, year?: number) {
  const res = await api.get<HolidayEntry[]>(`/holidays/profiles/${id}/holidays`, {
    params: year ? { year } : undefined,
  });
  return res.data;
}

export async function createEmployee(payload: Partial<Employee> & { email: string; firstName: string; lastName: string; password: string; role: Employee['role'] }) {
  const res = await api.post('/users', {
    first_name: payload.firstName,
    last_name: payload.lastName,
    email: payload.email,
    password: payload.password,
    role: payload.role,
    personnel_number: payload.personnelNumber,
    department: payload.department,
    location: payload.location,
    tracking_start_date: payload.trackingStartDate,
    holiday_profile_id: payload.holidayProfileId,
  });
  return res.data as Employee;
}

export async function updateEmployee(id: number, payload: Partial<Employee> & { role: Employee['role'] }) {
  const res = await api.patch(`/users/${id}`, {
    first_name: payload.firstName,
    last_name: payload.lastName,
    email: payload.email,
    role: payload.role,
    location: payload.location,
    department: payload.department,
    tracking_start_date: payload.trackingStartDate,
    active: payload.active,
    personnel_number: payload.personnelNumber,
    holiday_profile_id: payload.holidayProfileId,
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
  const res = await api.get<{ month: string; days: Record<string, DailySummary>; flexBalance?: number }>('/time/me/daily', {
    params: month ? { month } : undefined,
  });
  return res.data;
}

export async function fetchDailyForUser(userId: number, month?: string) {
  const res = await api.get<{ month: string; days: Record<string, DailySummary>; flexBalance?: number }>(
    `/time/user/${userId}/daily`,
    {
      params: month ? { month } : undefined,
    }
  );
  return res.data;
}

export async function fetchDailyOverview(month?: string, department?: string, userId?: number) {
  const res = await api.get<{ month: string; days: Record<string, DailySummary> }>('/time/overview', {
    params: { month, department, userId },
  });
  return res.data;
}

export async function fetchDayEntriesForUser(userId: number, date: string) {
  const res = await api.get<DayDetail>(`/time/user/${userId}/day`, {
    params: { date },
  });
  return res.data;
}

export async function fetchInconsistentDays() {
  const res = await api.get<InconsistentDay[]>('/time/inconsistent');
  return res.data;
}

export async function createAbsenceRequest(data: { start_date: string; end_date: string; type: string; comment?: string }) {
  const res = await api.post('/absences/request', data);
  return res.data;
}

export async function fetchAbsenceKinds() {
  const res = await api.get('/absences/kinds');
  return res.data;
}

export async function fetchMyAbsences() {
  const res = await api.get('/absences/me');
  return res.data;
}

export async function updateAbsenceKind(
  id: number,
  payload: {
    code: string;
    label: string;
    counts_as_work: boolean;
    allow_full?: boolean;
    allow_half?: boolean;
    allow_hourly?: boolean;
  }
) {
  const res = await api.patch(`/absences/kinds/${id}`, payload);
  return res.data;
}

export async function deleteAbsenceKind(id: number) {
  const res = await api.delete(`/absences/kinds/${id}`);
  return res.data;
}

export async function createAbsenceKind(payload: {
  code: string;
  label: string;
  counts_as_work: boolean;
  allow_full?: boolean;
  allow_half?: boolean;
  allow_hourly?: boolean;
}) {
  const res = await api.post('/absences/kinds', payload);
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

export async function requestAbsenceCancellation(id: number, reason?: string) {
  const res = await api.post(`/absences/requests/${id}/cancel-request`, { reason });
  return res.data;
}

export async function createAbsenceForUser(
  userId: number,
  payload: {
    start_date: string;
    end_date: string;
    type: string;
    duration?: 'full' | 'half' | 'hours';
    start_time?: string;
    end_time?: string;
    note?: string;
  }
) {
  const res = await api.post(`/absences/user/${userId}`, payload);
  return res.data;
}

export async function deleteAbsenceForUser(userId: number, start_date: string, end_date: string) {
  const res = await api.delete(`/absences/user/${userId}`, { data: { start_date, end_date } });
  return res.data;
}

export async function resetUserPassword(userId: number, password: string) {
  const res = await api.patch(`/users/${userId}/password`, { password });
  return res.data;
}

export async function fetchSchedule(userId: number) {
  const res = await api.get<{ days: { weekday: number; minutes: number }[] }>(`/users/${userId}/schedule`);
  return res.data;
}

export async function updateSchedule(userId: number, days: { weekday: number; minutes: number }[]) {
  const res = await api.put<{ days: { weekday: number; minutes: number }[] }>(`/users/${userId}/schedule`, { days });
  return res.data;
}

export async function createManualTimeEntry(
  userId: number,
  payload: { timestamp: string; type: 'CLOCK_IN' | 'CLOCK_OUT'; source?: string; location?: { lat?: number; lng?: number } }
) {
  const res = await api.post(`/time/user/${userId}/manual`, payload);
  return res.data;
}

export async function updateTimeEntry(
  entryId: number,
  payload: { timestamp: string; type: 'CLOCK_IN' | 'CLOCK_OUT' }
) {
  const res = await api.patch(`/time/entry/${entryId}`, payload);
  return res.data as TimeEntry;
}

export async function deleteTimeEntry(entryId: number) {
  await api.delete(`/time/entry/${entryId}`);
}

export async function createTimeCorrectionRequest(payload: { date: string; note?: string; entries?: { timestamp: string; type: 'CLOCK_IN' | 'CLOCK_OUT' }[] }) {
  const res = await api.post('/time/corrections', payload);
  return res.data;
}

export async function fetchMyCorrections() {
  const res = await api.get('/time/corrections/me');
  return res.data;
}

export async function fetchCorrectionInbox() {
  const res = await api.get('/time/corrections/inbox');
  return res.data;
}

export async function updateCorrectionStatus(id: number, status: 'approved' | 'rejected') {
  const res = await api.patch(`/time/corrections/${id}/status`, { status });
  return res.data;
}

export async function fetchMonthlyReport(userId: number, month?: string) {
  const res = await api.get<MonthlyReport>(`/time/user/${userId}/monthly-report`, { params: month ? { month } : undefined });
  return res.data;
}

export async function fetchOwnMonthlyReport(month?: string) {
  const res = await api.get<MonthlyReport>('/time/me/monthly-report', { params: month ? { month } : undefined });
  return res.data;
}

export async function fetchAttendance(month?: string) {
  const res = await api.get<AttendanceResponse>('/reports/attendance', { params: month ? { month } : undefined });
  return res.data;
}

export async function downloadAttendanceCsv(month?: string) {
  const res = await api.get('/reports/attendance.csv', {
    params: month ? { month } : undefined,
    responseType: 'blob',
  });
  return res.data as Blob;
}

export async function downloadAttendanceXlsx(month?: string) {
  const res = await api.get('/reports/attendance.xlsx', {
    params: month ? { month } : undefined,
    responseType: 'blob',
  });
  return res.data as Blob;
}

export default api;
