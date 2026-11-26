import React, { useEffect, useState } from 'react';
import { useCart } from '@/hooks/useCart';
import { posService, PaymentMethod } from '@/services/pos.service';
import { isLiveSupabaseConfigured } from '@/lib/supabase';
import { formatCurrency } from '@/utils/formatters';
import { Banknote, CreditCard, Plus, X, Wallet } from 'lucide-react';

// طرق دفع احتياطية للوضع المحلي (بدون اتصال قاعدة البيانات)
const LOCAL_METHODS: PaymentMethod[] = [
  { id: 'local-cash', name: 'نقدي (كاش)', is_cash: true, sort_order: 1, is_active: true },
  { id: 'local-visa', name: 'فيزا / بطاقة', is_cash: false, sort_order: 2, is_active: true },
  { id: 'local-instapay', name: 'إنستاباي', is_cash: false, sort_order: 3, is_active: true },
  { id: 'local-wallet', name: 'محفظة إلكترونية', is_cash: false, sort_order: 4, is_active: true },
];

export const PaymentSection: React.FC = () => {
  const { total, payments, addPayment, removePayment, remainingBalance } = useCart();
  const [methods, setMethods] = useState<PaymentMethod[]>(LOCAL_METHODS);
  const [selectedMethodId, setSelectedMethodId] = useState<string>('');
  const [amountInput, setAmountInput] = useState<string>('');
  const [loadError, setLoadError] = useState(false);

  // وضع لايف: لا نخترع طرق دفع — نقرأ المعرّفة فقط ونفشل بوضوح مع إعادة محاولة
  const loadMethods = () => {
    if (!isLiveSupabaseConfigured) return; // الوضع المحلي/التجريبي: القائمة المحلية مقصودة
    setLoadError(false);
    posService
      .listPaymentMethods()
      .then((list) => setMethods(list))
      .catch(() => setLoadError(true));
  };

  useEffect(() => {
    loadMethods();
  }, []);

  const selectedMethod =
    methods.find((m) => m.id === selectedMethodId) || methods.find((m) => m.is_cash) || methods[0];

  const handleAddPayment = (amount: number) => {
    if (!selectedMethod || amount <= 0) return;
    // الإلكتروني لا يتجاوز المتبقي؛ الباقي للعميل يكون كاش فقط
    if (!selectedMethod.is_cash && amount > remainingBalance) {
      amount = remainingBalance;
    }
    addPayment({
      id: `pay-${Date.now()}-${selectedMethod.id}`,
      method_name: selectedMethod.name,
      is_cash: selectedMethod.is_cash,
      amount: Math.round(amount * 100) / 100,
    });
    setAmountInput('');
  };

  const paid = payments.reduce((sum, p) => sum + p.amount, 0);
  const change = Math.max(0, paid - total);

  return (
    <div className="rounded-xl border border-line bg-surface p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-extrabold text-ink">
          <Wallet className="w-4 h-4 text-brand-700" />
          <span>طريقة الدفع</span>
        </div>
        <span className="text-[11px] text-ink-muted">ممكن تقسيم المبلغ على أكتر من طريقة</span>
      </div>

      {loadError && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-[11px] font-bold text-rose-700">
          <span>تعذر تحميل طرق الدفع المعرفة. تحقق من الاتصال.</span>
          <button
            type="button"
            onClick={loadMethods}
            className="px-2.5 py-1 rounded-md bg-rose-700 text-white text-[10px] font-extrabold cursor-pointer"
          >
            إعادة المحاولة
          </button>
        </div>
      )}
      {isLiveSupabaseConfigured && !loadError && methods.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] font-bold text-amber-800">
          لا توجد طرق دفع معرفة. أضفها من لوحة الإدارة — تبويب طرق الدفع.
        </div>
      )}

      {/* اختيار الطريقة */}
      <div className="flex flex-wrap gap-1.5">
        {methods.map((m) => {
          const isSelected = selectedMethod?.id === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelectedMethodId(m.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                isSelected
                  ? 'bg-brand-700 text-white border-brand-700 shadow-2xs'
                  : 'bg-surface-2/50 text-ink border-line hover:bg-surface-2'
              }`}
            >
              {m.is_cash ? <Banknote className="w-3.5 h-3.5" /> : <CreditCard className="w-3.5 h-3.5" />}
              <span>{m.name}</span>
            </button>
          );
        })}
      </div>

      {/* إدخال المبلغ وإضافة دفعة */}
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min="0"
          step="0.25"
          value={amountInput}
          onChange={(e) => setAmountInput(e.target.value)}
          placeholder={`المبلغ (${formatCurrency(remainingBalance || total)})`}
          dir="ltr"
          className="w-28 py-1.5 px-2 rounded-lg border border-line bg-surface text-xs font-mono font-bold text-ink text-center focus:outline-none focus:border-brand-700"
        />
        <button
          type="button"
          onClick={() => handleAddPayment(Number(amountInput))}
          disabled={!amountInput || Number(amountInput) <= 0}
          className="py-1.5 px-3 rounded-lg bg-surface-2 hover:bg-brand-700 hover:text-white border border-line text-xs font-bold text-ink transition-colors flex items-center gap-1 disabled:opacity-40 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>إضافة دفعة</span>
        </button>
        <button
          type="button"
          onClick={() => handleAddPayment(Math.max(remainingBalance, total))}
          className="py-1.5 px-3 rounded-lg bg-brand-50 hover:bg-brand-100 border border-brand-200 text-xs font-extrabold text-brand-800 transition-colors cursor-pointer"
        >
          {selectedMethod?.is_cash ? 'كاش بالكامل' : 'الكامل بطريقة واحدة'}
        </button>
      </div>

      {/* الدفعات المضافة */}
      {payments.length > 0 && (
        <div className="space-y-1 pt-1 border-t border-line/60">
          {payments.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between text-xs bg-surface-2/50 rounded-lg px-2.5 py-1.5"
            >
              <span className="font-bold text-ink flex items-center gap-1.5">
                {p.is_cash ? (
                  <Banknote className="w-3.5 h-3.5 text-emerald-700" />
                ) : (
                  <CreditCard className="w-3.5 h-3.5 text-sky-700" />
                )}
                {p.method_name}
              </span>
              <span className="flex items-center gap-2">
                <span className="font-mono font-extrabold text-ink">{formatCurrency(p.amount)}</span>
                <button
                  type="button"
                  onClick={() => removePayment(p.id)}
                  className="text-stone-400 hover:text-rose-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            </div>
          ))}

          <div className="flex items-center justify-between text-[11px] pt-1">
            <span className={remainingBalance > 0 ? 'text-rose-700 font-bold' : 'text-emerald-700 font-bold'}>
              {remainingBalance > 0
                ? `المتبقي: ${formatCurrency(remainingBalance)}`
                : 'المبلغ مكتمل'}
            </span>
            {change > 0 && (
              <span className="text-ink-muted font-bold">الباقي للعميل: {formatCurrency(change)}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
