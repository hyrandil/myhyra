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
  created_at?: string;
}
