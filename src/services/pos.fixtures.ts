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
      { id: 'demo-item-1', item_name: 'بوكس عادي', donut_type_name: 'عادي', pieces: 6, quantity: 1, unit_price: 120, extras_total: 0, line_total: 120, status: 'pending', was_modified: false },
      { id: 'demo-item-2', item_name: 'وافل كلاسيك', quantity: 1, unit_price: 50, extras_total: 10, line_total: 60, status: 'pending', was_modified: false, notes: 'صوص زيادة' },
      { id: 'demo-item-3', item_name: 'قهوة', quantity: 2, unit_price: 30, extras_total: 0, line_total: 60, status: 'preparing', was_modified: false },
    ],
    payments: [
      { id: 'demo-pay-1', method_name: 'كاش', is_cash: true, amount: 150 },
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
      { id: 'demo-item-4', item_name: 'بوكس ميني', donut_type_name: 'ميني', pieces: 12, quantity: 1, unit_price: 110, extras_total: 0, line_total: 110, status: 'ready', was_modified: false },
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
    subtotal: 90,
    discount_amount: 0,
    tax_amount: 0,
    delivery_fee: 15,
    total: 105,
    created_at: new Date(Date.now() - 3 * 3600000).toISOString(),
    items: [
      { id: 'demo-item-6', item_name: 'وافل نوتيلا', quantity: 1, unit_price: 65, extras_total: 25, line_total: 90, status: 'ready', was_modified: true },
    ],
    payments: [{ id: 'demo-pay-4', method_name: 'كاش', is_cash: true, amount: 105 }],
  },
];

export const demoShiftReport = {
  shift_id: SHIFT,
  status: 'open',
  opened_at: new Date(Date.now() - 8 * 3600000).toISOString(),
  opening_cash: 200,
  orders: { count: 47, subtotal: 4120, discounts: 130, tax: 0, delivery_fees: 90, net_total: 4080 },
  cancelled_orders: 2,
  orders_by_type: [
    { type: 'takeaway', count: 26, total: 2310 },
    { type: 'dine_in', count: 15, total: 1290 },
    { type: 'delivery', count: 6, total: 480 },
  ],
  payments_by_method: [
    { method: 'كاش', is_cash: true, total: 1980, count: 22 },
    { method: 'فيزا', is_cash: false, total: 1350, count: 15 },
    { method: 'إنستاباي', is_cash: false, total: 750, count: 10 },
  ],
  movements_in: 300,
  movements_out: 150,
  expected_cash: null,
  counted_cash: null,
  cash_difference: null,
};

export const demoItemSales = {
  donut_boxes: [
    { name: 'بوكس عادي 6 قطعة', pieces: 6, boxes: 18, revenue: 2160 },
    { name: 'بوكس ميني 12 قطعة', pieces: 12, boxes: 9, revenue: 990 },
    { name: 'بوكس محشي 4 قطع', pieces: 4, boxes: 5, revenue: 460 },
  ],
  donut_pieces_by_sauce: [
    { sauce: 'شوكولاتة', role: 'topping', pieces: 84 },
    { sauce: 'لوتس', role: 'topping', pieces: 52 },
    { sauce: 'نوتيلا', role: 'stuffing', pieces: 38 },
    { sauce: 'كراميل', role: 'stuffing', pieces: 21 },
  ],
  items: [
    { department: 'وافل', name: 'وافل كلاسيك', size: null, quantity: 21, revenue: 1050 },
    { department: 'وافل', name: 'وافل نوتيلا', size: null, quantity: 12, revenue: 780 },
    { department: 'مشروبات', name: 'قهوة', size: 'وسط', quantity: 33, revenue: 990 },
    { department: 'مشروبات', name: 'ميلك شيك فراولة', size: null, quantity: 8, revenue: 440 },
  ],
};

export const demoSauceConsumption = [
  { ingredient: 'شوكولاتة', unit: 'جرام', total_consumed: 640, breakdown: [
    { target: 'عادي', units: 84, consumed: 420 },
    { target: 'وافل كلاسيك', units: 21, consumed: 210 },
    { target: 'ميني', units: 2, consumed: 10 },
  ]},
  { ingredient: 'نوتيلا', unit: 'جرام', total_consumed: 490, breakdown: [
    { target: 'محشي', units: 38, consumed: 380 },
    { target: 'وافل نوتيلا', units: 12, consumed: 110 },
  ]},
  { ingredient: 'لوتس', unit: 'جرام', total_consumed: 260, breakdown: [
    { target: 'عادي', units: 52, consumed: 260 },
  ]},
  { ingredient: 'كراميل', unit: 'جرام', total_consumed: 105, breakdown: [
    { target: 'محشي', units: 21, consumed: 105 },
  ]},
];

export const demoRecipes = [
  {
    id: 'demo-recipe-1', target_type: 'donut_type', donut_type_id: 'demo-dt-1', target_name: 'عادي', is_active: true,
    ingredients: [
      { ingredient_name: 'شوكولاتة', quantity: 5, unit: 'جرام', per_unit: 'piece' },
      { ingredient_name: 'لوتس', quantity: 5, unit: 'جرام', per_unit: 'piece' },
    ],
  },
  {
    id: 'demo-recipe-2', target_type: 'menu_item', menu_item_id: 'demo-mi-1', target_name: 'وافل كلاسيك', is_active: true,
    ingredients: [{ ingredient_name: 'شوكولاتة', quantity: 10, unit: 'جرام', per_unit: 'item' }],
  },
];
