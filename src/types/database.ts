// تعريفات أنواع قاعدة البيانات والنظام متطابقة مع Supabase Migrations

export type OrderType = 'dine_in' | 'takeaway' | 'delivery' | 'pickup';
export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
export type ItemStatus = 'pending' | 'preparing' | 'ready' | 'cancelled';
export type DepartmentBehavior = 'customizable' | 'simple' | 'donut_box';
export type DiscountType = 'fixed' | 'percentage';

export interface Branch {
  id: string;
  name: string;
  code: string;
  address?: string | null;
  phone?: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface BranchSettings {
  branch_id: string;
  logo_url?: string | null;
  currency: string;
  tax_enabled: boolean;
  tax_name: string;
  tax_rate: number;
  timezone: string;
  extra?: Record<string, unknown>;
}

export interface Profile {
  id: string;
  branch_id: string;
  username: string;
  full_name: string;
  is_super_admin: boolean;
  is_active: boolean;
  created_at?: string;
}

export interface Permission {
  code: string;
  name: string;
  category: 'screens' | 'shifts' | 'orders' | 'menu' | 'system';
  description?: string;
}

export interface Shift {
  id: string;
  branch_id: string;
  opened_by: string;
  closed_by?: string | null;
  opened_at: string;
  closed_at?: string | null;
  opening_cash: number;
  closing_cash?: number | null;
  expected_cash?: number | null;
  difference?: number | null;
  status: 'open' | 'closed';
  notes?: string | null;
}

export type CashKind = 'in' | 'out';

export interface CashMovement {
  id: string;
  branch_id: string;
  shift_id: string;
  kind: CashKind;
  amount: number;
  category: string;
  description?: string | null;
  created_by?: string | null;
  created_at: string;
}

export interface ShiftSummaryReport {
  shift_id: string;
  status: 'open' | 'closed';
  opened_at: string;
  closed_at?: string | null;
  opened_by: string;
  opening_cash: number;
  expected_cash: number;
  sales_total: number;
  cash_sales: number;
  card_sales: number;
  wallet_sales: number;
  instapay_sales: number;
  total_in: number;
  total_out: number;
  expenses_total: number;
  orders_count: number;
  movements_count: number;
}

export interface Department {
  id: string;
  branch_id: string;
  name: string;
  behavior: DepartmentBehavior;
  prints_labels: boolean;
  sort_order: number;
  is_active: boolean;
}

export interface Customer {
  id: string;
  phone: string;
  name: string;
  notes?: string | null;
  created_at?: string;
}

export interface CustomerAddress {
  id: string;
  customer_id: string;
  delivery_zone_id?: string | null;
  address_line: string;
  building?: string | null;
  floor?: string | null;
  apartment?: string | null;
  is_default: boolean;
}

