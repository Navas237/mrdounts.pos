import { supabase, isLiveSupabaseConfigured } from '@/lib/supabase';
import { demoOrders, demoShiftReport, demoItemSales, demoSauceConsumption, demoRecipes, demoPaymentMethods, demoZones, demoCustomerByPhone } from './pos.fixtures';

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
  address_snapshot?: { address?: string } | null;
  delivery_zone_name?: string | null;
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
    options?: Array<{ option_name: string; extra_price?: number }>;
    piece_details?: Array<{ piece_no: number; kind: 'stuffed' | 'topping_only'; filling: string | null; topping: string | null; filling_extra?: number; topping_extra?: number }>;
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
  client_request_id?: string;
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

// وضع العرض التجريبي: فقط بدون اتصال Supabase ومع ضبط VITE_POS_DEMO=1 صراحةً
export const isPosDemoMode = !isLiveSupabaseConfigured && import.meta.env.VITE_POS_DEMO === '1';

function ensureLive() {
  if (!isLiveSupabaseConfigured || !supabase) {
    throw new Error('هذه العملية تحتاج اتصال قاعدة البيانات (Supabase)');
  }
  return supabase;
}

export interface DeliveryZone { id: string; name: string; fee: number; sort_order: number; is_active: boolean }
export interface CustomerLookup {
  id: string; name: string; phone: string;
  addresses: Array<{ id: string; label?: string | null; address: string; landmark?: string | null; is_default: boolean; zone_id: string | null; zone_name: string | null; zone_fee: number | null }>;
}

export interface ReceiptSettings {
  logo_url: string | null;
  show_logo: boolean;
  logo_width_mm: number;
  brand_name: string | null;
  /** null = اعرض عنوان وتليفون الفرع تلقائي */
  header_lines: string[] | null;
  footer_lines: string[];
  delivery_footer_lines: string[];
  branch?: { name?: string | null; address?: string | null; phone?: string | null };
}
export const DEFAULT_RECEIPT_SETTINGS: ReceiptSettings = {
  logo_url: null, show_logo: true, logo_width_mm: 30, brand_name: null, header_lines: null,
  footer_lines: ['شكراً لزيارتكم'], delivery_footer_lines: ['نتمنى لكم وجبة سعيدة'],
};
let demoReceiptSettings: ReceiptSettings = { ...DEFAULT_RECEIPT_SETTINGS };

export const posService = {
  // ---------------- إعدادات الإيصال (RPC) ----------------
  async getReceiptSettings(): Promise<ReceiptSettings> {
    if (isPosDemoMode) return { ...demoReceiptSettings };
    const client = ensureLive();
    const { data, error } = await client.rpc('get_receipt_settings');
    if (error) throw new Error(error.message);
    return data as ReceiptSettings;
  },
  async saveReceiptSettings(st: ReceiptSettings): Promise<ReceiptSettings> {
    if (isPosDemoMode) { demoReceiptSettings = { ...st }; return { ...st }; }
    const client = ensureLive();
    const { data, error } = await client.rpc('save_receipt_settings', {
      p: {
        logo_url: st.logo_url, show_logo: st.show_logo, logo_width_mm: st.logo_width_mm,
        brand_name: st.brand_name, header_lines: st.header_lines,
        footer_lines: st.footer_lines, delivery_footer_lines: st.delivery_footer_lines,
      },
    });
    if (error) throw new Error(error.message);
    return data as ReceiptSettings;
  },

  // ---------------- مناطق التوصيل + بحث العميل (RPC) ----------------
  async listDeliveryZones(includeInactive = false): Promise<DeliveryZone[]> {
    if (isPosDemoMode) return demoZones.filter((z) => includeInactive || z.is_active).map((z) => ({ ...z }));
    const client = ensureLive();
    const { data, error } = await client.rpc('list_delivery_zones', { p_include_inactive: includeInactive });
    if (error) throw new Error(error.message);
    return (data || []) as DeliveryZone[];
  },
  async saveDeliveryZone(z: { id?: string | null; name: string; fee: number; sort_order?: number; is_active?: boolean }): Promise<void> {
    if (isPosDemoMode) {
      const ex = demoZones.find((d) => d.id === z.id);
      if (ex) Object.assign(ex, { name: z.name, fee: z.fee, is_active: z.is_active ?? ex.is_active });
      else demoZones.push({ id: `demo-zone-${Date.now()}`, name: z.name, fee: z.fee, sort_order: z.sort_order ?? demoZones.length + 1, is_active: z.is_active ?? true });
      return;
    }
    const client = ensureLive();
    const { error } = await client.rpc('upsert_delivery_zone', {
      p_id: z.id || null, p_name: z.name, p_fee: z.fee, p_sort: z.sort_order ?? 0, p_active: z.is_active ?? true,
    });
    if (error) throw new Error(error.message);
  },
  async deleteDeliveryZone(id: string): Promise<void> {
    if (isPosDemoMode) {
      const i = demoZones.findIndex((d) => d.id === id);
      if (i >= 0) demoZones.splice(i, 1);
      return;
    }
    const client = ensureLive();
    const { error } = await client.rpc('delete_delivery_zone', { p_id: id });
    if (error) throw new Error(error.message);
  },
  async findCustomerByPhone(phone: string): Promise<CustomerLookup | null> {
    if (isPosDemoMode) return demoCustomerByPhone[phone.trim()] || null;
    const client = ensureLive();
    const { data, error } = await client.rpc('find_customer_by_phone', { p_phone: phone });
    if (error) throw new Error(error.message);
    return (data as CustomerLookup | null) ?? null;
  },

  // ---------------- طرق الدفع (جدول مرجعي، قراءة مباشرة) ----------------
  async listPaymentMethods(): Promise<PaymentMethod[]> {
    if (isPosDemoMode) return demoPaymentMethods;
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
    if (isPosDemoMode) {
      return status ? demoOrders.filter((o) => o.status === status) : demoOrders;
    }
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

  // إعادة طباعة إيصال العميل على طابعة الإيصالات المعينة للفرع
  async reprintReceipt(orderId: string): Promise<{ receipt_created: boolean }> {
    if (isPosDemoMode) return { receipt_created: true };
    const client = ensureLive();
    const { data, error } = await client.rpc('reprint_receipt', { p_order: orderId });
    if (error) throw new Error(error.message);
    return data as { receipt_created: boolean };
  },

  async reprintOrder(orderId: string): Promise<{ labels_created: number }> {
    if (isPosDemoMode) return { labels_created: 2 };
    const client = ensureLive();
    const { data, error } = await client.rpc('reprint_order', { p_order: orderId });
    if (error) throw new Error(error.message);
    return data as { labels_created: number };
  },

  // ---------------- التقارير ----------------
  async shiftEndReport(shiftId: string): Promise<any> {
    if (isPosDemoMode) return demoShiftReport;
    const client = ensureLive();
    const { data, error } = await client.rpc('shift_end_report', { p_shift: shiftId });
    if (error) throw new Error(error.message);
    return data;
  },

  async itemSalesReport(shiftId?: string | null, from?: string | null, to?: string | null): Promise<any> {
    if (isPosDemoMode) return demoItemSales;
    const client = ensureLive();
    const { data, error } = await client.rpc('item_sales_report', {
      p_shift: shiftId || null,
      p_from: from || null,
      p_to: to || null,
    });
    if (error) throw new Error(error.message);
    return data;
  },

  async sauceConsumptionReport(shiftId?: string | null, from?: string | null, to?: string | null): Promise<any> {
    if (isPosDemoMode) return demoSauceConsumption;
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
    if (isPosDemoMode) return demoRecipes;
    const client = ensureLive();
    const { data, error } = await client.rpc('list_recipes');
    if (error) throw new Error(error.message);
    return (data || []) as any[];
  },

  async upsertRecipe(recipe: {
    target_type: 'menu_item' | 'donut_type';
    menu_item_id?: string;
    donut_type_id?: string;
    ingredients: Array<{ ingredient_name: string; quantity: number; unit?: string; per_unit?: string; option_name?: string; role?: string }>;
  }): Promise<{ id: string }> {
    const client = ensureLive();
    const { data, error } = await client.rpc('upsert_recipe', { p_recipe: recipe });
    if (error) throw new Error(error.message);
    return data as { id: string };
  },
};
