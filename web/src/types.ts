export type Role = 'employee' | 'lead' | 'hr' | 'admin';

export interface UserInfo {
  id: number;
  name: string;
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

export interface AbsenceRequest {
  id: number;
  user_id: number;
  start_date: string;
  end_date: string;
  type: 'vacation' | 'sick' | 'remote' | 'other';
  status: 'pending' | 'approved' | 'rejected';
  comment?: string | null;
  user_name?: string;
}

export interface AttendanceRow {
  user_id: number;
  name: string;
  email: string;
  presenceDays: number;
  vacationDays: number;
  sickDays: number;
  remoteDays: number;
  otherAbsences: number;
  remainingVacation: number;
}

export interface AttendanceReport {
  month: string;
  rows: AttendanceRow[];
}
