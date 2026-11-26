import { create } from 'zustand';
import { CartItem, OrderType, OrderCustomerInfo, SplitPaymentItem } from '@/types/order';

interface CartState {
  items: CartItem[];
  orderType: OrderType;
  customer: OrderCustomerInfo | null;
  discountType: 'none' | 'fixed' | 'percentage';
  discountValue: number;
  taxEnabled: boolean;
  taxRate: number; // مثلاً 14%
  payments: SplitPaymentItem[];

  // إجراءات
  setOrderType: (type: OrderType) => void;
  setCustomer: (customer: OrderCustomerInfo | null) => void;
  setDiscount: (type: 'none' | 'fixed' | 'percentage', value: number) => void;
  addItem: (item: CartItem) => void;
  removeItem: (cartId: string) => void;
  updateQuantity: (cartId: string, quantity: number) => void;
  addPayment: (payment: SplitPaymentItem) => void;
  removePayment: (id: string) => void;
  clearCart: () => void;

  // الحسابات
  getSubtotal: () => number;
  getDiscountAmount: () => number;
  getTaxAmount: () => number;
  getDeliveryFee: () => number;
  getTotal: () => number;
  getRemainingBalance: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  orderType: 'takeaway',
  customer: null,
  discountType: 'none',
  discountValue: 0,
  taxEnabled: false,
  taxRate: 14,
  payments: [],

  setOrderType: (orderType) => set({ orderType }),
  setCustomer: (customer) => set({ customer }),
  setDiscount: (discountType, discountValue) => set({ discountType, discountValue }),

  addItem: (item) => {
    set((state) => ({ items: [...state.items, item] }));
  },

  removeItem: (cartId) => {
    set((state) => ({ items: state.items.filter((i) => i.cart_id !== cartId) }));
  },

  updateQuantity: (cartId, quantity) => {
    if (quantity <= 0) {
      get().removeItem(cartId);
      return;
    }
    set((state) => ({
      items: state.items.map((i) =>
        i.cart_id === cartId
          ? {
              ...i,
              quantity,
              line_total:
                (i.unit_price +
                  (i.options?.reduce((sum, opt) => sum + opt.extra_price, 0) || 0) +
                  (i.donut_pieces?.reduce((sum, pc) => sum + (pc.extra_fee || 0), 0) || 0)) *
                quantity,
            }
          : i
      ),
    }));
  },

  addPayment: (payment) => {
    set((state) => ({ payments: [...state.payments, payment] }));
  },

  removePayment: (id) => {
    set((state) => ({ payments: state.payments.filter((p) => p.id !== id) }));
  },

  clearCart: () => {
    set({
      items: [],
      customer: null,
      discountType: 'none',
      discountValue: 0,
      payments: [],
    });
  },

  getSubtotal: () => {
    return get().items.reduce((sum, item) => sum + item.line_total, 0);
  },

  getDiscountAmount: () => {
    const subtotal = get().getSubtotal();
    const { discountType, discountValue } = get();
    if (discountType === 'fixed') {
      return Math.min(discountValue, subtotal);
    }
    if (discountType === 'percentage') {
      return (subtotal * Math.min(discountValue, 100)) / 100;
    }
    return 0;
  },

  getDeliveryFee: () => {
    const { orderType, customer } = get();
    if (orderType === 'delivery') {
      return customer?.delivery_fee || 0;
    }
    return 0;
  },

  getTaxAmount: () => {
    const { taxEnabled, taxRate } = get();
    if (!taxEnabled) return 0;
    const taxableBase = Math.max(0, get().getSubtotal() - get().getDiscountAmount());
    return (taxableBase * taxRate) / 100;
  },

  getTotal: () => {
    const subtotal = get().getSubtotal();
    const discount = get().getDiscountAmount();
    const tax = get().getTaxAmount();
    const delivery = get().getDeliveryFee();
    return Math.max(0, subtotal - discount + tax + delivery);
  },

  getRemainingBalance: () => {
    const total = get().getTotal();
    const paid = get().payments.reduce((sum, p) => sum + p.amount, 0);
    return Math.max(0, total - paid);
  },
}));

export function useCart() {
  const store = useCartStore();
  return {
    items: store.items,
    orderType: store.orderType,
    customer: store.customer,
    discountType: store.discountType,
    discountValue: store.discountValue,
    payments: store.payments,
    setOrderType: store.setOrderType,
    setCustomer: store.setCustomer,
    setDiscount: store.setDiscount,
    addItem: store.addItem,
    removeItem: store.removeItem,
    updateQuantity: store.updateQuantity,
    addPayment: store.addPayment,
    removePayment: store.removePayment,
    clearCart: store.clearCart,
    subtotal: store.getSubtotal(),
    discountAmount: store.getDiscountAmount(),
    deliveryFee: store.getDeliveryFee(),
    taxAmount: store.getTaxAmount(),
    total: store.getTotal(),
    remainingBalance: store.getRemainingBalance(),
  };
}

