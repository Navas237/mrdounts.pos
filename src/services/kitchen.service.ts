import { supabase, isLiveSupabaseConfigured } from '@/lib/supabase';
import { ItemStatus } from '@/types/database';
import { pickupService } from './pickup.service';

export interface KitchenItem {
  id: string;
  order_id: string;
  order_daily_number: number;
  order_type: string;
  item_name: string;
  size_name?: string;
  options: { name: string; extra_price: number }[];
  notes?: string;
  status: ItemStatus;
  created_at: string;
}

export interface StuffingCombo {
  stuffing: string;
  stuffing_count: number;
  toppings: { name: string; count: number }[];
}

export interface DonutAggregatedBatch {
  batch_id: string;
  batch_number: number;
  is_receiving_stopped: boolean;
  pending_orders_count: number;
  sizes: {
    size_type: 'regular' | 'mini' | 'stuffed';
    type_name: string;
    total_pieces: number;
    stuffed: {
      count: number;
      combos: StuffingCombo[];
    };
    topping_only: {
      count: number;
      topping_sauces: { name: string; count: number }[];
    };
  }[];
}

export interface DonutToppingPiece {
  id?: string;
  piece_number: number;
  topping_sauce_name: string;
  stuffing_sauce_name: string;
  is_stuffed: boolean;
  injected_at?: string | null;
}

export interface DonutToppingBox {
  id: string;
  box_number: number;
  pieces_count: number;
  donut_type: 'regular' | 'mini' | 'stuffed';
  is_ready: boolean;
  pieces: DonutToppingPiece[];
}

export interface DonutToppingOrder {
  id: string;
  order_id: string;
  order_daily_number: number;
  order_type: 'dine_in' | 'takeaway' | 'delivery' | 'pickup';
  order_type_label: string;
  customer_name?: string;
  notes?: string;
  status: 'pending' | 'preparing' | 'ready';
  created_at: string;
  boxes: DonutToppingBox[];
  total_boxes: number;
  total_pieces: number;
}

export interface StuffingSauceAggregate {
  key: string;
  sauce_name: string;
  donut_type: 'regular' | 'mini' | 'stuffed';
  donut_type_label: string;
  total_pieces: number;
  pending_pieces: number;
  regular_pieces: number;
  mini_pieces: number;
  stuffed_pieces?: number;
  is_completed: boolean;
}

export interface DonutInjectionOrder {
  order_id: string;
  order_daily_number: number;
  order_type_label: string;
  customer_name?: string;
  created_at: string;
  is_injected: boolean;
  stuffed_count: number;
  plain_count: number;
  total_pieces: number;
  stuffing_details: {
    sauce_name: string;
    count: number;
    donut_type: 'regular' | 'mini' | 'stuffed';
  }[];
}

export interface DonutInjectionData {
  total_pieces: number;
  total_stuffed: number;
  total_plain: number;
  pending_orders_count: number;
  queued_orders_count?: number;
  sauce_aggregates: StuffingSauceAggregate[];
  orders: DonutInjectionOrder[];
}

const ORDER_TYPE_LABELS: Record<string, string> = {
  dine_in: 'صالة',
  takeaway: 'تيك أواي',
  delivery: 'ديليفري',
  pickup: 'استلام',
};

export const DEFAULT_DONUT_TOPPING_ORDERS: DonutToppingOrder[] = [];

export const DEFAULT_DONUT_BATCH: DonutAggregatedBatch = {
  batch_id: '',
  batch_number: 1,
  is_receiving_stopped: false,
  pending_orders_count: 0,
  sizes: [],
};

export const DEFAULT_WAFFLE_ITEMS: KitchenItem[] = [];

export const DEFAULT_DRINKS_ITEMS: KitchenItem[] = [];

const KITCHEN_STORAGE_KEYS = {
  waffle: 'mrdonuts_v9_kitchen_waffle',
  drinks: 'mrdonuts_v9_kitchen_drinks',
  donutTopping: 'mrdonuts_v9_kitchen_donut_topping',
};

function loadStoredKitchen<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return defaultValue;
}

function saveStoredKitchen(key: string, data: any): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // ignore
  }
}

// حالة محلية للأصناف التجريبية للتفاعل في بيئة الموك مع حفظها محلياً
let mockWaffleState: KitchenItem[] = loadStoredKitchen(KITCHEN_STORAGE_KEYS.waffle, [...DEFAULT_WAFFLE_ITEMS]);
let mockDrinksState: KitchenItem[] = loadStoredKitchen(KITCHEN_STORAGE_KEYS.drinks, [...DEFAULT_DRINKS_ITEMS]);
let mockDonutBatchState = { ...DEFAULT_DONUT_BATCH };
let mockDonutToppingOrdersState: DonutToppingOrder[] = loadStoredKitchen(
  KITCHEN_STORAGE_KEYS.donutTopping,
  [...DEFAULT_DONUT_TOPPING_ORDERS]
);
let mockCompletedInjectionSauces: Record<string, boolean> = {};
let mockInjectedOrders: Record<string, boolean> = {};

export const kitchenService = {
  async getDepartmentItems(departmentName: 'وافل' | 'مشروبات'): Promise<KitchenItem[]> {
    if (isLiveSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('order_items')
          .select(`
            id,
            order_id,
            item_name,
            size_name,
            notes,
            status,
            created_at,
            orders (
              order_number,
              order_type
            ),
            departments!inner (
              name
            ),
            order_item_options (
              option_name,
              extra_price
            )
          `)
          .eq('departments.name', departmentName)
          .in('status', ['pending', 'preparing'])
          .order('created_at', { ascending: true });

        if (!error && data) {
          return data.map((item: any) => ({
            id: item.id,
            order_id: item.order_id,
            order_daily_number: item.orders?.order_number || 1,
            order_type: ORDER_TYPE_LABELS[item.orders?.order_type] || item.orders?.order_type || 'صالة',
            item_name: item.item_name,
            size_name: item.size_name || undefined,
            options: (item.order_item_options || []).map((o: any) => ({
              name: o.option_name,
              extra_price: Number(o.extra_price) || 0,
            })),
            notes: item.notes || '',
            status: item.status as ItemStatus,
            created_at: item.created_at || new Date().toISOString(),
          }));
        }
      } catch (err) {
        console.warn(`Supabase fetch failed for ${departmentName}, using mock fallback:`, err);
      }
    }

    return departmentName === 'وافل' ? mockWaffleState : mockDrinksState;
  },

  async startItem(itemId: string): Promise<void> {
    if (isLiveSupabaseConfigured && supabase) {
      const { error } = await supabase.rpc('start_item', { p_item_id: itemId });
      if (error) {
        await supabase
          .from('order_items')
          .update({ status: 'preparing' })
          .eq('id', itemId);
      }
    }
    // تحديث الحالة المحلية
    mockWaffleState = mockWaffleState.map((i) => (i.id === itemId ? { ...i, status: 'preparing' as ItemStatus } : i));
    mockDrinksState = mockDrinksState.map((i) => (i.id === itemId ? { ...i, status: 'preparing' as ItemStatus } : i));
    saveStoredKitchen(KITCHEN_STORAGE_KEYS.waffle, mockWaffleState);
    saveStoredKitchen(KITCHEN_STORAGE_KEYS.drinks, mockDrinksState);
  },

  async finishItem(itemId: string): Promise<void> {
    if (isLiveSupabaseConfigured && supabase) {
      const { error } = await supabase.rpc('finish_item', { p_item_id: itemId });
      if (error) {
        await supabase
          .from('order_items')
          .update({ status: 'ready' })
          .eq('id', itemId);
      }
    }

    const allItems = [...mockWaffleState, ...mockDrinksState];
    const targetItem = allItems.find((i) => i.id === itemId);

    mockWaffleState = mockWaffleState.filter((i) => i.id !== itemId);
    mockDrinksState = mockDrinksState.filter((i) => i.id !== itemId);
    saveStoredKitchen(KITCHEN_STORAGE_KEYS.waffle, mockWaffleState);
    saveStoredKitchen(KITCHEN_STORAGE_KEYS.drinks, mockDrinksState);

    if (targetItem && targetItem.order_id) {
      const remainingWaffle = mockWaffleState.some((i) => i.order_id === targetItem.order_id);
      const remainingDrinks = mockDrinksState.some((i) => i.order_id === targetItem.order_id);
      if (!remainingWaffle) {
        pickupService.markDepartmentReady(targetItem.order_id, 'وافل');
      }
      if (!remainingDrinks) {
        pickupService.markDepartmentReady(targetItem.order_id, 'مشروبات');
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mrdonuts:kitchen-updated'));
    }
  },

  async getDonutBatch(): Promise<DonutAggregatedBatch> {
    if (isLiveSupabaseConfigured && supabase) {
      // 1. جلب الدفعة المفتوحة حالياً
      const { data: batch } = await supabase
        .from('donut_batches')
        .select('*')
        .eq('status', 'open')
        .maybeSingle();

      // 2. التحقق من حالة استلام المحطة
      const { data: station } = await supabase
        .from('donut_station')
        .select('receiving')
        .maybeSingle();

      const isReceivingStopped = station ? !station.receiving : false;

      if (!batch) {
        return {
          batch_id: '',
          batch_number: 1,
          is_receiving_stopped: isReceivingStopped,
          pending_orders_count: 0,
          sizes: [],
        };
      }

      // 3. جلب قطع الدونتس التابعة للدفعة المفتوحة
      const { data: pieces, error: piecesErr } = await supabase
        .from('donut_box_pieces')
        .select(`
          id,
          box_type,
          piece_kind,
          stuffing_sauce_name,
          topping_sauce_name
        `)
        .eq('batch_id', batch.id);

      if (piecesErr || !pieces || pieces.length === 0) {
        return {
          batch_id: batch.id,
          batch_number: 1,
          is_receiving_stopped: isReceivingStopped,
          pending_orders_count: 0,
          sizes: [],
        };
      }

      // 4. تجميع القطع بحسب الحجم (عادي وميني)
      const regularPieces = pieces.filter((p: any) => p.box_type === 'regular');
      const miniPieces = pieces.filter((p: any) => p.box_type === 'mini');

      const processSizePieces = (
        sizeType: 'regular' | 'mini',
        typeName: string,
        sizeList: any[]
      ) => {
        const total_pieces = sizeList.length;
        const stuffedList = sizeList.filter((p: any) => p.piece_kind === 'stuffed');
        const toppingOnlyList = sizeList.filter((p: any) => p.piece_kind === 'topping_only');

        // تجميع الحشوات وربطها بالتوبنج
        const stuffingMap = new Map<string, { count: number; toppings: Map<string, number> }>();
        stuffedList.forEach((p: any) => {
          const stName = p.stuffing_sauce_name || 'بدون حشو';
          const topName = p.topping_sauce_name || 'بدون توبنج';
          const existing = stuffingMap.get(stName) || { count: 0, toppings: new Map<string, number>() };
          existing.count += 1;
          existing.toppings.set(topName, (existing.toppings.get(topName) || 0) + 1);
          stuffingMap.set(stName, existing);
        });

        const combos: StuffingCombo[] = Array.from(stuffingMap.entries()).map(([stName, val]) => ({
          stuffing: stName,
          stuffing_count: val.count,
          toppings: Array.from(val.toppings.entries()).map(([topName, count]) => ({
            name: topName,
            count,
          })),
        }));

        // تجميع السادة
        const toppingOnlyMap = new Map<string, number>();
        toppingOnlyList.forEach((p: any) => {
          const topName = p.topping_sauce_name || 'بدون توبنج';
          toppingOnlyMap.set(topName, (toppingOnlyMap.get(topName) || 0) + 1);
        });

        const topping_sauces = Array.from(toppingOnlyMap.entries()).map(([name, count]) => ({
          name,
          count,
        }));

        return {
          size_type: sizeType,
          type_name: typeName,
          total_pieces,
          stuffed: {
            count: stuffedList.length,
            combos,
          },
          topping_only: {
            count: toppingOnlyList.length,
            topping_sauces,
          },
        };
      };

      const sizes = [];
      if (regularPieces.length > 0) {
        sizes.push(processSizePieces('regular', 'عادي (كبير)', regularPieces));
      }
      if (miniPieces.length > 0) {
        sizes.push(processSizePieces('mini', 'ميني دونتس', miniPieces));
      }

      if (sizes.length > 0) {
        return {
          batch_id: batch.id,
          batch_number: 1,
          is_receiving_stopped: isReceivingStopped,
          pending_orders_count: 0,
          sizes,
        };
      }
    }

    return mockDonutBatchState;
  },

  async toggleDonutReceiving(stop: boolean): Promise<boolean> {
    if (isLiveSupabaseConfigured && supabase) {
      const rpcName = stop ? 'donut_stop_receiving' : 'donut_resume_receiving';
      await supabase.rpc(rpcName);
    }
    mockDonutBatchState = {
      ...mockDonutBatchState,
      is_receiving_stopped: stop,
    };
    return stop;
  },

  async finishDonutBatch(batchId: string): Promise<void> {
    if (isLiveSupabaseConfigured && supabase) {
      await supabase.rpc('donut_finish_batch', { p_batch_id: batchId });
    }
    mockDonutBatchState = {
      ...mockDonutBatchState,
      batch_number: mockDonutBatchState.batch_number + 1,
      batch_id: `batch-mock-${mockDonutBatchState.batch_number + 1}`,
    };
  },

  // ========================================================
  // أولاً: شاشة التوبنج (Donut Topping Station)
  // عرض كل أوردر بالبوكسات بنفس شكل شاشة الكاشير
  // ========================================================
  async getDonutToppingOrders(): Promise<DonutToppingOrder[]> {
    if (isLiveSupabaseConfigured && supabase) {
      // على الاتصال الحقيقي: الخطأ يظهر للمستخدم (مع زر إعادة المحاولة) بدل ما
      // نرجع بيانات وهمية فاضية، والنتيجة الفاضية الحقيقية تفضل فاضية.
      const { data: orders, error } = await supabase
          .from('orders')
          .select(`
            id,
            order_number,
            order_type,
            customer_name,
            notes,
            status,
            created_at,
            order_items (
              id,
              item_name,
              donut_type_name,
              pieces,
              status,
              order_item_pieces (
                id,
                piece_no,
                piece_kind,
                injected_at,
                order_item_piece_options (
                  role,
                  option_name
                )
              )
            )
          `)
          // order_status enum = ('active','delivered','cancelled'); 'preparing' is an
          // ITEM status, and sending it here makes PostgREST reject the whole query
          // (22P02), so both donut screens silently fell back to empty mock data.
          .eq('status', 'active')
          .order('created_at', { ascending: true });

        if (error) {
          console.error('Failed to fetch donut topping orders from Supabase:', error);
          throw new Error(error.message);
        }
        {
          const donutOrders: DonutToppingOrder[] = [];

          orders.forEach((ord: any) => {
            const donutItems = (ord.order_items || []).filter(
              (it: any) => it.pieces || it.donut_type_name || (it.order_item_pieces && it.order_item_pieces.length > 0)
            );

            if (donutItems.length === 0) return;

            const boxes: DonutToppingBox[] = donutItems.map((boxItem: any, bIdx: number) => {
              const pieces: DonutToppingPiece[] = (boxItem.order_item_pieces || [])
                .sort((a: any, b: any) => a.piece_no - b.piece_no)
                .map((p: any) => {
                  const opts = p.order_item_piece_options || [];
                  const toppingOpt = opts.find((o: any) => o.role === 'topping');
                  const fillingOpt = opts.find((o: any) => o.role === 'filling');

                  return {
                    id: p.id,
                    piece_number: p.piece_no,
                    injected_at: p.injected_at ?? null,
                    topping_sauce_name: toppingOpt?.option_name || 'توبنج',
                    stuffing_sauce_name: fillingOpt?.option_name || (p.piece_kind === 'stuffed' ? 'محشي' : 'سادة'),
                    is_stuffed: p.piece_kind === 'stuffed',
                  };
                });

              return {
                id: boxItem.id,
                box_number: bIdx + 1,
                pieces_count: boxItem.pieces || pieces.length || 2,
                donut_type: boxItem.donut_type_name === 'ميني' ? 'mini' : boxItem.donut_type_name === 'حشو' ? 'stuffed' : 'regular',
                is_ready: boxItem.status === 'ready',
                pieces,
              };
            });

            const total_pieces = boxes.reduce((sum, b) => sum + b.pieces_count, 0);

            donutOrders.push({
              id: ord.id,
              order_id: ord.id,
              order_daily_number: ord.order_number || 1,
              order_type: ord.order_type,
              order_type_label: ORDER_TYPE_LABELS[ord.order_type] || ord.order_type,
              customer_name: ord.customer_name || undefined,
              notes: ord.notes || undefined,
              status: ord.status === 'active' ? 'pending' : (ord.status as any),
              created_at: ord.created_at,
              boxes,
              total_boxes: boxes.length,
              total_pieces,
            });
          });

          return donutOrders;
        }
    }

    return mockDonutToppingOrdersState.filter((o) => o.status !== 'ready');
  },

  async toggleBoxReady(orderId: string, boxId: string): Promise<void> {
    if (isLiveSupabaseConfigured && supabase) {
      try {
        const { data: cur, error: readErr } = await supabase
          .from('order_items')
          .select('status')
          .eq('id', boxId)
          .maybeSingle();
        if (readErr) throw readErr;
        const makeReady = cur?.status !== 'ready';
        const { error: updErr } = await supabase
          .from('order_items')
          .update(
            makeReady
              ? { status: 'ready', ready_at: new Date().toISOString() }
              : { status: 'preparing', ready_at: null }
          )
          .eq('id', boxId);
        if (updErr) throw updErr;
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('mrdonuts:kitchen-updated'));
        }
        return;
      } catch (err) {
        console.warn('Failed to toggle donut box readiness in Supabase:', err);
      }
    }
    mockDonutToppingOrdersState = mockDonutToppingOrdersState.map((ord) => {
      if (ord.order_id !== orderId && ord.id !== orderId) return ord;

      const updatedBoxes = ord.boxes.map((b) =>
        b.id === boxId ? { ...b, is_ready: !b.is_ready } : b
      );
      const allReady = updatedBoxes.every((b) => b.is_ready);

      return {
        ...ord,
        boxes: updatedBoxes,
        status: allReady ? 'ready' : 'preparing',
      };
    });
    saveStoredKitchen(KITCHEN_STORAGE_KEYS.donutTopping, mockDonutToppingOrdersState);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mrdonuts:kitchen-updated'));
    }
  },

  async finishDonutToppingOrder(orderId: string): Promise<void> {
    if (isLiveSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('order_items')
          .update({ status: 'ready', ready_at: new Date().toISOString() })
          .eq('order_id', orderId);
      } catch (err) {
        console.warn('Failed to update order items status in Supabase:', err);
      }
    }

    mockDonutToppingOrdersState = mockDonutToppingOrdersState.filter(
      (o) => o.id !== orderId && o.order_id !== orderId
    );
    saveStoredKitchen(KITCHEN_STORAGE_KEYS.donutTopping, mockDonutToppingOrdersState);

    // تحديث شاشة البيك أب لجاهزية قسم الدونتس
    pickupService.markDepartmentReady(orderId, 'دونتس');

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mrdonuts:kitchen-updated'));
    }
  },

  // ========================================================
  // ثانياً: شاشة الحقن (Donut Injection Station)
  // تجميع عدد القطع من كل صوص حشو منفصل لكل نوع (ميني / عادي / حشو)
  // ========================================================
  async getDonutInjectionData(pausedAt?: string | null): Promise<DonutInjectionData> {
    const allActiveOrders = await this.getDonutToppingOrders();
    const activeOrders = pausedAt
      ? allActiveOrders.filter(
          (ord) => !ord.created_at || new Date(ord.created_at).getTime() <= new Date(pausedAt).getTime()
        )
      : allActiveOrders;
    const queuedOrdersCount = allActiveOrders.length - activeOrders.length;

    const itemMap = new Map<string, {
      sauce_name: string;
      donut_type: 'regular' | 'mini' | 'stuffed';
      donut_type_label: string;
      count: number;
      pending: number;
    }>();

    let totalPieces = 0;
    let totalStuffed = 0;
    let totalPlain = 0;

    const injectionOrders: DonutInjectionOrder[] = [];

    activeOrders.forEach((ord) => {
      let ordStuffed = 0;
      let ordPlain = 0;
      let ordTotal = 0;
      const ordSauceDetailsMap = new Map<string, { count: number; donut_type: 'regular' | 'mini' | 'stuffed' }>();

      ord.boxes.forEach((box) => {
        box.pieces.forEach((piece) => {
          ordTotal += 1;
          totalPieces += 1;

          const isStuffed = piece.is_stuffed && piece.stuffing_sauce_name && piece.stuffing_sauce_name !== 'سادة';
          const sauce = isStuffed ? piece.stuffing_sauce_name : 'سادة (بدون حشو)';

          if (isStuffed) {
            ordStuffed += 1;
            totalStuffed += 1;
          } else {
            ordPlain += 1;
            totalPlain += 1;
          }

          // تجميع منفصل لكل صوص مع نوع الدونتس (عادي / ميني / حشو) لمنع دمج الميني مع العادي
          const dType = box.donut_type || 'regular';
          const key = `${sauce}__${dType}`;
          const typeLabel =
            dType === 'mini' ? 'ميني' : dType === 'stuffed' ? 'حشو' : 'عادي';

          const existing = itemMap.get(key) || {
            sauce_name: sauce,
            donut_type: dType,
            donut_type_label: typeLabel,
            count: 0,
            pending: 0,
          };
          existing.count += 1;
          if (!piece.injected_at) existing.pending += 1;
          itemMap.set(key, existing);

          // تجميع خاص بالأوردر
          const ordKey = `${sauce}-${dType}`;
          const curOrd = ordSauceDetailsMap.get(ordKey) || { count: 0, donut_type: dType };
          curOrd.count += 1;
          ordSauceDetailsMap.set(ordKey, curOrd);
        });
      });

      injectionOrders.push({
        order_id: ord.order_id,
        order_daily_number: ord.order_daily_number,
        order_type_label: ord.order_type_label,
        customer_name: ord.customer_name,
        created_at: ord.created_at,
        is_injected: !!mockInjectedOrders[ord.order_id],
        stuffed_count: ordStuffed,
        plain_count: ordPlain,
        total_pieces: ordTotal,
        stuffing_details: Array.from(ordSauceDetailsMap.entries()).map(([_, val]) => ({
          sauce_name: _?.split('-')[0] || 'حشو',
          count: val.count,
          donut_type: val.donut_type,
        })),
      });
    });

    const sauce_aggregates: StuffingSauceAggregate[] = Array.from(itemMap.entries()).map(
      ([key, data]) => ({
        key,
        sauce_name: data.sauce_name,
        donut_type: data.donut_type,
        donut_type_label: data.donut_type_label,
        total_pieces: data.count,
        pending_pieces: data.pending,
        regular_pieces: data.donut_type === 'regular' ? data.count : 0,
        mini_pieces: data.donut_type === 'mini' ? data.count : 0,
        stuffed_pieces: data.donut_type === 'stuffed' ? data.count : 0,
        // وضع لايف: مكتمل فقط لو مفيش قطع pending. وضع الموك: العلامة المحلية.
        is_completed:
          !!mockCompletedInjectionSauces[key] ||
          !!mockCompletedInjectionSauces[data.sauce_name] ||
          (data.count > 0 && data.pending === 0),
      })
    );

    // فرز الصوصات: المحشية أولاً ثم السادة، وبالأعلى عدداً أولاً
    sauce_aggregates.sort((a, b) => {
      const aPlain = a.sauce_name.includes('سادة');
      const bPlain = b.sauce_name.includes('سادة');
      if (aPlain && !bPlain) return 1;
      if (!aPlain && bPlain) return -1;
      return b.total_pieces - a.total_pieces;
    });

    return {
      total_pieces: totalPieces,
      total_stuffed: totalStuffed,
      total_plain: totalPlain,
      pending_orders_count: activeOrders.length,
      queued_orders_count: queuedOrdersCount,
      sauce_aggregates,
      orders: injectionOrders,
    };
  },

  async toggleInjectionSauce(sauceKey: string): Promise<void> {
    if (isLiveSupabaseConfigured && supabase) {
      // المفتاح بالشكل sauce__donut_type. الإنجاز في اتجاه واحد فقط (طلب المستخدم):
      // الضغط يعلّم كل القطع الـ pending من المفتاح ده كمحقونة، وأي ضغطة تانية
      // بعد الاكتمال لا تلغي ولا تكرر. القطع الجديدة (injected_at = null) تفضل pending.
      const [sauceName, dType = 'regular'] = sauceKey.split('__');
      const orders = await this.getDonutToppingOrders();
      const matched: { id: string; injected_at?: string | null }[] = [];
      orders.forEach((ord) =>
        ord.boxes.forEach((box) => {
          if ((box.donut_type || 'regular') !== dType) return;
          box.pieces.forEach((p) => {
            if (!p.id) return;
            const isStuffed = p.is_stuffed && p.stuffing_sauce_name && p.stuffing_sauce_name !== 'سادة';
            const pieceSauce = isStuffed ? p.stuffing_sauce_name : 'سادة (بدون حشو)';
            if (pieceSauce === sauceName) matched.push({ id: p.id, injected_at: p.injected_at });
          });
        })
      );
      if (matched.length === 0) return;

      let userId: string | null = null;
      try {
        const raw = typeof window !== 'undefined' ? localStorage.getItem('mrdounts_session') : null;
        userId = raw ? JSON.parse(raw)?.profile?.id ?? null : null;
      } catch {
        userId = null;
      }

      const pending = matched.filter((m) => !m.injected_at);
      if (pending.length === 0) return; // مكتمل بالفعل: الضغط الإضافي لا يغير شيئاً
      const { error: updErr } = await supabase
        .from('order_item_pieces')
        .update({ injected_at: new Date().toISOString(), injected_by: userId })
        .in('id', pending.map((m) => m.id));
      if (updErr) {
        console.error('Failed to persist injection state in Supabase:', updErr);
        throw new Error(updErr.message);
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('mrdonuts:kitchen-updated'));
      }
      return;
    }
    if (!mockCompletedInjectionSauces[sauceKey]) mockCompletedInjectionSauces[sauceKey] = true;
  },

  async toggleInjectionOrder(orderId: string): Promise<void> {
    mockInjectedOrders[orderId] = !mockInjectedOrders[orderId];
  },

  addMockDonutOrder(order: DonutToppingOrder): void {
    mockDonutToppingOrdersState.unshift(order);
    saveStoredKitchen(KITCHEN_STORAGE_KEYS.donutTopping, mockDonutToppingOrdersState);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mrdonuts:kitchen-updated'));
    }
  },

  addMockKitchenItem(dept: 'وافل' | 'مشروبات', item: KitchenItem): void {
    if (dept === 'وافل') {
      mockWaffleState.unshift(item);
      saveStoredKitchen(KITCHEN_STORAGE_KEYS.waffle, mockWaffleState);
    } else {
      mockDrinksState.unshift(item);
      saveStoredKitchen(KITCHEN_STORAGE_KEYS.drinks, mockDrinksState);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mrdonuts:kitchen-updated'));
    }
  },
};
