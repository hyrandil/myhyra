export type Role = 'employee' | 'lead' | 'admin';

export interface User {
  id: number;
  name: string;
  first_name?: string | null;
  last_name?: string | null;
  email: string;
  password_hash: string;
  role: Role;
  active: number;
  created_at: string;
}

export interface UserProfile {
  user_id: number;
  location?: string | null;
  department?: string | null;
  require_location?: number | null;
  work_model_id?: number | null;
  holiday_profile_id?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  birth_date?: string | null;
  personnel_number?: string | null;
  rfid_code?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  postal_code?: string | null;
  note?: string | null;
}

export interface Booking {
  id: number;
  user_id: number;
  clock_in: string;
  clock_out?: string | null;
  clock_in_lat?: number | null;
  clock_in_lng?: number | null;
  clock_out_lat?: number | null;
  clock_out_lng?: number | null;
  created_at: string;
  updated_at: string;
}

export interface UserSettings {
  user_id: number;
  language: string;
  week_start: string;
  time_format: string;
  vacation_allowance: number;
}

export interface WorkModel {
  id: number;
  name: string;
  monday: number;
  tuesday: number;
  wednesday: number;
  thursday: number;
  friday: number;
  saturday: number;
  sunday: number;
  pause_after_minutes: number;
  pause_duration_minutes: number;
}

export interface WorkScheduleEntry {
  user_id: number;
  weekday: number;
  minutes: number;
}

export type TimeEntryType = 'CLOCK_IN' | 'CLOCK_OUT' | 'BREAK_START' | 'BREAK_END';

export type TimeSource = 'WEB' | 'APP' | 'CORRECTION';

export interface TimeEntry {
  id: number;
  user_id: number;
  timestamp: string;
  type: TimeEntryType;
  source: TimeSource;
  lat?: number | null;
  lng?: number | null;
  created_at?: string;
}

export interface Absence {
  id: number;
  user_id: number;
  start_date: string;
  end_date: string;
  type: string;
  duration: 'full' | 'half';
  start_time?: string | null;
  end_time?: string | null;
  minutes_override?: number | null;
  note?: string | null;
  created_at: string;
  days?: string[];
}
