import { supabase, isLiveSupabaseConfigured } from '@/lib/supabase';

export interface CustomerRecord {
  id: string;
  name: string;
  phone: string;
  default_address?: string;
  orders_count: number;
  total_spent: number;
  created_at: string;
}

export interface IncomingCallEvent {
  caller_number: string;
  caller_name?: string;
  timestamp: string;
}

export const DEFAULT_CUSTOMERS: CustomerRecord[] = [];

let mockCustomersState: CustomerRecord[] = [];

export const customerService = {
  async getCustomers(
    _period: 'today' | '7days' | '30days' | 'all' = 'all',
    sortBy: 'orders' | 'total' = 'total'
  ): Promise<CustomerRecord[]> {
    if (isLiveSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('customers')
          .select('*');

        if (!error && data) {
          const formatted: CustomerRecord[] = data.map((c: any) => ({
            id: c.id,
            name: c.name || 'عميل بدون اسم',
            phone: c.phone || '',
            default_address: c.default_address || '',
            orders_count: c.orders_count || 0,
            total_spent: Number(c.total_spent) || 0,
            created_at: c.created_at || new Date().toISOString(),
          }));

          return formatted.sort((a, b) =>
            sortBy === 'orders' ? b.orders_count - a.orders_count : b.total_spent - a.total_spent
          );
        }
      } catch (err) {
        console.warn('Supabase fetch failed for customers:', err);
      }
    }

    return [...mockCustomersState].sort((a, b) =>
      sortBy === 'orders' ? b.orders_count - a.orders_count : b.total_spent - a.total_spent
    );
  },

  async createCustomer(name: string, phone: string, address?: string): Promise<CustomerRecord | null> {
    if (isLiveSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('customers')
        .insert({
          name,
          phone,
          default_address: address,
          branch_id: 'b-main',
        })
        .select()
        .single();

      if (!error && data) {
        return {
          id: data.id,
          name: data.name,
          phone: data.phone,
          default_address: data.default_address,
          orders_count: 0,
          total_spent: 0,
          created_at: data.created_at,
        };
      }
    }

    const newCustomer: CustomerRecord = {
      id: `c-mock-${Date.now()}`,
      name,
      phone,
      default_address: address,
      orders_count: 1,
      total_spent: 0,
      created_at: new Date().toISOString(),
    };
    mockCustomersState.unshift(newCustomer);
    return newCustomer;
  },

  async updateCustomer(
    id: string,
    updates: Partial<Pick<CustomerRecord, 'name' | 'phone' | 'default_address'>>
  ): Promise<void> {
    if (isLiveSupabaseConfigured && supabase) {
      await supabase
        .from('customers')
        .update({
          name: updates.name,
          phone: updates.phone,
          default_address: updates.default_address,
        })
        .eq('id', id);
    }
    mockCustomersState = mockCustomersState.map((c) =>
      c.id === id ? { ...c, ...updates } : c
    );
  },

  async getCustomerByPhone(phone: string): Promise<CustomerRecord | null> {
    if (isLiveSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('phone', phone.trim())
        .maybeSingle();

      if (!error && data) {
        return {
          id: data.id,
          name: data.name,
          phone: data.phone,
          default_address: data.default_address,
          orders_count: data.orders_count || 0,
          total_spent: Number(data.total_spent) || 0,
          created_at: data.created_at,
        };
      }
    }
    return mockCustomersState.find((c) => c.phone.trim() === phone.trim()) || null;
  },

  async findCustomerByPhone(phone: string): Promise<CustomerRecord | null> {
    return this.getCustomerByPhone(phone);
  },
};
