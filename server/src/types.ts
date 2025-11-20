export type Role = 'user' | 'admin';

export interface User {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: Role;
  active: number;
  created_at: string;
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

export interface Absence {
  id: number;
  user_id: number;
  date: string;
  type: 'vacation' | 'sick' | 'remote' | 'other';
  duration: 'full' | 'half';
  note?: string | null;
  created_at: string;
}
