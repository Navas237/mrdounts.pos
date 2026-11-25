import React, { useState } from 'react';
import { useShift } from '@/hooks/useShift';
import { formatCurrency, formatDateTime, formatTime } from '@/utils/formatters';
import {
  Coins,
  Lock,
  Unlock,
  ArrowDownLeft,
  ArrowUpRight,
  Receipt,
  PlusCircle,
  MinusCircle,
  Banknote,
  CreditCard,
  Wallet,
  Smartphone,
  CheckCircle2,
  History,
  FileText,
  DollarSign,
} from 'lucide-react';
import { PermissionGate } from '@/components/shared/PermissionGate';
import { CashKind } from '@/types/database';

const DEPOSIT_CATEGORIES = ['فكة أول الشفت', 'إيداع من الخزينة الرئيسية', 'تسوية رصيد', 'أخرى'];
const WITHDRAW_CATEGORIES = ['توريد للخزينة الرئيسية', 'سحب مؤقت', 'تسوية عجز', 'أخرى'];
const EXPENSE_CATEGORIES = [
  'مشتريات خامات ومستلزمات (حليب / فواكه / صوصات)',
  'صيانة وإصلاحات طارئة',
  'تشغيل وضيافة ومستهلكات ورقية',
  'بونات وفواتير خارجية ونثريات',
  'أخرى',
];

export const Shifts: React.FC = () => {
  const {
    isOpen,
    isLoading,
    summary,
    movements,
    history,
    openShift,
    isOpening,
    closeShift,
    isClosing,
    addMovement,
    isAddingMovement,
    kickDrawer,
    isKickingDrawer,
  } = useShift();

  const [activeTab, setActiveTab] = useState<'ledger' | 'history'>('ledger');
  const [movementFilter, setMovementFilter] = useState<'all' | 'in' | 'out' | 'expense'>('all');

  // نوافذ الحركات المالية
  const [modalType, setModalType] = useState<'open' | 'close' | 'in' | 'out' | 'expense' | 'z-report' | null>(null);

  // حقول الإدخال
  const [amountInput, setAmountInput] = useState('');
  const [categoryInput, setCategoryInput] = useState('');
  const [descriptionInput, setDescriptionInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [actualCashInput, setActualCashInput] = useState('');
  const [drawerKickFeedback, setDrawerKickFeedback] = useState(false);

  // فتح نافذة حركة جديدة
  const handleOpenActionModal = (type: 'in' | 'out' | 'expense') => {
    setAmountInput('');
    setDescriptionInput('');
    if (type === 'in') setCategoryInput(DEPOSIT_CATEGORIES[0]);
    if (type === 'out') setCategoryInput(WITHDRAW_CATEGORIES[0]);
    if (type === 'expense') setCategoryInput(EXPENSE_CATEGORIES[0]);
    setModalType(type);
  };

  // حفظ الحركة المالية (إيداع / سحب / مصروف)
  const handleSubmitMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(amountInput);
    if (!amt || amt <= 0) return;

    const kind: CashKind = modalType === 'in' ? 'in' : 'out';

    await addMovement({
      kind,
      amount: amt,
      category: categoryInput,
      description: descriptionInput,
    });

    setModalType(null);
  };

  // فتح شفت جديد
  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    const opening = Number(amountInput) || 0;
    await openShift({
      openingCash: opening,
      notes: notesInput,
    });
    setModalType(null);
  };

  // قفل الشفت ومطابقة النقدية
  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    const actual = Number(actualCashInput) || 0;
    await closeShift({
      actualCash: actual,
      notes: notesInput,
    });
    setModalType('z-report');
  };

  // فتح الدرج يدوياً
  const handleKickDrawer = async () => {
    await kickDrawer('فتح يدوي لمراجعة الدرج');
    setDrawerKickFeedback(true);
    setTimeout(() => setDrawerKickFeedback(false), 2500);
  };

  if (isLoading) {
    return <div className="p-12 text-center text-xs text-ink-muted">جاري تحميل بيانات الشفت والدرج...</div>;
  }

  // فلترة حركات الدرج
  const filteredMovements = movements.filter((m) => {
    if (movementFilter === 'in') return m.kind === 'in';
    if (movementFilter === 'out') return m.kind === 'out' && !m.category.includes('مشتريات') && !m.category.includes('صيانة') && !m.category.includes('تشغيل');
    if (movementFilter === 'expense') return m.kind === 'out';
    return true;
  });

  // حساب الفرق المالي عند الجرد
  const countedCash = Number(actualCashInput) || 0;
  const expectedCash = summary?.expected_cash || 0;
  const variance = countedCash - expectedCash;

  return (
    <div className="space-y-3.5">
      
      {/* 1. هيدر الشاشة الرئيسي مع الإجراءات النقدية السريعة */}
      <div className="p-3 sm:p-3.5 rounded-2xl bg-surface border border-line shadow-2xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-brand-700 text-white flex items-center justify-center font-bold shadow-2xs shrink-0">
            <Coins className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-black text-sm sm:text-base text-ink tracking-tight">
                إدارة الخزينة والدرج والشفتات
              </h1>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-extrabold border ${
                  isOpen
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                    : 'bg-amber-50 text-amber-700 border-amber-300'
                }`}
              >
                {isOpen ? 'الشفت مفتوح (نشط)' : 'الشفت مغلق'}
              </span>
            </div>
          </div>
        </div>

        {/* أزرار الإجراءات النقدية السريعة (Drawer Speed Actions) */}
        <div className="flex flex-wrap items-center gap-1.5 w-full lg:w-auto">
          
          {/* فتح الدرج يدويًا */}
          {isOpen && (
            <button
              type="button"
              onClick={handleKickDrawer}
              disabled={isKickingDrawer}
              className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-1.5 touch-target ${
                drawerKickFeedback
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                  : 'bg-surface hover:bg-surface-2 border-line text-ink'
              }`}
              title="إرسال إشارة كهربائية لطابعة الكاشير لفتح درج النقدية"
            >
              <Banknote className="w-3.5 h-3.5" />
              <span>{drawerKickFeedback ? 'تم فتح الدرج!' : 'فتح الدرج'}</span>
            </button>
          )}

          {/* زر تسجيل إيداع نقدية */}
          {isOpen && (
            <PermissionGate action="drawer.movement">
              <button
                type="button"
                onClick={() => handleOpenActionModal('in')}
                className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition-colors flex items-center gap-1 touch-target shadow-2xs"
              >
                <PlusCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span>إيداع نقدية</span>
              </button>
            </PermissionGate>
          )}

          {/* زر سحب نقدية */}
          {isOpen && (
            <PermissionGate action="drawer.movement">
              <button
                type="button"
                onClick={() => handleOpenActionModal('out')}
                className="px-3 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 text-xs font-bold transition-colors flex items-center gap-1 touch-target shadow-2xs"
              >
                <MinusCircle className="w-3.5 h-3.5 text-purple-600" />
                <span>سحب نقدية</span>
              </button>
            </PermissionGate>
          )}

          {/* زر تسجيل مصروفات */}
          {isOpen && (
            <PermissionGate action="drawer.movement">
              <button
                type="button"
                onClick={() => handleOpenActionModal('expense')}
                className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-bold transition-colors flex items-center gap-1 touch-target shadow-2xs"
              >
                <Receipt className="w-3.5 h-3.5 text-rose-600" />
                <span>تسجيل مصروف</span>
              </button>
            </PermissionGate>
          )}

          {/* زر فتح شفت جديد إن كان مغلقاً */}
          {!isOpen && (
            <PermissionGate action="shift.open">
              <button
                type="button"
                onClick={() => {
                  setAmountInput('500');
                  setNotesInput('بداية الشفت اليومي');
                  setModalType('open');
                }}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs touch-target"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>فتح شفت جديد</span>
              </button>
            </PermissionGate>
          )}

          {/* زر قفل الشفت وجرد الدرج إن كان مفتوحاً */}
          {isOpen && (
            <PermissionGate action="shift.close">
              <button
                type="button"
                onClick={() => {
                  setActualCashInput(String(summary?.expected_cash || 0));
                  setNotesInput('');
                  setModalType('close');
                }}
                className="px-3.5 py-1.5 rounded-lg bg-brand-700 hover:bg-brand-800 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs touch-target"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>قفل الشفت ومطابقة النقدية</span>
              </button>
            </PermissionGate>
          )}

        </div>
      </div>

      {/* 2. شريط المؤشرات المالية الستة الحية (6 Financial KPI Cards) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-2.5">
        
        {/* مؤشر 1: المتوقع في الدرج حالياً */}
        <div className="p-3 rounded-xl bg-surface border border-brand-700/40 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span className="font-extrabold text-brand-900 text-xs">المتوقع في الدرج</span>
            <Banknote className="w-3.5 h-3.5 text-brand-700" />
          </div>
          <div className="my-1.5">
            <span className="text-base sm:text-lg font-black text-brand-700 block font-mono">
              {formatCurrency(summary?.expected_cash || 0)}
            </span>
          </div>
        </div>

        {/* مؤشر 2: مبيعات الكاش (نقدي) */}
        <div className="p-3 rounded-xl bg-surface border border-line shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span className="font-bold text-ink text-xs">مبيعات كاش</span>
            <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="my-1.5">
            <span className="text-base sm:text-lg font-black text-emerald-600 block font-mono">
              {formatCurrency(summary?.cash_sales || 0)}
            </span>
          </div>
        </div>

        {/* مؤشر 3: إجمالي المصروفات والسحوبات */}
        <div className="p-3 rounded-xl bg-surface border border-line shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span className="font-bold text-ink text-xs">المصروفات والسحب</span>
            <MinusCircle className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <div className="my-1.5">
            <span className="text-base sm:text-lg font-black text-rose-600 block font-mono">
              {formatCurrency(summary?.expenses_total || 0)}
            </span>
          </div>
        </div>

        {/* مؤشر 4: فيزا / بطاقات */}
        <div className="p-3 rounded-xl bg-surface border border-line shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span className="font-bold text-ink text-xs">فيزا وبطاقات</span>
            <CreditCard className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="my-1.5">
            <span className="text-base sm:text-lg font-black text-blue-600 block font-mono">
              {formatCurrency(summary?.card_sales || 0)}
            </span>
          </div>
        </div>

        {/* مؤشر 5: محافظ إلكترونية */}
        <div className="p-3 rounded-xl bg-surface border border-line shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span className="font-bold text-ink text-xs">محافظ كاش</span>
            <Wallet className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="my-1.5">
            <span className="text-base sm:text-lg font-black text-amber-600 block font-mono">
              {formatCurrency(summary?.wallet_sales || 0)}
            </span>
          </div>
        </div>

        {/* مؤشر 6: انستا باي */}
        <div className="p-3 rounded-xl bg-surface border border-line shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span className="font-bold text-ink text-xs">انستا باي</span>
            <Smartphone className="w-3.5 h-3.5 text-teal-600" />
          </div>
          <div className="my-1.5">
            <span className="text-base sm:text-lg font-black text-teal-600 block font-mono">
              {formatCurrency(summary?.instapay_sales || 0)}
            </span>
          </div>
        </div>

      </div>

      {/* 3. تبويبات حركات الدرج وأرشيف الشفتات السابقة */}
      <div className="space-y-3">
        
        {/* أزرار التبديل بين سجل الحركات وأرشيف الشفتات */}
        <div className="flex items-center justify-between border-b border-line pb-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('ledger')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'ledger'
                  ? 'bg-brand-700 text-white shadow-2xs font-black'
                  : 'text-ink-muted hover:text-ink hover:bg-surface-2'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>كشف حركات النقدية ({movements.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'history'
                  ? 'bg-brand-700 text-white shadow-2xs font-black'
                  : 'text-ink-muted hover:text-ink hover:bg-surface-2'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>أرشيف الشفتات ({history.length})</span>
            </button>
          </div>

          {/* فلاتر الحركات (تظهر فقط في تبويب الكشف) */}
          {activeTab === 'ledger' && (
            <div className="hidden sm:flex items-center gap-1 bg-surface-2 p-0.5 rounded-lg border border-line text-xs font-bold">
              <button
                type="button"
                onClick={() => setMovementFilter('all')}
                className={`px-2.5 py-0.5 rounded-md transition-colors ${
                  movementFilter === 'all' ? 'bg-surface text-ink font-bold shadow-2xs' : 'text-ink-muted hover:text-ink'
                }`}
              >
                الكل
              </button>
              <button
                type="button"
                onClick={() => setMovementFilter('in')}
                className={`px-2.5 py-0.5 rounded-md transition-colors ${
                  movementFilter === 'in' ? 'bg-emerald-100 text-emerald-800 font-bold' : 'text-ink-muted hover:text-ink'
                }`}
              >
                إيداعات (+)
              </button>
              <button
                type="button"
                onClick={() => setMovementFilter('expense')}
                className={`px-2.5 py-0.5 rounded-md transition-colors ${
                  movementFilter === 'expense' ? 'bg-rose-100 text-rose-800 font-bold' : 'text-ink-muted hover:text-ink'
                }`}
              >
                مصروفات (âˆ’)
              </button>
            </div>
          )}
        </div>

        {/* محتوى التبويب 1: كشف حركات الدرج التفصيلي */}
        {activeTab === 'ledger' && (
          <div className="bg-surface rounded-xl border border-line shadow-2xs overflow-hidden">
            {filteredMovements.length === 0 ? (
              <div className="py-12 text-center text-xs text-ink-muted space-y-1.5">
                <Receipt className="w-6 h-6 text-ink-muted mx-auto opacity-40" />
                <div className="font-bold text-ink">لا توجد حركات نقدية مسجلة في هذا الشفت بعد</div>
                <p className="text-xs">سجل أول حركة إيداع أو مصروف من الأزرار العلوية</p>
              </div>
            ) : (
              <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-right text-xs">
                  <thead className="bg-surface-2 text-ink-muted font-bold border-b border-line">
                    <tr>
                      <th className="py-3 px-4">الوقت</th>
                      <th className="py-3 px-4">نوع الحركة</th>
                      <th className="py-3 px-4">البند والتصنيف</th>
                      <th className="py-3 px-4">البيان والتفاصيل</th>
                      <th className="py-3 px-4">المبلغ</th>
                      <th className="py-3 px-4">المسؤول</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {filteredMovements.map((move) => {
                      const isIn = move.kind === 'in';
                      return (
                        <tr key={move.id} className="hover:bg-surface-2/50 transition-colors">
                          <td className="py-3 px-4 font-mono text-xs text-ink-muted">
                            {formatTime(move.created_at)}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black border ${
                                isIn
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : 'bg-rose-50 text-rose-800 border-rose-200'
                              }`}
                            >
                              {isIn ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                              <span>{isIn ? 'إيداع بالدرج' : 'سحب / مصروف'}</span>
                            </span>
                          </td>
                          <td className="py-3 px-4 font-extrabold text-ink">
                            {move.category}
                          </td>
                          <td className="py-3 px-4 text-ink-muted max-w-xs truncate">
                            {move.description || 'â€”'}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`font-black text-sm font-mono ${
                                isIn ? 'text-emerald-600' : 'text-rose-600'
                              }`}
                            >
                              {isIn ? '+' : 'âˆ’'}
                              {formatCurrency(move.amount)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-ink-muted font-medium">
                            {move.created_by || 'أحمد محمود'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* محتوى التبويب 2: أرشيف الشفتات السابقة */}
        {activeTab === 'history' && (
          <div className="bg-surface rounded-xl border border-line shadow-2xs overflow-hidden">
            {history.length === 0 ? (
              <div className="py-12 text-center text-xs text-ink-muted">
                لا توجد شفتات سابقة مؤرشفة بعد.
              </div>
            ) : (
              <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-right text-xs">
                  <thead className="bg-surface-2 text-ink-muted font-bold border-b border-line text-xs">
                    <tr>
                      <th className="py-2.5 px-3">كود الشفت</th>
                      <th className="py-2.5 px-3">وقت الفتح</th>
                      <th className="py-2.5 px-3">وقت الإغلاق</th>
                      <th className="py-2.5 px-3">المسؤول</th>
                      <th className="py-2.5 px-3">الافتتاحي</th>
                      <th className="py-2.5 px-3">المتوقع بالدرج</th>
                      <th className="py-2.5 px-3">الفعلي بعد الجرد</th>
                      <th className="py-2.5 px-3">حالة المطابقة</th>
                      <th className="py-2.5 px-3">ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {history.map((h) => {
                      const diff = h.difference || 0;
                      return (
                        <tr key={h.id} className="hover:bg-surface-2/50 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-black text-brand-700">
                            #{h.id.slice(-6)}
                          </td>
                          <td className="py-2.5 px-3 text-xs text-ink-muted font-mono">
                            {formatDateTime(h.opened_at)}
                          </td>
                          <td className="py-2.5 px-3 text-xs text-ink-muted font-mono">
                            {h.closed_at ? formatDateTime(h.closed_at) : 'لا يزال مفتوحاً'}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-ink">{h.opened_by}</td>
                          <td className="py-2.5 px-3 font-mono">{formatCurrency(h.opening_cash)}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-brand-700">
                            {formatCurrency(h.expected_cash || h.opening_cash)}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-ink">
                            {formatCurrency(h.closing_cash || h.expected_cash || h.opening_cash)}
                          </td>
                          <td className="py-2.5 px-3">
                            {diff === 0 ? (
                              <span className="px-2 py-0.5 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                                مطابق تماماً
                              </span>
                            ) : diff > 0 ? (
                              <span className="px-2 py-0.5 rounded-full text-xs font-black bg-blue-50 text-blue-700 border border-blue-200">
                                زيادة (+{diff})
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-xs font-black bg-rose-50 text-rose-700 border border-rose-200">
                                عجز ({diff})
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-xs text-ink-muted max-w-xs truncate">
                            {h.notes || 'â€”'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>

      {/* ==================================================================== */}
      {/* النوافذ المنبثقة (Modals) للعمليات المالية وفق أعلى معايير الـ POS */}
      {/* ==================================================================== */}

      {/* نافذة: إيداع / سحب / تسجيل مصروف */}
      {(modalType === 'in' || modalType === 'out' || modalType === 'expense') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-surface rounded-2xl border border-line p-4 sm:p-5 max-w-md w-full space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                {modalType === 'in' && <PlusCircle className="w-5 h-5 text-emerald-600" />}
                {modalType === 'out' && <MinusCircle className="w-5 h-5 text-purple-600" />}
                {modalType === 'expense' && <Receipt className="w-5 h-5 text-rose-600" />}
                <h3 className="font-black text-base text-ink">
                  {modalType === 'in' && 'تسجيل إيداع نقدية في الدرج'}
                  {modalType === 'out' && 'تسجيل سحب نقدية من الدرج'}
                  {modalType === 'expense' && 'تسجيل مصروف من عهدة الدرج'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalType(null)}
                className="text-ink-muted hover:text-ink text-xs font-bold"
              >
                إغلاق âœ•
              </button>
            </div>

            <form onSubmit={handleSubmitMovement} className="space-y-4">
              {/* المبلغ */}
              <div>
                <label className="block text-xs font-bold text-ink mb-1.5">
                  المبلغ:
                </label>
                <input
                  type="number"
                  step="any"
                  autoFocus
                  required
                  placeholder="0.00"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  className="w-full py-3 px-4 text-lg font-black text-ink rounded-2xl bg-surface-2 border border-line focus:outline-none focus:border-brand-600 focus:bg-surface transition-all font-mono"
                />
              </div>

              {/* البند / التصنيف */}
              <div>
                <label className="block text-xs font-bold text-ink mb-1.5">البند والتصنيف:</label>
                <select
                  value={categoryInput}
                  onChange={(e) => setCategoryInput(e.target.value)}
                  className="w-full py-2.5 px-3 text-xs font-bold text-ink rounded-xl bg-surface-2 border border-line focus:outline-none focus:border-brand-600 focus:bg-surface"
                >
                  {modalType === 'in' &&
                    DEPOSIT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  {modalType === 'out' &&
                    WITHDRAW_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  {modalType === 'expense' &&
                    EXPENSE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                </select>
              </div>

              {/* البيان والتفاصيل */}
              <div>
                <label className="block text-xs font-bold text-ink mb-1.5">البيان / الملاحظة:</label>
                <input
                  type="text"
                  placeholder="مثال: شراء كراتين حليب، فكة إضافية..."
                  value={descriptionInput}
                  onChange={(e) => setDescriptionInput(e.target.value)}
                  className="w-full py-2.5 px-3 text-xs rounded-xl bg-surface-2 border border-line focus:outline-none focus:border-brand-600 focus:bg-surface font-medium"
                />
              </div>

              {/* زر الحفظ */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="flex-1 py-3 rounded-2xl border border-line bg-surface text-ink text-xs font-bold hover:bg-surface-2 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isAddingMovement}
                  className="flex-1 py-3 rounded-2xl bg-brand-700 hover:bg-brand-800 text-white text-xs font-black transition-colors shadow-xs"
                >
                  {isAddingMovement ? 'جاري الحفظ...' : 'تأكيد وحفظ الحركة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* نافذة: فتح شفت جديد */}
      {modalType === 'open' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-surface rounded-2xl border border-line p-4 sm:p-5 max-w-sm w-full space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center gap-2 border-b border-line pb-3">
              <Unlock className="w-5 h-5 text-emerald-600" />
              <h3 className="font-black text-base text-ink">فتح شفت كاشير جديد</h3>
            </div>

            <form onSubmit={handleOpenShift} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-ink mb-1.5">
                  الرصيد الافتتاحي للدرج (الفكة):
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  className="w-full py-3 px-4 text-lg font-black text-ink rounded-2xl bg-surface-2 border border-line focus:outline-none focus:border-brand-600 focus:bg-surface font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink mb-1.5">ملاحظات الفتح:</label>
                <input
                  type="text"
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  className="w-full py-2.5 px-3 text-xs rounded-xl bg-surface-2 border border-line focus:outline-none focus:border-brand-600 focus:bg-surface"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="flex-1 py-3 rounded-2xl border border-line bg-surface text-ink text-xs font-bold hover:bg-surface-2"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isOpening}
                  className="flex-1 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-xs"
                >
                  {isOpening ? 'جاري الفتح...' : 'بدء الشفت'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* نافذة: قفل الشفت ومطابقة النقدية (Reconciliation Modal) */}
      {modalType === 'close' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-surface rounded-2xl border border-line p-4 sm:p-5 max-w-md w-full space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-brand-700" />
                <h3 className="font-black text-base text-ink">قفل الشفت وجرد الدرج الفعلي</h3>
              </div>
              <button
                type="button"
                onClick={() => setModalType(null)}
                className="text-ink-muted hover:text-ink text-xs font-bold"
              >
                âœ•
              </button>
            </div>

            {/* تفاصيل المطابقة المالية اللحظية */}
            <div className="p-4 rounded-2xl bg-surface-2 border border-line space-y-2 text-xs">
              <div className="flex justify-between text-ink-muted">
                <span>الرصيد الافتتاحي:</span>
                <span className="font-mono font-bold text-ink">{formatCurrency(summary?.opening_cash || 0)}</span>
              </div>
              <div className="flex justify-between text-ink-muted">
                <span>مبيعات نقدي (كاش):</span>
                <span className="font-mono font-bold text-emerald-600">+{formatCurrency(summary?.cash_sales || 0)}</span>
              </div>
              <div className="flex justify-between text-ink-muted">
                <span>إجمالي السحوبات والمصروفات:</span>
                <span className="font-mono font-bold text-rose-600">âˆ’{formatCurrency(summary?.expenses_total || 0)}</span>
              </div>
              <div className="pt-2 border-t border-line flex justify-between font-black text-sm">
                <span>الرصيد المتوقع بالدرج:</span>
                <span className="text-brand-700 font-mono">{formatCurrency(expectedCash)}</span>
              </div>
            </div>

            <form onSubmit={handleCloseShift} className="space-y-4">
              {/* إدخال النقدية الفعلية بعد العد */}
              <div>
                <label className="block text-xs font-bold text-ink mb-1.5">
                  النقدية الفعلية المحصية بالدرج (العد الفعلي):
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  autoFocus
                  value={actualCashInput}
                  onChange={(e) => setActualCashInput(e.target.value)}
                  className="w-full py-3 px-4 text-xl font-black text-ink rounded-2xl bg-surface-2 border border-line focus:outline-none focus:border-brand-600 focus:bg-surface font-mono"
                />
              </div>

              {/* بار إيضاح الفرق المالي (عجز أو زيادة أو مطابق) */}
              <div
                className={`p-3 rounded-2xl border text-xs font-black flex items-center justify-between ${
                  variance === 0
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : variance > 0
                    ? 'bg-blue-50 text-blue-800 border-blue-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}
              >
                <span>حالة الجرد والمطابقة:</span>
                <span>
                  {variance === 0 && 'مطابق تماماً (لا يوجد عجز)'}
                  {variance > 0 && `يوجد زيادة في الدرج (+${formatCurrency(variance)})`}
                  {variance < 0 && `يوجد عجز في الدرج (${formatCurrency(variance)})`}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink mb-1.5">ملاحظات الإغلاق والتسليم:</label>
                <input
                  type="text"
                  placeholder="أي ملاحظات حول الجرد..."
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  className="w-full py-2.5 px-3 text-xs rounded-xl bg-surface-2 border border-line focus:outline-none focus:border-brand-600 focus:bg-surface"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="flex-1 py-3 rounded-2xl border border-line bg-surface text-ink text-xs font-bold hover:bg-surface-2"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isClosing}
                  className="flex-1 py-3 rounded-2xl bg-brand-700 hover:bg-brand-800 text-white text-xs font-black shadow-xs"
                >
                  {isClosing ? 'جاري القفل...' : 'تأكيد القفل وطباعة التقرير'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* نافذة: تقرير الـ Z-Report النهائي بعد الإغلاق */}
      {modalType === 'z-report' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-surface rounded-2xl border border-line p-4 sm:p-5 max-w-sm w-full space-y-4 shadow-2xl text-center animate-in zoom-in-95">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
            </div>
            <h3 className="text-lg font-black text-ink">تم إغلاق الشفت بنجاح!</h3>
            <p className="text-xs text-ink-muted leading-relaxed">
              تم ترحيل مبيعات الشفت إلى سجل التقارير المحاسبية وتم تصفير الدرج للشفت القادم.
            </p>
            <div className="p-3 rounded-2xl bg-surface-2 border border-line text-right text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-ink-muted">إجمالي المبيعات:</span>
                <span className="font-bold text-ink">{formatCurrency(summary?.sales_total || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">الرصيد الفعلي المسلم:</span>
                <span className="font-bold text-brand-700">{formatCurrency(countedCash)}</span>
              </div>
            </div>
            <button
              onClick={() => setModalType(null)}
              className="w-full py-3.5 rounded-2xl bg-brand-700 text-white font-extrabold text-xs shadow-xs"
            >
              تم ومتابعة العمل
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

