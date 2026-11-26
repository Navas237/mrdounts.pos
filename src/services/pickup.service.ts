import { supabase, isLiveSupabaseConfigured } from '@/lib/supabase';

export interface PickupDepartmentStatus {
  department_name: string;
  summary: string;
  is_ready: boolean;
}

export interface PickupOrder {
  id: string;
  daily_number: number;
  order_type: 'dine_in' | 'takeaway' | 'delivery' | 'pickup';
  order_type_label: string;
  customer_name?: string;
  customer_phone?: string;
  delivery_address?: string;
  total_amount: number;
  created_at: string;
  departments: PickupDepartmentStatus[];
  is_all_ready: boolean;
}

const ORDER_TYPE_LABELS: Record<string, string> = {
  dine_in: 'صالة',
  takeaway: 'تيك أواي',
  delivery: 'ديليفري',
  pickup: 'استلام',
};

const STORAGE_KEY = 'mrdonuts_v9_pickup_orders';

function loadPickupOrders(): PickupOrder[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
}

function savePickupOrders(orders: PickupOrder[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  } catch {
    // ignore
  }
}

export const pickupService = {
  async getPickupOrders(): Promise<PickupOrder[]> {
    if (isLiveSupabaseConfigured && supabase) {
      try {
        const { data: orders, error } = await supabase
          .from('orders')
          .select(`
            id,
            order_number,
            order_type,
            customer_name,
            customer_phone,
            total,
            created_at,
            status,
            order_items (
              id,
              department_id,
              item_name,
              status,
              departments (name)
            )
          `)
          .eq('status', 'active')
          .order('created_at', { ascending: false });

        if (!error && orders) {
          const formatted: PickupOrder[] = orders.map((o: any) => {
            const items = o.order_items || [];
            const deptMap = new Map<string, { names: string[]; isReady: boolean }>();
            items.forEach((item: any) => {
              const deptName = item.departments?.name || 'قسم عام';
              const existing = deptMap.get(deptName) || { names: [], isReady: true };
              existing.names.push(item.item_name);
              if (item.status !== 'ready' && item.status !== 'delivered') {
                existing.isReady = false;
              }
              deptMap.set(deptName, existing);
            });

            const departments: PickupDepartmentStatus[] = Array.from(deptMap.entries()).map(
              ([deptName, val]) => ({
                department_name: deptName,
                summary: val.names.join(' + '),
                is_ready: val.isReady,
              })
            );

            const isAllReady =
              departments.length > 0 && departments.every((d) => d.is_ready);

            return {
              id: o.id,
              daily_number: o.order_number || 1,
              order_type: o.order_type,
              order_type_label: ORDER_TYPE_LABELS[o.order_type] || o.order_type,
              customer_name: o.customer_name || 'عميل صالة',
              customer_phone: o.customer_phone || '',
              delivery_address:
                (typeof o.address_snapshot === 'object' && o.address_snapshot?.address)
                  ? o.address_snapshot.address
                  : (o.delivery_address || ''),
              total_amount: Number(o.total) || 0,
              created_at: o.created_at || new Date().toISOString(),
              departments,
              is_all_ready: isAllReady,
            };
          });

          // دمج الطلبات المحلية إن وجدت مع استبعاد التكرار
          const localOrders = loadPickupOrders();
          const mergedMap = new Map<string, PickupOrder>();
          formatted.forEach((o) => mergedMap.set(o.id, o));
          localOrders.forEach((o) => {
            if (!mergedMap.has(o.id)) {
              mergedMap.set(o.id, o);
            }
          });

          return Array.from(mergedMap.values());
        }
      } catch (err) {
        console.warn('Supabase fetch failed for pickup orders:', err);
      }
    }

    return loadPickupOrders();
  },

  addOrder(order: PickupOrder): void {
    const list = loadPickupOrders();
    const filtered = list.filter((o) => o.id !== order.id);
    filtered.unshift(order);
    savePickupOrders(filtered);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mrdonuts:pickup-updated'));
    }
  },

  markDepartmentReady(orderId: string, departmentName: string): void {
    const list = loadPickupOrders();
    let hasChanges = false;
    const updated = list.map((ord) => {
      if (ord.id === orderId || (ord as any).order_id === orderId) {
        hasChanges = true;
        const depts = ord.departments.map((d) => {
          if (
            d.department_name === departmentName ||
            d.department_name.includes(departmentName) ||
            departmentName.includes(d.department_name)
          ) {
            return { ...d, is_ready: true };
          }
          return d;
        });
        const isAllReady = depts.length > 0 && depts.every((d) => d.is_ready);
        return {
          ...ord,
          departments: depts,
          is_all_ready: isAllReady,
        };
      }
      return ord;
    });

    if (hasChanges) {
      savePickupOrders(updated);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('mrdonuts:pickup-updated'));
      }
    }
  },

  async deliverOrder(orderId: string): Promise<void> {
    if (isLiveSupabaseConfigured && supabase) {
      // التسليم يتم فقط عبر deliver_order على السيرفر: يفرض صلاحية order.deliver،
      // يمنع التسليم قبل اكتمال كل الأصناف (ITEMS_NOT_READY)، ويسجّل delivered_by
      // و order_events. لا يوجد تحديث مباشر احتياطي: أي رفض من السيرفر يفشل
      // ظاهراً ويبقى الأوردر في شاشة الانتظار.
      const { error } = await supabase.rpc('deliver_order', { p_order: orderId });
      if (error) {
        console.error('Supabase deliverOrder failed:', error);
        throw new Error(error.message);
      }
      const liveList = loadPickupOrders();
      savePickupOrders(liveList.filter((o) => o.id !== orderId && (o as any).order_id !== orderId));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('mrdonuts:pickup-updated'));
      }
      return;
    }

    const list = loadPickupOrders();
    const updated = list.filter((o) => o.id !== orderId && (o as any).order_id !== orderId);
    savePickupOrders(updated);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mrdonuts:pickup-updated'));
    }
  },

  async cancelOrder(orderId: string, reason = ''): Promise<void> {
    if (isLiveSupabaseConfigured && supabase) {
      // نفس مبدأ التسليم: الإلغاء عبر cancel_order فقط، بدون تحديث مباشر احتياطي.
      const { error } = await supabase.rpc('cancel_order', { p_order: orderId, p_reason: reason });
      if (error) {
        console.error('Supabase cancelOrder failed:', error);
        throw new Error(error.message);
      }
      const liveList = loadPickupOrders();
      savePickupOrders(liveList.filter((o) => o.id !== orderId && (o as any).order_id !== orderId));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('mrdonuts:pickup-updated'));
      }
      return;
    }

    const list = loadPickupOrders();
    const updated = list.filter((o) => o.id !== orderId && (o as any).order_id !== orderId);
    savePickupOrders(updated);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mrdonuts:pickup-updated'));
    }
  },
};
