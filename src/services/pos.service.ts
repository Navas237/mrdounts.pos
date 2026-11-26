import { supabase, isLiveSupabaseConfigured } from '@/lib/supabase';

// =====================================================================
// خدمة عمليات نقطة البيع الجديدة — كل العمليات عبر RPC في الباك إند
// =====================================================================

export interface PaymentMethod {
  id: string;
  name: string;
  is_cash: boolean;
  sort_order: number;
  is_active: boolean;
}

export interface OrderListItem {
  id: string;
  order_number: number;
  shift_id: string;
  order_type: string;
  status: string;
  customer_name?: string;
  customer_phone?: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  delivery_fee: number;
  total: number;
  notes?: string;
  cancel_reason?: string;
  created_at: string;
  items: Array<{
    id: string;
    item_name: string;
    size_name?: string;
    quantity: number;
    unit_price: number;
    extras_total: number;
    line_total: number;
    status: string;
    notes?: string;
    pieces?: number;
    donut_type_name?: string;
    was_modified: boolean;
  }>;
  payments: Array<{
    id: string;
    method_name: string;
    is_cash: boolean;
    amount: number;
    reference?: string;
  }>;
}

export interface OrderPayloadItem {
  department_id: string;
  menu_item_id?: string;
  size_id?: string;
  item_name: string;
  size_name?: string;
  quantity: number;
  unit_price: number;
  notes?: string;
  donut_type_id?: string;
  donut_type_name?: string;
  box_size_id?: string;
  pieces?: number;
  options?: Array<{
    group_id?: string;
    option_id?: string;
    group_name?: string;
    option_name: string;
    extra_price: number;
  }>;
  donut_pieces?: Array<{
    piece_no: number;
    piece_kind: 'stuffed' | 'topping_only';
    options: Array<{
      role: 'filling' | 'topping';
      option_name: string;
      extra_price: number;
    }>;
  }>;
}

export interface OrderPayload {
  order_type: string;
  customer_name?: string;
  customer_phone?: string;
  address_snapshot?: Record<string, unknown> | null;
  delivery_zone_id?: string;
  delivery_zone_name?: string;
  delivery_fee?: number;
  discount_type?: 'percent' | 'amount' | null;
  discount_value?: number;
  notes?: string;
  items: OrderPayloadItem[];
  payments: Array<{
    payment_method_id?: string;
    method_name: string;
    is_cash: boolean;
    amount: number;
    reference?: string;
  }>;
}

function ensureLive() {
  if (!isLiveSupabaseConfigured || !supabase) {
    throw new Error('هذه العملية تحتاج اتصال قاعدة البيانات (Supabase)');
  }
  return supabase;
}

export const posService = {
  // ---------------- طرق الدفع (جدول مرجعي، قراءة مباشرة) ----------------
  async listPaymentMethods(): Promise<PaymentMethod[]> {
    const client = ensureLive();
    const { data, error } = await client
      .from('payment_methods')
      .select('id, name, is_cash, sort_order, is_active')
      .eq('is_active', true)
      .order('sort_order')
      .order('name');
    if (error) throw new Error(error.message);
    return (data || []) as PaymentMethod[];
  },

  async savePaymentMethod(method: Partial<PaymentMethod>): Promise<void> {
    const client = ensureLive();
    const payload = {
      name: method.name,
      is_cash: method.is_cash ?? false,
      sort_order: method.sort_order ?? 0,
      is_active: method.is_active ?? true,
    };
    const { error } = method.id
      ? await client.from('payment_methods').update(payload).eq('id', method.id)
      : await client.from('payment_methods').insert(payload);
    if (error) throw new Error(error.message);
  },

  async deletePaymentMethod(id: string): Promise<void> {
    const client = ensureLive();
    const { error } = await client.from('payment_methods').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  // ---------------- إنشاء أوردر كامل عبر RPC ----------------
  async createOrderFull(payload: OrderPayload): Promise<{ id: string; order_number: number; total: number }> {
    const client = ensureLive();
    const { data, error } = await client.rpc('create_order_full', { p_payload: payload });
    if (error) throw new Error(error.message);
    return data as { id: string; order_number: number; total: number };
  },

  // ---------------- صفحة الطلبات ----------------
  async listOrders(shiftId?: string | null, status?: string | null): Promise<OrderListItem[]> {
    const client = ensureLive();
    const { data, error } = await client.rpc('list_orders', {
      p_shift_id: shiftId || null,
      p_status: status || null,
      p_limit: 200,
      p_offset: 0,
    });
    if (error) throw new Error(error.message);
    return (data || []) as OrderListItem[];
  },

  async editOrder(
    orderId: string,
    changes: {
      notes?: string;
      discount_type?: 'percent' | 'amount' | null;
      discount_value?: number;
      cancel_item_ids?: string[];
      cancel_reason?: string;
      quantity_changes?: Array<{ item_id: string; quantity: number }>;
      payments?: Array<{
        payment_method_id?: string;
        method_name: string;
        is_cash: boolean;
        amount: number;
        reference?: string;
      }>;
    }
  ): Promise<{ id: string; total: number }> {
    const client = ensureLive();
    const { data, error } = await client.rpc('edit_order', { p_order: orderId, p_changes: changes });
    if (error) throw new Error(error.message);
    return data as { id: string; total: number };
  },

  async reprintOrder(orderId: string): Promise<{ labels_created: number }> {
    const client = ensureLive();
    const { data, error } = await client.rpc('reprint_order', { p_order: orderId });
    if (error) throw new Error(error.message);
    return data as { labels_created: number };
  },

  // ---------------- التقارير ----------------
  async shiftEndReport(shiftId: string): Promise<any> {
    const client = ensureLive();
    const { data, error } = await client.rpc('shift_end_report', { p_shift: shiftId });
    if (error) throw new Error(error.message);
    return data;
  },

  async itemSalesReport(shiftId?: string | null, from?: string | null, to?: string | null): Promise<any> {
    const client = ensureLive();
    const { data, error } = await client.rpc('item_sales_report', {
      p_shift: shiftId || null,
      p_from: from || null,
      p_to: to || null,
    });
    if (error) throw new Error(error.message);
    return data;
  },

  async sauceConsumptionReport(shiftId?: string | null, from?: string | null, to?: string | null): Promise<any[]> {
    const client = ensureLive();
    const { data, error } = await client.rpc('sauce_consumption_report', {
      p_shift: shiftId || null,
      p_from: from || null,
      p_to: to || null,
    });
    if (error) throw new Error(error.message);
    return (data || []) as any[];
  },

  // ---------------- الرسبي ----------------
  async listRecipes(): Promise<any[]> {
    const client = ensureLive();
    const { data, error } = await client.rpc('list_recipes');
    if (error) throw new Error(error.message);
    return (data || []) as any[];
  },

  async upsertRecipe(recipe: {
    target_type: 'menu_item' | 'donut_type';
    menu_item_id?: string;
    donut_type_id?: string;
    ingredients: Array<{ ingredient_name: string; quantity: number; unit?: string; per_unit?: string }>;
  }): Promise<{ id: string }> {
    const client = ensureLive();
    const { data, error } = await client.rpc('upsert_recipe', { p_recipe: recipe });
    if (error) throw new Error(error.message);
    return data as { id: string };
  },
};
