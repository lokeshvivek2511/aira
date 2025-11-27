import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Employee {
  id: string;
  name: string;
  email: string;
  phone: string;
  join_date: string;
  status: 'active' | 'inactive';
  account_number?: string;
  ifsc_code?: string;
  account_holder?: string;
  created_at: string;
  updated_at: string;
}

export interface SalaryConfiguration {
  id: string;
  base_salary: number;
  allowances: { name: string; amount: number }[];
  commission_per_packet: number;
  target_levels: { levelName: string; targetPackets: number; incentiveAmount: number }[];
  effective_from: string;
  effective_to?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DailyDelivery {
  id: string;
  employee_id: string;
  delivery_date: string;
  packets_delivered: number;
  status: 'pending' | 'completed' | 'verified';
  notes?: string;
  edited_by?: string;
  edited_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CompanySettings {
  id: string;
  company_name: string;
  profit_per_packet: number;
  currency: string;
  financial_year_start_month: number;
  financial_year_start_date: number;
  updated_at: string;
  updated_by?: string;
}
