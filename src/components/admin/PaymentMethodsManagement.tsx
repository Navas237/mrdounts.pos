import React, { useCallback, useEffect, useState } from 'react';
import { isLiveSupabaseConfigured } from '@/lib/supabase';
import { posService, PaymentMethod } from '@/services/pos.service';
import { Plus, Trash2, Banknote, CreditCard, AlertCircle } from 'lucide-react';

export const PaymentMethodsManagement: React.FC = () => {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [nameInput, setNameInput] = useState('');
  const [isCashInput, setIsCashInput] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isLiveSupabaseConfigured) return;
    try {
      const list = await posService.listPaymentMethods();
      setMethods(list);
    } catch (err: any) {
      setMessage(err.message || 'فشل تحميل طرق الدفع');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async () => {
    if (!nameInput.trim()) return;
    setIsSaving(true);
    setMessage(null);
    try {
      await posService.savePaymentMethod({
        name: nameInput.trim(),
        is_cash: isCashInput,
        sort_order: methods.length + 1,
      });
      setNameInput('');
      setIsCashInput(false);
      await load();
    } catch (err: any) {
      setMessage(err.message || 'فشل حفظ طريقة الدفع');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setMessage(null);
    try {
      await posService.deletePaymentMethod(id);
      await load();
    } catch (err: any) {
      setMessage(err.message || 'فشل حذف طريقة الدفع');
    }
  };

  if (!isLiveSupabaseConfigured) {
    return (
      <div className="py-12 text-center text-xs text-ink-muted">
        إدارة طرق الدفع تحتاج اتصال قاعدة البيانات (Supabase)
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="border-b border-line pb-2.5">
        <h3 className="text-sm font-extrabold text-ink">طرق الدفع المعرفة</h3>
        <p className="text-[11px] text-ink-muted">تظهر للكاشير في صفحة نقطة البيع وتدخل في تقارير الشفت</p>
      </div>

      {message && (
        <div className="p-2.5 rounded-xl border border-brand-200 bg-brand-50 text-brand-900 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {methods.map((m) => (
          <div
            key={m.id}
            className="p-2.5 rounded-lg bg-surface-2/40 border border-line text-xs font-bold text-ink flex items-center justify-between"
          >
            <span className="flex items-center gap-1.5">
              {m.is_cash ? (
                <Banknote className="w-3.5 h-3.5 text-emerald-700" />
              ) : (
                <CreditCard className="w-3.5 h-3.5 text-sky-700" />
              )}
              {m.name}
            </span>
            <button
              type="button"
              onClick={() => handleDelete(m.id)}
              className="text-stone-400 hover:text-rose-600 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        {methods.length === 0 && (
          <p className="text-[11px] text-ink-muted col-span-full py-4 text-center">
            لا توجد طرق دفع معرفة بعد
          </p>
        )}
      </div>

      {/* إضافة طريقة جديدة */}
      <div className="flex items-center gap-1.5 pt-2 border-t border-line">
        <input
          type="text"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          placeholder="اسم طريقة الدفع (مثال: فودافون كاش)"
          className="flex-1 py-1.5 px-2.5 rounded-lg border border-line bg-surface text-xs font-bold text-ink focus:outline-none focus:border-brand-700"
        />
        <button
          type="button"
          onClick={() => setIsCashInput(!isCashInput)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
            isCashInput
              ? 'bg-emerald-700 text-white border-emerald-700'
              : 'bg-surface-2/50 text-ink border-line hover:bg-surface-2'
          }`}
        >
          {isCashInput ? 'كاش (يدخل الدرج)' : 'إلكتروني'}
        </button>
        <button
          type="button"
          onClick={handleAdd}
          disabled={isSaving || !nameInput.trim()}
          className="py-1.5 px-4 rounded-lg bg-brand-700 hover:bg-brand-800 text-white text-xs font-extrabold transition-colors flex items-center gap-1 disabled:opacity-40 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>إضافة</span>
        </button>
      </div>
    </div>
  );
};
