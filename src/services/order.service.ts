import { supabase, isLiveSupabaseConfigured } from '@/lib/supabase';
import { CartItem, SplitPaymentItem, OrderType } from '@/types/order';
import { kitchenService, DonutToppingBox } from './kitchen.service';
import { pickupService, PickupDepartmentStatus } from './pickup.service';
import { shiftService } from './shift.service';

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
      // 1. جلب الشفت النشط وأقسام الفرع بالتوازي (Parallel Fetch)
      const isUuid = (val?: string) =>
        typeof val === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

      const [shiftRes, deptsRes] = await Promise.all([
        supabase
          .from('shifts')
          .select('id, branch_id')
          .eq('status', 'open')
          .maybeSingle(),
        supabase
          .from('departments')
          .select('id, name, behavior'),
      ]);

      const shift = shiftRes.data;
      if (shiftRes.error || !shift) {
        throw new Error('لا يوجد شفت مفتوح حالياً. يجب فتح شفت قبل تسجيل الطلبات.');
      }

      const branchId = shift.branch_id;
      const branchDepts = deptsRes.data || [];

      // 2. إدراج الأوردر الرئيسي (متوافق مع حقول جدول orders بقاعدة البيانات)
      const { data: newOrder, error: orderErr } = await supabase
        .from('orders')
        .insert({
          branch_id: branchId,
          shift_id: shift.id,
          order_type: input.orderType,
          customer_name: input.customerName || 'عميل صالة',
          customer_phone: input.customerPhone || null,
          address_snapshot: input.customerAddress ? { address: input.customerAddress } : null,
          notes: input.customerAddress ? `العنوان: ${input.customerAddress}` : null,
          subtotal: input.subtotal,
          discount_type:
            input.discountType === 'percentage'
              ? 'percent'
              : input.discountType === 'fixed'
              ? 'amount'
              : null,
          discount_value: input.discountValue,
          discount_amount: input.discountAmount,
          tax_rate: input.taxRate,
          tax_amount: input.taxAmount,
          delivery_fee: input.deliveryFee,
          total: input.total,
          status: 'active',
        })
        .select('id, order_number')
        .single();

      if (orderErr || !newOrder) {
        console.error('Failed to insert order:', orderErr);
        throw new Error(orderErr?.message || 'فشل حفظ الطلب بقاعدة البيانات');
      }

      const orderId = newOrder.id;

      // 3. تجهيز وإدراج كافة الأصناف دفعة واحدة (Batch Insert for Order Items)
      const orderItemsPayload = input.items.map((item) => {
        const itemName =
          item.item_name ||
          (item.is_donut_box
            ? `بوكس دونتس ${
                item.donut_type === 'mini'
                  ? 'ميني'
                  : item.donut_type === 'stuffed'
                  ? 'حشو'
                  : 'عادي'
              } (${item.donut_pieces_count || 0} قطعة)`
            : 'صنف');

        let resolvedDeptId = item.department_id;
        if (!isUuid(resolvedDeptId)) {
          const match =
            branchDepts.find(
              (d: any) =>
                d.behavior === (item.is_donut_box ? 'donut_box' : undefined) ||
                d.name.includes(item.department_name || '') ||
                (item.is_donut_box && d.name.includes('دونتس'))
            ) || branchDepts[0];

          if (match && isUuid(match.id)) {
            resolvedDeptId = match.id;
          }
        }

        const lineTotal =
          item.line_total ||
          item.unit_price * item.quantity +
            (item.options?.reduce((s, o) => s + (o.extra_price || 0), 0) || 0);

        return {
          branch_id: branchId,
          order_id: orderId,
          department_id: resolvedDeptId,
          item_name: itemName,
          size_name: item.size_name || null,
          quantity: item.quantity,
          unit_price: item.unit_price,
          line_total: lineTotal,
          donut_type_name:
            item.donut_type === 'mini'
              ? 'ميني'
              : item.donut_type === 'stuffed'
              ? 'حشو'
              : item.donut_type === 'regular'
              ? 'عادي'
              : null,
          pieces: item.donut_pieces_count || null,
          status: 'pending',
        };
      });

      const { data: insertedItems, error: itemsErr } = await supabase
        .from('order_items')
        .insert(orderItemsPayload)
        .select('id');

      if (itemsErr || !insertedItems) {
        console.error('Failed to insert order items batch:', itemsErr);
        throw new Error('فشل إدراج أصناف الطلب بقاعدة البيانات');
      }

      // 4. تجهيز خيارات الأصناف (options) وقطع الدونتس (pieces) المجمعة
      const allItemOptionsPayload: any[] = [];
      const allPiecesPayload: any[] = [];
      const piecesMetadataMap: Array<{
        stuffing_sauce_name?: string;
        topping_sauce_name?: string;
        extra_fee?: number;
      }> = [];

      input.items.forEach((item, idx) => {
        const orderItemId = insertedItems[idx]?.id;
        if (!orderItemId) return;

        // خيارات الأصناف العادية
        if (item.options && item.options.length > 0) {
          for (const opt of item.options) {
            allItemOptionsPayload.push({
              branch_id: branchId,
              order_item_id: orderItemId,
              option_name: opt.name,
              extra_price: opt.extra_price || 0,
            });
          }
        }

        // قطع الدونتس
        if (item.donut_pieces && item.donut_pieces.length > 0) {
          for (const piece of item.donut_pieces) {
            allPiecesPayload.push({
              branch_id: branchId,
              order_id: orderId,
              order_item_id: orderItemId,
              piece_no: piece.piece_number,
              piece_kind: piece.piece_type === 'stuffed' ? 'stuffed' : 'topping_only',
            });
            piecesMetadataMap.push({
              stuffing_sauce_name: piece.stuffing_sauce_name,
              topping_sauce_name: piece.topping_sauce_name,
              extra_fee: piece.extra_fee,
            });
          }
        }
      });

      // 5. إدراج القطع المجمعة دفعة واحدة ثم خيارات القطع
      let allPieceOptionsPayload: any[] = [];
      if (allPiecesPayload.length > 0) {
        const { data: insertedPieces } = await supabase
          .from('order_item_pieces')
          .insert(allPiecesPayload)
          .select('id');

        if (insertedPieces) {
          insertedPieces.forEach((pieceRow, pIdx) => {
            const meta = piecesMetadataMap[pIdx];
            if (meta?.stuffing_sauce_name) {
              allPieceOptionsPayload.push({
                branch_id: branchId,
                piece_id: pieceRow.id,
                role: 'filling',
                option_name: meta.stuffing_sauce_name,
                extra_price: 0,
              });
            }
            if (meta?.topping_sauce_name) {
              allPieceOptionsPayload.push({
                branch_id: branchId,
                piece_id: pieceRow.id,
                role: 'topping',
                option_name: meta.topping_sauce_name,
                extra_price: meta.extra_fee || 0,
              });
            }
          });
        }
      }

      // 6. تجهيز المدفوعات وإرسال كافة الخيارات والمدفوعات بالتوازي (Parallel Bulk Inserts)
      const paymentsPayload = input.payments.map((p) => ({
        branch_id: branchId,
        order_id: orderId,
        shift_id: shift.id,
        method_name: p.method_name,
        is_cash: p.is_cash,
        amount: p.amount,
      }));

      await Promise.allSettled([
        allItemOptionsPayload.length > 0
          ? supabase.from('order_item_options').insert(allItemOptionsPayload)
          : Promise.resolve(),
        allPieceOptionsPayload.length > 0
          ? supabase.from('order_item_piece_options').insert(allPieceOptionsPayload)
          : Promise.resolve(),
        paymentsPayload.length > 0
          ? supabase.from('payments').insert(paymentsPayload)
          : Promise.resolve(),
      ]);

      // تحديث فوري للشفت محلياً أيضاً لضمان استجابة الشاشات فوراً
      shiftService.recordOrderPayment({
        total: input.total,
        payments: input.payments,
        order_id: orderId,
      });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('mrdonuts:order-created'));
        window.dispatchEvent(new CustomEvent('mrdonuts:pickup-updated'));
        window.dispatchEvent(new CustomEvent('mrdonuts:shift-updated'));
      }

      return { id: orderId, order_number: newOrder.order_number };
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
