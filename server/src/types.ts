export type Role = 'user' | 'admin';

export interface User {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: Role;
  created_at: string;
}

export interface Booking {
  id: number;
  user_id: number;
  clock_in: string;
  clock_out?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  created_at: string;
  updated_at: string;
}
