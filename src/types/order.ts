import { OrderType } from './database';
export type { OrderType };

export interface CartOption {
  option_id: string;
  name: string;
  extra_price: number;
}

export interface DonutPieceItem {
  piece_number: number;
  piece_type: 'stuffed' | 'topping_only';
  stuffing_sauce_id?: string;
  stuffing_sauce_name?: string;
  topping_sauce_id?: string;
  topping_sauce_name?: string;
  extra_fee: number;
}

export interface CartItem {
  cart_id: string; // unique ID in cart
  department_id: string;
  department_name: string;
  is_donut_box: boolean;
  
  // لجميع الأصناف العادية (وافل / مشروبات)
  item_id?: string;
  item_name?: string;
  size_id?: string;
  size_name?: string;
  unit_price: number;
  quantity: number;
  options: CartOption[];
  notes?: string;

  // لبنية بوكس الدونتس الخاصة (عادي وميني وحشو)
  donut_type?: 'regular' | 'mini' | 'stuffed';
  donut_pieces_count?: number;
  donut_pieces?: DonutPieceItem[];

  line_total: number;
}

export interface SplitPaymentItem {
  id: string;
  method_name: string;
  is_cash: boolean;
  amount: number;
}

export interface OrderCustomerInfo {
  phone: string;
  name: string;
  address?: string;
  delivery_zone?: string;
  delivery_zone_id?: string;
  delivery_fee: number;
}

export interface OrderDraft {
  order_type: OrderType;
  customer?: OrderCustomerInfo;
  items: CartItem[];
  discount_type: 'none' | 'fixed' | 'percentage';
  discount_value: number;
  tax_rate: number;
  payments: SplitPaymentItem[];
}
