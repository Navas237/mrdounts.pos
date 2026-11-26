import React, { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCart } from '@/hooks/useCart';
import { formatCurrency } from '@/utils/formatters';
import { customerService } from '@/services/customer.service';
import { PaymentSection } from './PaymentSection';
import { orderService } from '@/services/order.service';
import {
  Trash2,
  Plus,
  Minus,
  ShoppingCart,
  Phone,
  User,
  Percent,
  MapPin,
  Utensils,
  ShoppingBag,
  Bike,
  Store,
  CheckCircle2,
  AlertCircle,
  Printer,
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

export const CartBottomSection: React.FC = () => {
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
    payments,
  } = useCart();

  const queryClient = useQueryClient();

  const [phoneInput, setPhoneInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [addressInput, setAddressInput] = useState('');

  const [showDiscountInput, setShowDiscountInput] = useState(false);
  const [discountValInput, setDiscountValInput] = useState(10);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [createdOrderNumber, setCreatedOrderNumber] = useState<number | null>(null);

  const isDeliveryOrPickup = orderType === 'delivery' || orderType === 'pickup';

  // البحث السريع التلقائي عند كتابة رقم الهاتف
  const handlePhoneChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPhoneInput(val);
    if (val.length >= 10) {
      const found = await customerService.findCustomerByPhone(val);
      if (found) {
        setNameInput(found.name);
        setAddressInput(found.default_address || '');
        setCustomer({
          phone: found.phone,
          name: found.name,
          address: found.default_address,
          delivery_fee: orderType === 'delivery' ? 20 : 0,
        });
      } else {
        setNameInput('عميل جديد');
        setCustomer({
          phone: val,
          name: 'عميل جديد',
          address: addressInput,
          delivery_fee: orderType === 'delivery' ? 20 : 0,
        });
      }
    } else {
      setCustomer(null);
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNameInput(val);
    setCustomer({
      phone: phoneInput || customer?.phone || '',
      name: val,
      address: addressInput || customer?.address,
      delivery_fee: orderType === 'delivery' ? 20 : 0,
    });
  };

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setAddressInput(val);
    setCustomer({
      phone: phoneInput || customer?.phone || '',
      name: nameInput || customer?.name || 'عميل',
      address: val,
      delivery_fee: orderType === 'delivery' ? 20 : 0,
    });
  };

  const handleApplyDiscount = (type: 'percentage' | 'fixed') => {
    setDiscount(type, Number(discountValInput));
    setShowDiscountInput(false);
  };

  // تأكيد وتسجيل الأوردر
  // مفتاح منع البيع المكرر: يتولد أول محاولة ويثبت عبر إعادتها، ويتصفّر عند النجاح
  const checkoutIdRef = useRef<string | null>(null);

  const handleCheckout = async () => {
    if (items.length === 0) return;
    setIsSubmitting(true);
    setCheckoutError(null);
    try {
      // لو لم تُضف دفعات يدوياً: دفعة كاش كاملة افتراضياً (أسرع مسار)
      // لو أُضيفت دفعات: لازم تغطي الإجمالي (التقسيم مسموح)
      let finalPayments = payments;
      if (finalPayments.length === 0) {
        finalPayments = [
          {
            id: `pay-${Date.now()}`,
            method_name: 'نقدي (كاش)',
            is_cash: true,
            amount: total,
          },
        ];
        addPayment(finalPayments[0]);
      }
      const paidSum = finalPayments.reduce((sum, p) => sum + p.amount, 0);
      if (paidSum + 0.01 < total) {
        throw new Error(`المدفوع (${paidSum}) أقل من الإجمالي (${total}). أكمل باقي المبلغ أو احذف الدفعات.`);
      }

      if (!checkoutIdRef.current) checkoutIdRef.current = crypto.randomUUID();
      const result = await orderService.createOrder({
        clientRequestId: checkoutIdRef.current,
        orderType,
        customerName: nameInput || customer?.name || 'عميل صالة',
        customerPhone: phoneInput || customer?.phone,
        customerAddress: addressInput || customer?.address,
        subtotal,
        discountType: discountType || 'none',
        discountValue,
        discountAmount,
        taxRate: 14,
        taxAmount,
        deliveryFee: orderType === 'delivery' ? deliveryFee : 0,
        total,
        items,
        payments: finalPayments,
      });

      checkoutIdRef.current = null;
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

  const handleResetAfterOrder = () => {
    clearCart();
    setIsSuccessModalOpen(false);
    setPhoneInput('');
    setNameInput('');
    setAddressInput('');
    setCustomer(null);
  };

  return (
    <div className="w-full rounded-2xl border border-line bg-surface p-3.5 sm:p-4 shadow-sm space-y-3.5">
      
      {/* 1. الترويسة الرئيسية للسلة ومحدد نوع الطلب */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-line">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-800 flex items-center justify-center font-bold">
            <ShoppingCart className="w-4 h-4 text-brand-700" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-black text-sm sm:text-base text-ink">
                سلة الأوردر والحساب
              </h2>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-brand-50 text-brand-800 border border-brand-200">
                {items.length} أصناف
              </span>
            </div>
            <p className="text-[11px] text-ink-muted">
              {isDeliveryOrPickup
                ? 'وضع التوصيل / الاستلام: مقسمة لبيانات العميل وشبكة 4 أصناف'
                : 'وضع الصالة / التيك أواي: شبكة أصناف كاملة 6 في الصف'}
            </p>
          </div>
        </div>

        {/* محدد نوع الأوردر (صالة، تيك أواي، ديليفري، استلام) */}
        <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto">
          <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-surface-2 border border-line w-full sm:w-auto">
            {ORDER_TYPES.map((t) => {
              const Icon = t.icon;
              const isSelected = orderType === t.type;
              return (
                <button
                  key={t.type}
                  type="button"
                  onClick={() => setOrderType(t.type)}
                  className={`py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-brand-700 text-white shadow-2xs ring-1 ring-brand-700/20'
                      : 'text-ink-muted hover:text-ink hover:bg-surface'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="whitespace-nowrap">{t.label}</span>
                </button>
              );
            })}
          </div>

          {items.length > 0 && (
            <button
              type="button"
              onClick={clearCart}
              className="text-xs text-rose-700 hover:text-rose-900 font-bold px-2.5 py-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 transition-colors"
            >
              تفريغ السلة
            </button>
          )}
        </div>
      </div>

      {/* 2. جسم السلة الديناميكي بحسب نوع الطلب */}
      {isDeliveryOrPickup ? (
        /* ========================================================
           الحالة الأولى: ديليفري أو استلام (مقسمة لجزأين: شبكة 4 أصناف + بيانات العميل والدفع)
           ======================================================== */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
          
          {/* الجزء الأيمن (8 أعمدة): الأصناف بتنزل 4 في الصف */}
          <div className="lg:col-span-8 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-ink px-1">
              <span>قائمة الأصناف ({items.length})</span>
              <span className="text-ink-muted text-[11px]">شبكة 4 في الصف</span>
            </div>

            {items.length === 0 ? (
              <div className="py-12 text-center rounded-xl border border-dashed border-line bg-surface-2/30 p-4">
                <ShoppingCart className="w-8 h-8 text-stone-300 mx-auto mb-2 stroke-[1.5]" />
                <p className="text-xs font-bold text-ink-muted">السلة فارغة حالياً</p>
                <p className="text-[11px] text-ink-dim mt-0.5">اختر حجم بوكس الدونتس أو صنف الوافل والمشروبات بالأعلى للإضافة</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 max-h-[320px] overflow-y-auto no-scrollbar pr-0.5">
                {items.map((item) => (
                  <CartItemCard
                    key={item.cart_id}
                    item={item}
                    onUpdateQuantity={updateQuantity}
                    onRemove={removeItem}
                  />
                ))}
              </div>
            )}
          </div>

          {/* الجزء الأيسر (4 أعمدة): بيانات العميل والحساب والدفع */}
          <div className="lg:col-span-4 rounded-xl border border-line bg-surface-2/60 p-3.5 space-y-3">
            <div className="flex items-center gap-1.5 font-black text-xs sm:text-sm text-ink border-b border-line pb-2">
              <User className="w-4 h-4 text-brand-700" />
              <span>بيانات العميل {orderType === 'delivery' ? 'والتوصيل' : 'والاستلام'}</span>
            </div>

            {/* حقول بيانات العميل */}
            <div className="space-y-2">
              {/* رقم الهاتف */}
              <div className="relative flex items-center rounded-lg border border-line bg-surface focus-within:border-brand-700 transition-colors">
                <div className="pr-2 text-ink-muted">
                  <Phone className="w-3.5 h-3.5" />
                </div>
                <input
                  type="text"
                  value={phoneInput}
                  onChange={handlePhoneChange}
                  placeholder="رقم هاتف العميل (010...)"
                  dir="ltr"
                  className="w-full py-1.5 px-2 text-xs bg-transparent focus:outline-none font-bold text-ink placeholder:text-ink-dim"
                />
              </div>

              {/* اسم العميل */}
              <div className="relative flex items-center rounded-lg border border-line bg-surface focus-within:border-brand-700 transition-colors">
                <div className="pr-2 text-ink-muted">
                  <User className="w-3.5 h-3.5" />
                </div>
                <input
                  type="text"
                  value={nameInput}
                  onChange={handleNameChange}
                  placeholder="اسم العميل (مثال: أحمد مصطفى)"
                  className="w-full py-1.5 px-2 text-xs bg-transparent focus:outline-none font-bold text-ink placeholder:text-ink-dim"
                />
              </div>

              {/* عنوان التوصيل */}
              <div className="relative flex items-center rounded-lg border border-line bg-surface focus-within:border-brand-700 transition-colors">
                <div className="pr-2 text-ink-muted">
                  <MapPin className="w-3.5 h-3.5" />
                </div>
                <input
                  type="text"
                  value={addressInput}
                  onChange={handleAddressChange}
                  placeholder={orderType === 'delivery' ? 'عنوان التوصيل بالتفصيل *' : 'ملاحظات العنوان إن وُجد'}
                  className="w-full py-1.5 px-2 text-xs bg-transparent focus:outline-none font-bold text-ink placeholder:text-ink-dim"
                />
              </div>
            </div>

            {/* الحساب والدفع */}
            <div className="pt-2 border-t border-line space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-ink-muted">
                <span>المجموع الفرعي:</span>
                <span className="font-mono text-ink font-bold">{formatCurrency(subtotal)}</span>
              </div>

              {orderType === 'delivery' && (
                <div className="flex items-center justify-between text-ink-muted">
                  <span>خدمة التوصيل:</span>
                  <span className="font-mono text-ink font-bold">+{formatCurrency(deliveryFee || 20)}</span>
                </div>
              )}

              {discountAmount > 0 && (
                <div className="flex items-center justify-between text-emerald-700 font-bold">
                  <span>الخصم المطبق:</span>
                  <span className="font-mono">-{formatCurrency(discountAmount)}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-1 border-t border-line text-sm font-black text-brand-700">
                <span>الإجمالي النهائي:</span>
                <span className="font-mono text-base">{formatCurrency(total)}</span>
              </div>
            </div>

            {/* طرق الدفع والتقسيم */}
            <PaymentSection />

            {/* زر تأكيد الأوردر */}
            <button
              type="button"
              disabled={items.length === 0 || isSubmitting}
              onClick={handleCheckout}
              className="w-full py-2.5 px-4 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-extrabold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed active:scale-98 cursor-pointer"
            >
              <span>{isSubmitting ? 'جاري الحفظ...' : `تأكيد الأوردر (${formatCurrency(total)})`}</span>
            </button>
          </div>

        </div>
      ) : (
        /* ========================================================
           الحالة الثانية: صالة أو تيك أواي (السلة جزء واحد كامل وفي 6 في الصف)
           ======================================================== */
        <div className="space-y-3">
          {items.length === 0 ? (
            <div className="py-10 text-center rounded-xl border border-dashed border-line bg-surface-2/30 p-4">
              <ShoppingCart className="w-8 h-8 text-stone-300 mx-auto mb-2 stroke-[1.5]" />
              <p className="text-xs font-bold text-ink-muted">السلة فارغة حالياً</p>
              <p className="text-[11px] text-ink-dim mt-0.5">اختر حجم بوكس الدونتس أو صنف الوافل والمشروبات بالأعلى للإضافة</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-[300px] overflow-y-auto no-scrollbar pr-0.5">
              {items.map((item) => (
                <CartItemCard
                  key={item.cart_id}
                  item={item}
                  onUpdateQuantity={updateQuantity}
                  onRemove={removeItem}
                />
              ))}
            </div>
          )}

          {/* طرق الدفع والتقسيم */}
          <PaymentSection />

          {/* شريط الحساب المالي الكامل الأفقي والسريع بنمط الكاشير */}
          <div className="rounded-xl border border-line bg-surface-2/60 p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-4 flex-wrap text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-ink-muted">المجموع الفرعي:</span>
                <span className="font-mono text-ink font-bold text-sm">{formatCurrency(subtotal)}</span>
              </div>

              {discountAmount > 0 && (
                <div className="flex items-center gap-1.5 text-emerald-700 font-bold">
                  <span>الخصم:</span>
                  <span className="font-mono">-{formatCurrency(discountAmount)}</span>
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowDiscountInput(!showDiscountInput)}
                className="text-brand-800 hover:underline font-bold flex items-center gap-1 text-[11px]"
              >
                <Percent className="w-3 h-3" />
                <span>{discountAmount > 0 ? 'تعديل الخصم' : '+ إضافة خصم'}</span>
              </button>

              <div className="flex items-center gap-2 border-r border-line pr-4">
                <span className="text-xs font-bold text-ink">الإجمالي النهائي:</span>
                <span className="text-lg font-black text-brand-700 font-mono">
                  {formatCurrency(total)}
                </span>
              </div>
            </div>

            {/* زر تأكيد الأوردر المباشر */}
            <button
              type="button"
              disabled={items.length === 0 || isSubmitting}
              onClick={handleCheckout}
              className="w-full sm:w-auto py-2.5 px-8 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-extrabold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed active:scale-98 cursor-pointer"
            >
              <span>{isSubmitting ? 'جاري الحفظ...' : `تأكيد الأوردر والدفع (${formatCurrency(total)})`}</span>
            </button>
          </div>

          {/* مدخل الخصم السريع */}
          {showDiscountInput && (
            <div className="p-2 rounded-xl bg-surface border border-line flex items-center gap-2 animate-in fade-in max-w-sm">
              <input
                type="number"
                min="0"
                value={discountValInput}
                onChange={(e) => setDiscountValInput(Number(e.target.value))}
                className="w-20 py-1 px-2 rounded-lg border border-line text-xs font-mono bg-surface text-ink text-center font-bold"
              />
              <button
                type="button"
                onClick={() => handleApplyDiscount('percentage')}
                className="py-1 px-2.5 rounded-lg bg-surface hover:bg-surface-2 border border-line text-xs font-bold text-ink"
              >
                نسبة %
              </button>
              <button
                type="button"
                onClick={() => handleApplyDiscount('fixed')}
                className="py-1 px-2.5 rounded-lg bg-surface hover:bg-surface-2 border border-line text-xs font-bold text-ink"
              >
                مبلغ
              </button>
            </div>
          )}
        </div>
      )}

      {/* خطأ التسجيل إن وُجد */}
      {checkoutError && (
        <div className="p-2.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{checkoutError}</span>
        </div>
      )}

      {/* مودال نجاح تسجيل الأوردر */}
      {isSuccessModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-surface border border-line rounded-2xl max-w-sm w-full p-5 shadow-2xl text-center space-y-4 animate-in zoom-in-95">
            <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 stroke-[2.2]" />
            </div>

            <div>
              <h3 className="text-base font-black text-ink">تم تسجيل الأوردر بنجاح!</h3>
              <p className="text-xs text-ink-muted mt-1">
                رقم الطلب اليومي:{' '}
                <strong className="text-brand-700 text-lg font-mono font-black">
                  #{createdOrderNumber}
                </strong>
              </p>
              <p className="text-xs font-bold text-ink mt-0.5">
                الإجمالي:{' '}
                <strong className="font-mono text-brand-700">{formatCurrency(total)}</strong>
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleResetAfterOrder}
                className="flex-1 py-2 px-3 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-extrabold text-xs transition-colors"
              >
                طلب جديد 
              </button>

              <button
                type="button"
                onClick={() => {
                  window.print();
                  handleResetAfterOrder();
                }}
                className="py-2 px-3 rounded-xl border border-line hover:bg-surface-2 text-ink font-bold text-xs transition-colors flex items-center gap-1"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>طباعة</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

// كارت الصنف الفردي بالسلة داخل شبكة الـ 4 أو الـ 6
const CartItemCard: React.FC<{
  item: any;
  onUpdateQuantity: (id: string, q: number) => void;
  onRemove: (id: string) => void;
}> = ({ item, onUpdateQuantity, onRemove }) => {
  // تجميع قطع الدونتس بنظافة
  const groupedPieces: Record<string, { count: number; desc: string }> = {};
  if (item.is_donut_box && item.donut_pieces) {
    item.donut_pieces.forEach((p: any) => {
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
    <div className="rounded-xl border border-line bg-surface p-2.5 flex flex-col justify-between text-xs space-y-1.5 shadow-2xs hover:border-brand-300 transition-all">
      <div className="space-y-1">
        <div className="flex items-start justify-between font-black text-ink gap-1">
          <span className="leading-tight text-xs font-black truncate">
            {item.is_donut_box
              ? `بوكس ${item.donut_pieces_count} قطع (${item.donut_type === 'mini' ? 'ميني' : item.donut_type === 'stuffed' ? 'حشو' : 'عادي'})`
              : `${item.item_name} ${item.size_name ? `(${item.size_name})` : ''}`}
          </span>
          <button
            type="button"
            onClick={() => onRemove(item.cart_id)}
            className="text-stone-400 hover:text-rose-600 transition-colors p-0.5"
            title="حذف الصنف"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>

        {/* تفاصيل بوكس الدونتس */}
        {item.is_donut_box && (
          <div className="p-1 rounded bg-surface-2 text-[10px] text-ink-muted space-y-0.5 font-medium max-h-16 overflow-y-auto no-scrollbar">
            {Object.values(groupedPieces).map((g: any, gIdx) => (
              <div key={gIdx} className="flex items-center gap-1 leading-none">
                <span className="font-mono font-bold text-ink">{g.count}×</span>
                <span className="truncate">{g.desc}</span>
              </div>
            ))}
          </div>
        )}

        {/* تفاصيل إضافات الأصناف الأخرى */}
        {!item.is_donut_box && item.options?.length > 0 && (
          <div className="text-[10px] text-ink-muted font-medium truncate">
            + {item.options.map((o: any) => o.name).join('، ')}
          </div>
        )}
      </div>

      {/* شريط السعر والكمية */}
      <div className="flex items-center justify-between pt-1 border-t border-line/60 mt-1">
        <span className="font-mono font-black text-xs text-brand-700">
          {formatCurrency(item.line_total)}
        </span>

        <div className="flex items-center gap-1 bg-surface-2 p-0.5 rounded border border-line">
          <button
            type="button"
            onClick={() => onUpdateQuantity(item.cart_id, item.quantity - 1)}
            className="w-4 h-4 rounded bg-surface hover:bg-surface-3 text-ink flex items-center justify-center transition-colors"
          >
            <Minus className="w-2.5 h-2.5" />
          </button>
          <span className="w-4 text-center font-bold text-[11px] font-mono leading-none">
            {item.quantity}
          </span>
          <button
            type="button"
            onClick={() => onUpdateQuantity(item.cart_id, item.quantity + 1)}
            className="w-4 h-4 rounded bg-surface hover:bg-surface-3 text-ink flex items-center justify-center transition-colors"
          >
            <Plus className="w-2.5 h-2.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
