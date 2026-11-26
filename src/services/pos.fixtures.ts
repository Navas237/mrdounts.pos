// بيانات تجريبية للعرض فقط — تُستخدم حصرياً عندما لا يوجد اتصال Supabase
// وعند ضبط VITE_POS_DEMO=1 صراحةً (لقطات مراجعة واجهة). لا تصل لأي بيانات حقيقية.
import type { OrderListItem } from './pos.service';

const SHIFT = 'demo-shift-0001';

export const demoOrders: OrderListItem[] = [
  {
    id: 'demo-order-0001',
    order_number: 1042,
    shift_id: SHIFT,
    order_type: 'takeaway',
    status: 'active',
    customer_name: 'كريم سامي',
    subtotal: 240,
    discount_amount: 0,
    tax_amount: 0,
    delivery_fee: 0,
    total: 240,
    created_at: new Date(Date.now() - 18 * 60000).toISOString(),
    items: [
      { id: 'demo-item-1', item_name: 'بوكس 6 عادي', donut_type_name: 'عادي', pieces: 6, quantity: 1, unit_price: 120, extras_total: 0, line_total: 120, status: 'pending', was_modified: false,
        piece_details: [1, 2, 3, 4].map((n) => ({ piece_no: n, kind: 'topping_only' as const, filling: null, topping: 'شوكولاتة' })).concat([5, 6].map((n) => ({ piece_no: n, kind: 'topping_only' as const, filling: null, topping: 'لوتس' }))) },
      { id: 'demo-item-2', item_name: 'وافل كلاسيك', quantity: 1, unit_price: 50, extras_total: 10, line_total: 60, status: 'pending', was_modified: false, notes: 'صوص زيادة', options: [{ option_name: 'شوكولاتة' }, { option_name: 'موز' }] },
      { id: 'demo-item-3', item_name: 'قهوة', quantity: 2, unit_price: 30, extras_total: 0, line_total: 60, status: 'preparing', was_modified: false },
    ],
    payments: [
      { id: 'demo-pay-1', method_name: 'نقدي', is_cash: true, amount: 150 },
      { id: 'demo-pay-2', method_name: 'فيزا', is_cash: false, amount: 90 },
    ],
  },
  {
    id: 'demo-order-0002',
    order_number: 1041,
    shift_id: SHIFT,
    order_type: 'dine_in',
    status: 'active',
    subtotal: 165,
    discount_amount: 15,
    tax_amount: 0,
    delivery_fee: 0,
    total: 150,
    created_at: new Date(Date.now() - 52 * 60000).toISOString(),
    items: [
      { id: 'demo-item-4', item_name: 'بوكس 12 ميني', donut_type_name: 'ميني', pieces: 12, quantity: 1, unit_price: 110, extras_total: 0, line_total: 110, status: 'ready', was_modified: false,
        piece_details: Array.from({ length: 12 }, (_, i) => ({ piece_no: i + 1, kind: 'topping_only' as const, filling: null, topping: i < 8 ? 'شوكولاتة' : 'سكر وقرفة' })) },
      { id: 'demo-item-5', item_name: 'ميلك شيك فراولة', quantity: 1, unit_price: 55, extras_total: 0, line_total: 55, status: 'ready', was_modified: false },
    ],
    payments: [{ id: 'demo-pay-3', method_name: 'إنستاباي', is_cash: false, amount: 150 }],
  },
  {
    id: 'demo-order-0003',
    order_number: 1039,
    shift_id: SHIFT,
    order_type: 'delivery',
    status: 'delivered',
    customer_name: 'منى',
    customer_phone: '01000000000',
    address_snapshot: { address: '12 شارع الجمهورية، برج النور، الدور 4 شقة 8، أمام صيدلية العزبي' },
    delivery_zone_name: 'سيدي بشر',
    subtotal: 230,
    discount_amount: 0,
    tax_amount: 0,
    delivery_fee: 15,
    total: 245,
    created_at: new Date(Date.now() - 3 * 3600000).toISOString(),
    items: [
      { id: 'demo-item-6', item_name: 'وافل نوتيلا', quantity: 1, unit_price: 65, extras_total: 25, line_total: 90, status: 'ready', was_modified: true, options: [{ option_name: 'نوتيلا' }, { option_name: 'فراولة' }] },
      { id: 'demo-item-7', item_name: 'بوكس 4 محشي', donut_type_name: 'محشي', pieces: 4, quantity: 1, unit_price: 140, extras_total: 0, line_total: 140, status: 'ready', was_modified: false,
        piece_details: [
          { piece_no: 1, kind: 'stuffed' as const, filling: 'نوتيلا', topping: 'شوكولاتة' },
          { piece_no: 2, kind: 'stuffed' as const, filling: 'نوتيلا', topping: 'شوكولاتة' },
          { piece_no: 3, kind: 'stuffed' as const, filling: 'فراولة', topping: 'لوتس' },
          { piece_no: 4, kind: 'stuffed' as const, filling: 'فراولة', topping: 'لوتس' },
        ] },
    ],
    payments: [{ id: 'demo-pay-4', method_name: 'نقدي', is_cash: true, amount: 250 }],
  },
];

export const demoShiftReport = {
  shift_id: SHIFT,
  status: 'open',
  opened_at: new Date(Date.now() - 8 * 3600000).toISOString(),
  opening_cash: 500,
  orders: { count: 168, subtotal: 21500, discounts: 650, tax: 0, delivery_fees: 450, net_total: 21300 },
  cancelled_orders: 3,
  orders_by_type: [
    { type: 'delivery', count: 28, total: 2900 },
    { type: 'dine_in', count: 45, total: 5700 },
    { type: 'takeaway', count: 63, total: 8400 },
    { type: 'pickup', count: 32, total: 4300 },
  ],
  payments_by_method: [
    { method: 'نقدي', is_cash: true, total: 8800, count: 58 },
    { method: 'فيزا', is_cash: false, total: 6200, count: 42 },
    { method: 'فودافون كاش', is_cash: false, total: 3800, count: 38 },
    { method: 'إنستاباي', is_cash: false, total: 2500, count: 30 },
  ],
  cash_change: 0,
  net_cash: 8800,
  movements_in: 800,
  movements_out: 400,
  expected_cash: null,
  counted_cash: null,
  cash_difference: null,
};

export const demoItemSales = {
  // الأرقام متوافقة مع demoShiftReport: إيراد الأصناف الكلي 21,500 = الإجمالي قبل الخصم
  donut_boxes: [
    { name: 'بوكس عادي 6 قطعة', pieces: 6, boxes: 40, revenue: 4800 },
    { name: 'بوكس ميني 12 قطعة', pieces: 12, boxes: 25, revenue: 2750 },
    { name: 'بوكس محشي 4 قطع', pieces: 4, boxes: 30, revenue: 2760 },
  ],
  // قطع الدونتس حسب النوع — مشتقة من البوكسات أعلاه: 40×6 + 25×12 + 30×4 = 660 قطعة
  donut_pieces_by_type: [
    { name: 'عادي', pieces: 240 },
    { name: 'ميني', pieces: 300 },
    { name: 'محشي', pieces: 120 },
  ],
  items: [
    { department: 'وافل', name: 'وافل كلاسيك', size: null, quantity: 45, revenue: 2250 },
    { department: 'وافل', name: 'وافل نوتيلا', size: null, quantity: 38, revenue: 2470 },
    { department: 'مشروبات', name: 'قهوة', size: 'وسط', quantity: 60, revenue: 1800 },
    { department: 'مشروبات', name: 'إيس لاتيه', size: null, quantity: 45, revenue: 1800 },
    { department: 'مشروبات', name: 'ميلك شيك فراولة', size: null, quantity: 38, revenue: 2090 },
    { department: 'مشروبات', name: 'هوت شوكولات', size: null, quantity: 26, revenue: 780 },
  ],
};

export const demoPaymentMethods = [
  { id: 'demo-pm-1', name: 'نقدي', is_cash: true, sort_order: 1, is_active: true },
  { id: 'demo-pm-2', name: 'فيزا', is_cash: false, sort_order: 2, is_active: true },
  { id: 'demo-pm-3', name: 'إنستاباي', is_cash: false, sort_order: 3, is_active: true },
  { id: 'demo-pm-4', name: 'فودافون كاش', is_cash: false, sort_order: 4, is_active: true },
];

// الاستهلاك محسوب من الرسبي التجريبي أدناه × الصوص المختار فعلياً لكل قطعة/صنف:
// عادي 240 قطعة: 140 شوكولاتة + 60 لوتس + 40 سادة — ميني 300: 180 لوتس + 120 شوكولاتة
// محشي 120: 80 نوتيلا + 30 كراميل + 10 فراولة (فراولة بدون كمية في الرسبي)
// وافل كلاسيك 45: 30 بشوكولاتة + 15 بلوتس — وافل نوتيلا 38 كلها نوتيلا — إيس لاتيه 45: 25 بكراميل
export const demoSauceConsumption = {
  consumption: [
  { ingredient: 'نوتيلا', unit: 'جرام', total_consumed: 1400, breakdown: [
    { target: 'محشي', kind: 'option', units: 80, consumed: 640 },
    { target: 'وافل نوتيلا', kind: 'option', units: 38, consumed: 760 },
  ]},
  { ingredient: 'شوكولاتة', unit: 'جرام', total_consumed: 1170, breakdown: [
    { target: 'وافل كلاسيك', kind: 'option', units: 30, consumed: 450 },
    { target: 'عادي', kind: 'option', units: 140, consumed: 420 },
    { target: 'ميني', kind: 'option', units: 120, consumed: 300 },
  ]},
  { ingredient: 'لوتس', unit: 'جرام', total_consumed: 690, breakdown: [
    { target: 'ميني', kind: 'option', units: 180, consumed: 360 },
    { target: 'وافل كلاسيك', kind: 'option', units: 15, consumed: 180 },
    { target: 'عادي', kind: 'option', units: 60, consumed: 150 },
  ]},
  { ingredient: 'كراميل', unit: 'مل', total_consumed: 430, breakdown: [
    { target: 'إيس لاتيه', kind: 'option', units: 25, consumed: 250 },
    { target: 'محشي', kind: 'option', units: 30, consumed: 180 },
  ]},
  ],
  missing_recipes: ['قهوة', 'ميلك شيك فراولة'],
  unmapped_options: ['فراولة (حشوة محشي)'],
};

export const demoRecipes = [
  {
    id: 'demo-recipe-1', target_type: 'donut_type', donut_type_id: 'demo-dt-1', target_name: 'عادي', is_active: true,
    ingredients: [
      { ingredient_name: 'شوكولاتة', quantity: 3, unit: 'جرام', per_unit: 'piece', option_name: 'شوكولاتة', role: 'topping' },
      { ingredient_name: 'لوتس', quantity: 2.5, unit: 'جرام', per_unit: 'piece', option_name: 'لوتس', role: 'topping' },
    ],
  },
  {
    id: 'demo-recipe-2', target_type: 'donut_type', donut_type_id: 'demo-dt-2', target_name: 'ميني', is_active: true,
    ingredients: [
      { ingredient_name: 'لوتس', quantity: 2, unit: 'جرام', per_unit: 'piece', option_name: 'لوتس', role: 'topping' },
      { ingredient_name: 'شوكولاتة', quantity: 2.5, unit: 'جرام', per_unit: 'piece', option_name: 'شوكولاتة', role: 'topping' },
    ],
  },
  {
    id: 'demo-recipe-3', target_type: 'donut_type', donut_type_id: 'demo-dt-3', target_name: 'محشي', is_active: true,
    ingredients: [
      { ingredient_name: 'نوتيلا', quantity: 8, unit: 'جرام', per_unit: 'piece', option_name: 'نوتيلا', role: 'filling' },
      { ingredient_name: 'كراميل', quantity: 6, unit: 'مل', per_unit: 'piece', option_name: 'كراميل', role: 'filling' },
    ],
  },
  {
    id: 'demo-recipe-4', target_type: 'menu_item', menu_item_id: 'demo-mi-1', target_name: 'وافل كلاسيك', department_name: 'وافل', is_active: true,
    ingredients: [
      { ingredient_name: 'شوكولاتة', quantity: 15, unit: 'جرام', per_unit: 'item', option_name: 'شوكولاتة', role: null },
      { ingredient_name: 'لوتس', quantity: 12, unit: 'جرام', per_unit: 'item', option_name: 'لوتس', role: null },
    ],
  },
  {
    id: 'demo-recipe-5', target_type: 'menu_item', menu_item_id: 'demo-mi-2', target_name: 'وافل نوتيلا', department_name: 'وافل', is_active: true,
    ingredients: [{ ingredient_name: 'نوتيلا', quantity: 20, unit: 'جرام', per_unit: 'item', option_name: 'نوتيلا', role: null }],
  },
  {
    id: 'demo-recipe-6', target_type: 'menu_item', menu_item_id: 'demo-mi-3', target_name: 'إيس لاتيه', department_name: 'مشروبات', is_active: true,
    ingredients: [{ ingredient_name: 'كراميل', quantity: 10, unit: 'مل', per_unit: 'item', option_name: 'كراميل', role: null }],
  },
];

// الصوصات المتاحة لكل صنف في محرر الرسبي (وضع العرض) — في التشغيل الحقيقي تُجلب
// من قوائم الخيارات المربوطة بالصنف/النوع
export const demoTargetOptions: Record<string, Array<{ option_name: string; role: 'filling' | 'topping' | null }>> = {
  'demo-dt-1': [
    { option_name: 'شوكولاتة', role: 'topping' }, { option_name: 'لوتس', role: 'topping' },
    { option_name: 'كراميل', role: 'topping' }, { option_name: 'فراولة', role: 'topping' },
  ],
  'demo-dt-2': [
    { option_name: 'شوكولاتة', role: 'topping' }, { option_name: 'لوتس', role: 'topping' },
    { option_name: 'فراولة', role: 'topping' },
  ],
  'demo-dt-3': [
    { option_name: 'نوتيلا', role: 'filling' }, { option_name: 'كراميل', role: 'filling' },
    { option_name: 'فراولة', role: 'filling' }, { option_name: 'لوتس', role: 'filling' },
  ],
  'demo-mi-1': [
    { option_name: 'شوكولاتة', role: null }, { option_name: 'لوتس', role: null },
    { option_name: 'كراميل', role: null }, { option_name: 'مكسرات', role: null },
  ],
  'demo-mi-2': [{ option_name: 'نوتيلا', role: null }, { option_name: 'مكسرات', role: null }],
  'demo-mi-3': [{ option_name: 'كراميل', role: null }, { option_name: 'فانيليا', role: null }],
};

export interface DemoZone { id: string; name: string; fee: number; sort_order: number; is_active: boolean }
export const demoZones: DemoZone[] = [
  { id: 'demo-zone-1', name: 'سيدي بشر', fee: 15, sort_order: 1, is_active: true },
  { id: 'demo-zone-2', name: 'سموحة', fee: 20, sort_order: 2, is_active: true },
  { id: 'demo-zone-3', name: 'ميامي', fee: 25, sort_order: 3, is_active: true },
  { id: 'demo-zone-4', name: 'المنتزه', fee: 30, sort_order: 4, is_active: true },
  { id: 'demo-zone-5', name: 'العجمي', fee: 40, sort_order: 5, is_active: true },
  { id: 'demo-zone-6', name: 'سان ستيفانو', fee: 35, sort_order: 6, is_active: true },
  { id: 'demo-zone-7', name: 'كفر عبده', fee: 25, sort_order: 7, is_active: true },
  { id: 'demo-zone-8', name: 'محطة الرمل', fee: 30, sort_order: 8, is_active: true },
];

export const demoCustomerByPhone: Record<string, any> = {
  '01000000000': {
    id: 'demo-cust-1', name: 'منى', phone: '01000000000',
    addresses: [
      { id: 'demo-addr-1', label: null, address: '12 شارع الجمهورية، برج النور، الدور 4 شقة 8، أمام صيدلية العزبي', landmark: null, is_default: true, zone_id: 'demo-zone-1', zone_name: 'سيدي بشر', zone_fee: 15 },
      { id: 'demo-addr-2', label: null, address: '5 شارع سموحة الرئيسي، عمارة 3 شقة 2', landmark: null, is_default: false, zone_id: 'demo-zone-2', zone_name: 'سموحة', zone_fee: 20 },
    ],
  },
};
