export interface Booking {
  id: number;
  user_id?: number;
  clock_in: string;
  clock_out: string | null;
  clock_in_lat?: number | null;
  clock_in_lng?: number | null;
  clock_out_lat?: number | null;
  clock_out_lng?: number | null;
  user_name?: string;
  user_email?: string;
}

export interface EmployeeSummary {
  id: number;
  name: string;
  email: string;
  role: 'user' | 'admin';
  active: boolean;
  created_at?: string;
  vacationAllowance?: number;
  personnelNumber?: string;
  flexEnabled?: boolean;
}

export interface Absence {
  id: number;
  user_id: number;
  start_date: string;
  end_date: string;
  type: 'vacation' | 'sick' | 'remote' | 'other';
  duration: 'full' | 'half';
  note?: string | null;
  days?: string[];
}

export interface VacationSummaryRow {
  user_id: number;
  name: string;
  email: string;
  allowance: number;
  used: number;
  remaining: number;
}

export interface VacationSummarySnapshot {
  allowance: number;
  used: number;
  remaining: number;
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

export interface UserSettingsPayload {
  language: 'de' | 'en';
  week_start: 'monday' | 'sunday';
  time_format: '24h' | '12h';
  vacation_allowance?: number;
}

export interface UserProfilePayload {
  birth_date?: string;
  personnel_number?: string;
  phone?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  note?: string;
}

export interface WorkScheduleDay {
  weekday: number;
  minutes: number;
}

export interface WorkSchedulePayload {
  days: WorkScheduleDay[];
}

export interface FlexBalancePayload {
  balanceMinutes: number;
  plannedMinutes: number;
  workedMinutes: number;
  adjustment: number;
  enabled: boolean;
}
