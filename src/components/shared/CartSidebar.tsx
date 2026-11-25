import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCart } from '@/hooks/useCart';
import { formatCurrency } from '@/utils/formatters';
import { customerService } from '@/services/customer.service';
import { orderService } from '@/services/order.service';
import {
  Trash2,
  Plus,
  Minus,
  ShoppingCart,
  Phone,
  User,
  CreditCard,
  Percent,
  MapPin,
  Check,
  Utensils,
  ShoppingBag,
  Bike,
  Store,
  X,
} from 'lucide-react';
import { OrderType } from '@/types/database';

interface OrderTypeOption {
  type: OrderType;
  label: string;
  icon: React.ElementType;
}

const ORDER_TYPES: OrderTypeOption[] = [
  { type: 'takeaway', label: 'تيك أواي', icon: ShoppingBag },
  { type: 'dine_in', label: 'صالة', icon: Utensils },
  { type: 'delivery', label: 'ديليفري', icon: Bike },
  { type: 'pickup', label: 'استلام', icon: Store },
];

interface CartSidebarProps {
  onClose?: () => void;
}

export const CartSidebar: React.FC<CartSidebarProps> = ({ onClose }) => {
  const {
    items,
    orderType,
    customer,
    discountType,
    discountValue,
    subtotal,
    discountAmount,
    deliveryFee,
    taxAmount,
    total,
    setOrderType,
    setCustomer,
    setDiscount,
    removeItem,
    updateQuantity,
    clearCart,
    addPayment,
  } = useCart();

  const queryClient = useQueryClient();

  const [phoneInput, setPhoneInput] = useState('');
  const [showDiscountInput, setShowDiscountInput] = useState(false);
  const [discountValInput, setDiscountValInput] = useState(10);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [createdOrderNumber, setCreatedOrderNumber] = useState<number | null>(null);

  // البحث السريع عن العميل
  const handlePhoneChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPhoneInput(val);
    if (val.length >= 10) {
      const found = await customerService.findCustomerByPhone(val);
      if (found) {
        setCustomer({
          phone: found.phone,
          name: found.name,
          address: found.default_address,
          delivery_fee: 20,
        });
      } else {
        setCustomer({
          phone: val,
          name: 'عميل جديد',
          delivery_fee: 20,
        });
      }
    }
  };

  const handleApplyDiscount = (type: 'percentage' | 'fixed') => {
    setDiscount(type, Number(discountValInput));
    setShowDiscountInput(false);
  };

  const handleCheckout = async () => {
    setIsSubmitting(true);
    setCheckoutError(null);
    try {
      const paymentItem = {
        id: `pay-${Date.now()}`,
        method_name: 'نقدي (كاش)',
        is_cash: true,
        amount: total,
      };
      addPayment(paymentItem);

      const result = await orderService.createOrder({
        orderType,
        customerName: customer?.name,
        customerPhone: customer?.phone,
        customerAddress: customer?.address,
        subtotal,
        discountType: discountType || 'none',
        discountValue,
        discountAmount,
        taxRate: 14,
        taxAmount,
        deliveryFee,
        total,
        items,
        payments: [paymentItem],
      });

      setCreatedOrderNumber(result.order_number || 1);
      setIsSuccessModalOpen(true);

      queryClient.invalidateQueries({ queryKey: ['pickup'] });
      queryClient.invalidateQueries({ queryKey: ['shift'] });
      queryClient.invalidateQueries({ queryKey: ['kitchen'] });
    } catch (err: any) {
      setCheckoutError(err.message || 'حدث خطأ أثناء حفظ الأوردر');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-line bg-surface p-3 sm:p-4 flex flex-col justify-between h-full min-h-[560px]">
      <div className="space-y-3">
        
        {/* هيدر السلة */}
        <div className="flex items-center justify-between pb-2 border-b border-line">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-brand-700" />
            <h2 className="font-bold text-sm text-ink">سلة الأوردر والحساب</h2>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors"
              aria-label="إغلاق السلة"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* 1. نوع الأوردر بنمط Segmented Control هندسي ونظيف */}
        <div className="grid grid-cols-4 gap-1 p-0.5 rounded-lg bg-surface-2 border border-line">
          {ORDER_TYPES.map((t) => {
            const Icon = t.icon;
            const isSelected = orderType === t.type;
            return (
              <button
                key={t.type}
                type="button"
                onClick={() => setOrderType(t.type)}
                className={`py-1.5 px-1 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1 ${
                  isSelected
                    ? 'bg-brand-700 text-white shadow-2xs'
                    : 'text-ink-muted hover:text-ink hover:bg-surface'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="whitespace-nowrap">{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* 2. بيانات العميل */}
        <div className="space-y-1.5">
          <div className="relative flex items-center rounded-lg border border-line bg-surface focus-within:border-brand-700 transition-colors">
            <div className="pr-2.5 text-ink-muted">
              <Phone className="w-3.5 h-3.5" />
            </div>
            <input
              type="text"
              value={phoneInput}
              onChange={handlePhoneChange}
              placeholder="رقم هاتف العميل (010...)"
              dir="ltr"
              className="w-full py-1.5 px-2 text-xs bg-transparent focus:outline-none font-medium text-ink placeholder:text-ink-dim"
            />
          </div>

          {customer && (
            <div className="p-2 rounded-lg bg-surface-2 border border-line text-xs space-y-0.5">
              <div className="flex items-center justify-between font-bold text-ink">
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3 text-brand-700" />
                  {customer.name}
                </span>
                <span className="text-xs text-ink-muted font-mono font-bold" dir="ltr">
                  {customer.phone}
                </span>
              </div>
              {customer.address && (
                <div className="text-xs text-ink-muted flex items-center gap-1 font-medium">
                  <MapPin className="w-3 h-3 text-brand-700 shrink-0" />
                  <span className="truncate">{customer.address}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 3. قائمة الأصناف في السلة */}
        <div className="border-t border-line pt-2">
          <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-ink mb-1.5">
            <span>الأصناف ({items.length})</span>
            {items.length > 0 && (
              <button
                type="button"
                onClick={clearCart}
                className="text-xs text-rose-600 font-bold hover:underline"
              >
                تفريغ
              </button>
            )}
          </div>

          <div className="max-h-[240px] overflow-y-auto space-y-1.5 pr-0.5 no-scrollbar">
            {items.length === 0 ? (
              <div className="py-8 text-center rounded-lg border border-dashed border-line bg-surface-2/30 p-3">
                <div className="text-xs sm:text-sm font-bold text-ink-muted">السلة فارغة</div>
                <div className="text-xs text-ink-dim mt-1 font-medium">
                  اختر حجم بوكس الدونتس أو صنف الوافل والمشروبات
                </div>
              </div>
            ) : (
              items.map((item) => {
                // تجميع قطع الدونتس المتشابهة لتجنب تكرار 6 فقرات نصية مشوهة
                const groupedPieces: Record<string, { count: number; desc: string }> = {};
                if (item.is_donut_box && item.donut_pieces) {
                  item.donut_pieces.forEach((p) => {
                    const desc =
                      p.piece_type === 'stuffed'
                        ? `${p.topping_sauce_name || 'بدون'} (حشو ${p.stuffing_sauce_name || '—'})`
                        : `${p.topping_sauce_name || 'توبنج فقط'}`;
                    if (!groupedPieces[desc]) {
                      groupedPieces[desc] = { count: 0, desc };
                    }
                    groupedPieces[desc].count += 1;
                  });
                }

                return (
                  <div
                    key={item.cart_id}
                    className="p-2.5 rounded-lg border border-line bg-surface text-xs space-y-1"
                  >
                    <div className="flex items-start justify-between font-bold text-ink gap-2">
                      <span className="leading-snug text-xs sm:text-sm font-bold">
                        {item.is_donut_box
                          ? `بوكس دونتس ${item.donut_pieces_count} قطع (${
                              item.donut_type === 'mini' ? 'ميني' : item.donut_type === 'stuffed' ? 'حشو' : 'عادي'
                            })`
                          : `${item.item_name} ${item.size_name ? `(${item.size_name})` : ''}`}
                      </span>
                      <span className="font-extrabold text-xs sm:text-sm font-mono shrink-0 text-brand-700">
                        {formatCurrency(item.line_total)}
                      </span>
                    </div>

                    {/* تفاصيل بوكس الدونتس المجمعة بنظافة */}
                    {item.is_donut_box && (
                      <div className="p-1.5 rounded bg-surface-2 text-xs text-ink-muted space-y-0.5 font-medium">
                        {Object.values(groupedPieces).map((g, gIdx) => (
                          <div key={gIdx} className="flex items-center gap-1">
                            <span className="font-mono font-bold text-ink">{g.count}×</span>
                            <span>{g.desc}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* تفاصيل إضافات الأصناف الأخرى */}
                    {!item.is_donut_box && item.options?.length > 0 && (
                      <div className="text-xs text-ink-muted font-medium">
                        + {item.options.map((o) => o.name).join('، ')}
                      </div>
                    )}

                    {/* أزرار الكمية والحذف */}
                    <div className="flex items-center justify-between pt-1 border-t border-line/60">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.cart_id, item.quantity - 1)}
                          className="w-5 h-5 rounded border border-line bg-surface hover:bg-surface-2 text-ink flex items-center justify-center transition-colors"
                        >
                          <Minus className="w-2.5 h-2.5" />
                        </button>
                        <span className="w-5 text-center font-bold text-xs font-mono">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.cart_id, item.quantity + 1)}
                          className="w-5 h-5 rounded border border-line bg-surface hover:bg-surface-2 text-ink flex items-center justify-center transition-colors"
                        >
                          <Plus className="w-2.5 h-2.5" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeItem(item.cart_id)}
                        className="text-ink-dim hover:text-rose-600 transition-colors p-0.5"
                        title="حذف"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* 4. الحسابات وزر الدفع */}
      <div className="pt-2.5 border-t border-line space-y-2">
        
        {/* إضافة خصم */}
        <div className="flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => setShowDiscountInput(!showDiscountInput)}
            className="text-brand-700 hover:underline font-bold flex items-center gap-1"
          >
            <Percent className="w-3 h-3" />
            <span>{discountAmount > 0 ? 'تعديل الخصم' : 'إضافة خصم'}</span>
          </button>
          {discountAmount > 0 && (
            <span className="text-emerald-700 font-bold font-mono">
              -{formatCurrency(discountAmount)}
            </span>
          )}
        </div>

        {/* مدخل الخصم */}
        {showDiscountInput && (
          <div className="p-2 rounded-lg bg-surface-2 border border-line space-y-1.5 animate-in fade-in">
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min="0"
                value={discountValInput}
                onChange={(e) => setDiscountValInput(Number(e.target.value))}
                className="w-16 py-1 px-1.5 rounded border border-line text-xs font-mono bg-surface text-ink text-center"
              />
              <button
                type="button"
                onClick={() => handleApplyDiscount('percentage')}
                className="flex-1 py-1 px-2 rounded bg-surface hover:bg-surface-2 border border-line text-xs font-bold text-ink"
              >
                نسبة %
              </button>
              <button
                type="button"
                onClick={() => handleApplyDiscount('fixed')}
                className="flex-1 py-1 px-2 rounded bg-surface hover:bg-surface-2 border border-line text-xs font-bold text-ink"
              >
                مبلغ
              </button>
            </div>
          </div>
        )}

        {/* ملخص الحساب */}
        <div className="space-y-1 text-xs text-ink-muted">
          <div className="flex items-center justify-between">
            <span>المجموع الفرعي:</span>
            <span className="font-mono text-ink">{formatCurrency(subtotal)}</span>
          </div>

          {orderType === 'delivery' && deliveryFee > 0 && (
            <div className="flex items-center justify-between">
              <span>خدمة التوصيل:</span>
              <span className="font-mono text-ink">+{formatCurrency(deliveryFee)}</span>
            </div>
          )}

          {taxAmount > 0 && (
            <div className="flex items-center justify-between">
              <span>الضريبة:</span>
              <span className="font-mono text-ink">+{formatCurrency(taxAmount)}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-1.5 border-t border-line text-sm font-bold text-brand-700 font-mono">
            <span>الإجمالي:</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>

        {checkoutError && (
          <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold leading-relaxed">
            {checkoutError}
          </div>
        )}

        {/* زر إتمام الطلب والدفع */}
        <button
          type="button"
          disabled={items.length === 0 || isSubmitting}
          onClick={handleCheckout}
          className="w-full py-2.5 px-4 rounded-lg bg-brand-700 hover:bg-brand-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs transition-colors flex items-center justify-center gap-2"
        >
          <CreditCard className="w-4 h-4" />
          <span>
            {isSubmitting ? 'جاري حفظ الطلب...' : `تأكيد الأوردر والدفع (${formatCurrency(total)})`}
          </span>
        </button>

      </div>

      {/* نافذة نجاح تسجيل الأوردر */}
      {isSuccessModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-surface rounded-xl border border-line shadow-2xl p-5 max-w-sm w-full text-center space-y-3">
            <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
              <Check className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="text-xs font-bold text-brand-700 font-mono mb-1">
                {createdOrderNumber ? `أوردر رقم #${createdOrderNumber}` : ''}
              </div>
              <h3 className="font-bold text-base text-ink">تم تأكيد الأوردر بنجاح</h3>
              <p className="text-xs text-ink-muted mt-1">
                تم إرسال الطلب لمحطات التحضير (المطبخ / الوافل / المشروبات)
              </p>
            </div>
            <div className="p-2.5 rounded bg-surface-2 border border-line text-xs font-mono font-bold text-brand-700">
              المدفوع: {formatCurrency(total)}
            </div>
            <button
              type="button"
              onClick={() => {
                clearCart();
                setIsSuccessModalOpen(false);
                if (onClose) onClose();
              }}
              className="w-full py-2 rounded-lg bg-brand-700 text-white font-bold text-xs hover:bg-brand-800 transition-colors"
            >
              أوردر جديد
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
