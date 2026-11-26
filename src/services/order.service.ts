import { supabase, isLiveSupabaseConfigured } from '@/lib/supabase';
import { queryClient } from '@/lib/queryClient';
import { CartItem, SplitPaymentItem, OrderType } from '@/types/order';
import { kitchenService, DonutToppingBox } from './kitchen.service';
import { pickupService, PickupDepartmentStatus } from './pickup.service';
import { shiftService } from './shift.service';
import { posService } from './pos.service';

export interface CreateOrderInput {
  orderType: OrderType;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  subtotal: number;
  discountType: 'none' | 'fixed' | 'percentage';
  discountValue: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  deliveryFee: number;
  total: number;
  items: CartItem[];
  payments: SplitPaymentItem[];
  // مفتاح منع التكرار: ثابت عبر إعادة محاولة نفس الدفع
  clientRequestId?: string;
}

const ORDER_TYPE_LABELS: Record<string, string> = {
  dine_in: 'صالة',
  takeaway: 'تيك أواي',
  delivery: 'ديليفري',
  pickup: 'استلام',
};

function getNextOrderNumber(): number {
  if (typeof window === 'undefined') return Math.floor(Math.random() * 800) + 105;
  try {
    const last = Number(localStorage.getItem('mrdonuts_v9_last_order_num')) || 100;
    const next = last + 1;
    localStorage.setItem('mrdonuts_v9_last_order_num', String(next));
    return next;
  } catch {
    return Math.floor(Math.random() * 800) + 105;
  }
}

export const orderService = {
  async createOrder(input: CreateOrderInput): Promise<{ id: string; order_number?: number }> {
    if (isLiveSupabaseConfigured && supabase) {
      // إنشاء الأوردر بالكامل عبر RPC في الباك إند (معاملة واحدة)
      const isUuid = (val?: string) =>
        typeof val === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

      // حل معرفات الأقسام للأصناف القادمة من الوضع المحلي (مثل d-donuts)
      // الأقسام تتغير نادراً: تُجلب مرة وتُخزَّن في كاش react-query المشترك
      // (مفتاح تحت ['menu', ...] حتى يُبطلها أي تعديل في الأقسام/المنيو)،
      // بدل استعلام إضافي قبل كل حفظ أوردر.
      const liveClient = supabase;
      const branchDepts = await queryClient.fetchQuery({
        queryKey: ['menu', 'departments-lookup'],
        staleTime: 10 * 60 * 1000,
        queryFn: async () => {
          const { data, error } = await liveClient!
            .from('departments')
            .select('id, name, behavior');
          if (error) throw new Error(error.message);
          return data || [];
        },
      });

      const resolveDeptId = (item: CartItem): string => {
        if (isUuid(item.department_id)) return item.department_id;
        const match =
          (branchDepts || []).find(
            (d: any) =>
              (item.is_donut_box && d.behavior === 'donut_box') ||
              (item.department_name && d.name.includes(item.department_name)) ||
              (item.is_donut_box && d.name.includes('دونت'))
          ) || (branchDepts || [])[0];
        return match?.id;
      };

      const donutTypeName = (t?: string) =>
        t === 'mini' ? 'ميني' : t === 'stuffed' ? 'حشو' : t === 'regular' ? 'عادي' : undefined;

      const payloadItems = input.items.map((item) => ({
        department_id: resolveDeptId(item),
        item_name:
          item.item_name ||
          (item.is_donut_box
            ? `بوكس دونتس ${donutTypeName(item.donut_type) || ''} (${item.donut_pieces_count || 0} قطعة)`
            : 'صنف'),
        size_name: item.size_name || undefined,
        quantity: item.quantity,
        unit_price: item.unit_price,
        notes: item.notes || undefined,
        donut_type_name: item.is_donut_box ? donutTypeName(item.donut_type) : undefined,
        pieces: item.donut_pieces_count || undefined,
        options: (item.options || []).map((o) => ({
          option_id: isUuid(o.option_id) ? o.option_id : undefined,
          option_name: o.name,
          extra_price: o.extra_price || 0,
        })),
        donut_pieces: (item.donut_pieces || []).map((p) => ({
          piece_no: p.piece_number,
          piece_kind: p.piece_type === 'stuffed' ? ('stuffed' as const) : ('topping_only' as const),
          options: [
            p.stuffing_sauce_name
              ? { role: 'filling' as const, option_name: p.stuffing_sauce_name, extra_price: 0 }
              : null,
            p.topping_sauce_name
              ? { role: 'topping' as const, option_name: p.topping_sauce_name, extra_price: p.extra_fee || 0 }
              : null,
          ].filter(Boolean) as Array<{ role: 'filling' | 'topping'; option_name: string; extra_price: number }>,
        })),
      }));

      const result = await posService.createOrderFull({
        order_type: input.orderType,
        customer_name: input.customerName || undefined,
        customer_phone: input.customerPhone || undefined,
        address_snapshot: input.customerAddress ? { address: input.customerAddress } : null,
        delivery_fee: input.deliveryFee || 0,
        discount_type:
          input.discountType === 'percentage'
            ? 'percent'
            : input.discountType === 'fixed'
            ? 'amount'
            : null,
        discount_value: input.discountValue || 0,
        client_request_id: input.clientRequestId,
        items: payloadItems,
        payments: input.payments.map((p) => ({
          method_name: p.method_name,
          is_cash: p.is_cash,
          amount: p.amount,
        })),
      });

      // تحديث فوري للشفت محلياً أيضاً لضمان استجابة الشاشات فوراً
      shiftService.recordOrderPayment({
        total: input.total,
        payments: input.payments,
        order_id: result.id,
      });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('mrdonuts:order-created'));
        window.dispatchEvent(new CustomEvent('mrdonuts:pickup-updated'));
        window.dispatchEvent(new CustomEvent('mrdonuts:shift-updated'));
      }

      return { id: result.id, order_number: result.order_number };
    }

    // ========================================================
    // بدون اتصال Supabase (بيئة تشغيل محلية متكاملة وسلسة)
    // ========================================================
    let curShift = await shiftService.getCurrentShift();
    if (!curShift) {
      curShift = await shiftService.openShift(0, 'شفت تلقائي للتشغيل المحلي');
    }

    const localOrderNumber = getNextOrderNumber();
    const orderId = `local-ord-${Date.now()}`;

    // 1. فرز الأصناف وتوزيعها على محطات المطبخ
    const orderDepartments: PickupDepartmentStatus[] = [];
    const donutBoxes = input.items.filter((it) => it.is_donut_box);
    const waffleItems = input.items.filter(
      (it) =>
        !it.is_donut_box &&
        (it.department_name?.includes('وافل') || it.item_name?.includes('وافل'))
    );
    const drinksItems = input.items.filter(
      (it) =>
        !it.is_donut_box &&
        (it.department_name?.includes('مشروب') ||
          it.item_name?.includes('مشروب') ||
          it.department_name?.includes('عصير'))
    );
    const otherItems = input.items.filter(
      (it) => !it.is_donut_box && !waffleItems.includes(it) && !drinksItems.includes(it)
    );

    // محطة الدونتس
    if (donutBoxes.length > 0) {
      const totalPieces = donutBoxes.reduce(
        (sum, b) => sum + (b.donut_pieces_count || 0),
        0
      );
      orderDepartments.push({
        department_name: 'دونتس',
        summary: `${donutBoxes.length} بوكس دونتس (${totalPieces} قطعة)`,
        is_ready: false,
      });

      const boxes: DonutToppingBox[] = donutBoxes.map((b, bIdx) => ({
        id: `box-${Date.now()}-${bIdx}`,
        box_number: bIdx + 1,
        pieces_count: b.donut_pieces_count || (b.donut_pieces ? b.donut_pieces.length : 2),
        donut_type: b.donut_type || 'regular',
        is_ready: false,
        pieces: (b.donut_pieces || []).map((p) => ({
          piece_number: p.piece_number,
          topping_sauce_name: p.topping_sauce_name || 'بدون توبنج',
          stuffing_sauce_name: p.stuffing_sauce_name || 'سادة',
          is_stuffed: p.piece_type === 'stuffed',
        })),
      }));

      kitchenService.addMockDonutOrder({
        id: `local-dt-${Date.now()}`,
        order_id: orderId,
        order_daily_number: localOrderNumber,
        order_type: input.orderType,
        order_type_label: ORDER_TYPE_LABELS[input.orderType] || input.orderType,
        customer_name: input.customerName || undefined,
        notes: '',
        status: 'pending',
        created_at: new Date().toISOString(),
        boxes,
        total_boxes: boxes.length,
        total_pieces: boxes.reduce((sum, b) => sum + b.pieces_count, 0),
      });
    }

    // محطة الوافل
    if (waffleItems.length > 0) {
      orderDepartments.push({
        department_name: 'وافل',
        summary: waffleItems
          .map((w) => `${w.quantity > 1 ? w.quantity + 'x ' : ''}${w.item_name || 'وافل'}`)
          .join(' + '),
        is_ready: false,
      });

      waffleItems.forEach((w, idx) => {
        kitchenService.addMockKitchenItem('وافل', {
          id: `item-waf-${Date.now()}-${idx}`,
          order_id: orderId,
          order_daily_number: localOrderNumber,
          order_type: ORDER_TYPE_LABELS[input.orderType] || input.orderType,
          item_name: w.item_name || 'وافل',
          size_name: w.size_name || undefined,
          options: (w.options || []).map((o) => ({
            name: o.name,
            extra_price: o.extra_price,
          })),
          notes: '',
          status: 'pending',
          created_at: new Date().toISOString(),
        });
      });
    }

    // محطة المشروبات
    if (drinksItems.length > 0) {
      orderDepartments.push({
        department_name: 'مشروبات',
        summary: drinksItems
          .map((d) => `${d.quantity > 1 ? d.quantity + 'x ' : ''}${d.item_name || 'مشروب'}`)
          .join(' + '),
        is_ready: false,
      });

      drinksItems.forEach((d, idx) => {
        kitchenService.addMockKitchenItem('مشروبات', {
          id: `item-drk-${Date.now()}-${idx}`,
          order_id: orderId,
          order_daily_number: localOrderNumber,
          order_type: ORDER_TYPE_LABELS[input.orderType] || input.orderType,
          item_name: d.item_name || 'مشروب',
          size_name: d.size_name || undefined,
          options: (d.options || []).map((o) => ({
            name: o.name,
            extra_price: o.extra_price,
          })),
          notes: '',
          status: 'pending',
          created_at: new Date().toISOString(),
        });
      });
    }

    // أصناف عامة إن وجدت
    if (otherItems.length > 0) {
      orderDepartments.push({
        department_name: 'أصناف متنوعة',
        summary: otherItems
          .map((o) => `${o.quantity > 1 ? o.quantity + 'x ' : ''}${o.item_name}`)
          .join(' + '),
        is_ready: true,
      });
    }

    if (orderDepartments.length === 0) {
      orderDepartments.push({
        department_name: 'عام',
        summary: 'طلب عام',
        is_ready: true,
      });
    }

    // 2. تسجيل الأوردر في محطة البيك أب والتسليم
    pickupService.addOrder({
      id: orderId,
      daily_number: localOrderNumber,
      order_type: input.orderType,
      order_type_label: ORDER_TYPE_LABELS[input.orderType] || input.orderType,
      customer_name: input.customerName || 'عميل صالة',
      customer_phone: input.customerPhone || '',
      delivery_address: input.customerAddress || '',
      total_amount: input.total,
      created_at: new Date().toISOString(),
      departments: orderDepartments,
      is_all_ready: orderDepartments.every((d) => d.is_ready),
    });

    // 3. تسجيل المبيعات وحركات الدرج في الشفت
    shiftService.recordOrderPayment({
      total: input.total,
      payments: input.payments,
      order_id: orderId,
    });

    // 4. بث التحديث لكافة واجهات التطبيق للاستجابة اللحظية
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mrdonuts:order-created'));
      window.dispatchEvent(new CustomEvent('mrdonuts:pickup-updated'));
      window.dispatchEvent(new CustomEvent('mrdonuts:shift-updated'));
      window.dispatchEvent(new CustomEvent('mrdonuts:kitchen-updated'));
    }

    return {
      id: orderId,
      order_number: localOrderNumber,
    };
  },
};
