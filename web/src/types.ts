export type Role = 'employee' | 'lead' | 'hr' | 'admin';

export interface UserInfo {
  id: number;
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  role: Role;
  department?: string;
}

export interface Employee extends UserInfo {
  active: boolean;
  personnelNumber?: string;
  location?: string;
  department?: string;
  trackingStartDate?: string;
  startDate?: string;
  endDate?: string;
  holidayProfileId?: number;
}

export interface DepartmentMember {
  userId: number;
  role: 'member' | 'lead' | 'hr';
  name: string;
  email: string;
}

export interface Department {
  id: number;
  name: string;
  description?: string | null;
  created_at?: string;
  members: DepartmentMember[];
}

export interface TimeEntry {
  id: number;
  user_id: number;
  timestamp: string;
  type: 'CLOCK_IN' | 'CLOCK_OUT' | 'BREAK_START' | 'BREAK_END';
  source: 'WEB' | 'APP' | 'TERMINAL';
  lat?: number | null;
  lng?: number | null;
}

export interface DailySummary {
  worked: number;
  planned: number;
  flex: number;
  absences: string[];
  status: string;
  pending?: boolean;
  users?: { id: number; name: string; department?: string | null }[];
}

export interface DayDetail {
  entries: TimeEntry[];
  absences: { type: string; duration?: string; note?: string | null; label?: string; start_time?: string | null; end_time?: string | null; minutes_override?: number | null }[];
  pending: boolean;
  autoBreakMinutes?: number;
  recordedBreakMinutes?: number;
  spanMinutes?: number;
  inconsistent?: boolean;
}

export interface MonthlyReportDay {
  date: string;
  planned: number;
  worked: number;
  delta: number;
  entries: TimeEntry[];
  absences: { type: string; duration?: string; note?: string | null; start_time?: string | null; end_time?: string | null; minutes_override?: number | null }[];
  absenceLabels: string[];
  autoBreakMinutes?: number;
  recordedBreakMinutes?: number;
  pending?: boolean;
}

export interface MonthlyReport {
  month: string;
  days: MonthlyReportDay[];
  meta?: {
    name?: string;
    personnelNumber?: string;
    vacation?: { allowance: number; used: number; remaining: number };
    flexBalance?: number;
  };
}

export interface InconsistentDay {
  user_id: number;
  user: string;
  date: string;
  entries: TimeEntry[];
}

export interface AbsenceKind {
  id?: number;
  code: string;
  label: string;
  counts_as_work: boolean;
  allow_full?: boolean;
  allow_half?: boolean;
  allow_hourly?: boolean;
  locked?: boolean;
}

export interface AttendanceRow {
  user_id: number;
  name: string;
  email: string;
  presenceDays: number;
  absences: Record<string, number>;
  remainingVacation: number;
}

export interface AttendanceResponse {
  month: string;
  kinds: { code: string; label: string; counts_as_work: number }[];
  rows: AttendanceRow[];
}

export interface HolidayProfile {
  id: number;
  name: string;
  state: string;
}

export interface HolidayEntry {
  id?: number;
  profile_id?: number;
  date: string;
  name: string;
  duration: 'full' | 'half';
  source?: string;
}

export interface AbsenceRequest {
  id: number;
  user_id: number;
  start_date: string;
  end_date: string;
  type: 'vacation' | 'sick' | 'remote' | 'other';
  status: 'pending' | 'approved' | 'rejected';
  comment?: string | null;
  user_name?: string;
  cancel_requested?: boolean | number;
  cancel_reason?: string | null;
  canceled?: boolean | number;
}

export interface TimeCorrectionRequest {
  id: number;
  user_id: number;
  date: string;
  note?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at?: string;
  user_name?: string;
  user_email?: string;
  entries?: {
    id?: number;
    timestamp: string;
    type: 'CLOCK_IN' | 'CLOCK_OUT';
    action?: 'add' | 'delete' | 'replace';
    entryId?: number | null;
  }[];
}

