import React, { useCallback, useEffect, useState } from 'react';
import { supabase, isLiveSupabaseConfigured } from '@/lib/supabase';
import { posService, isPosDemoMode } from '@/services/pos.service';
import { formatCurrency } from '@/utils/formatters';
import { BarChart3, RefreshCw, AlertCircle } from 'lucide-react';

interface ShiftOption {
  id: string;
  status: string;
  opened_at: string;
}

export const Reports: React.FC = () => {
  const [shifts, setShifts] = useState<ShiftOption[]>([]);
  const [selectedShift, setSelectedShift] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [shiftReport, setShiftReport] = useState<any>(null);
  const [salesReport, setSalesReport] = useState<any>(null);
  const [sauceReport, setSauceReport] = useState<any[]>([]);

  // تحميل الشفتات
  useEffect(() => {
    if (isPosDemoMode) {
      setShifts([{ id: 'demo-shift-0001', status: 'open', opened_at: new Date().toISOString() }]);
      setSelectedShift('demo-shift-0001');
      return;
    }
    if (!isLiveSupabaseConfigured || !supabase) return;
    supabase
      .from('shifts')
      .select('id, status, opened_at')
      .order('opened_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        const list = (data || []) as ShiftOption[];
        setShifts(list);
        const open = list.find((s) => s.status === 'open') || list[0];
        if (open) setSelectedShift(open.id);
      });
  }, []);

  const loadReports = useCallback(async () => {
    if (!selectedShift) return;
    setIsLoading(true);
    setError(null);
    try {
      const [endReport, sales, sauces] = await Promise.all([
        posService.shiftEndReport(selectedShift),
        posService.itemSalesReport(selectedShift, null, null),
        posService.sauceConsumptionReport(selectedShift, null, null),
      ]);
      setShiftReport(endReport);
      setSalesReport(sales);
      setSauceReport(sauces);
    } catch (err: any) {
      setError(err.message || 'فشل تحميل التقارير');
    } finally {
      setIsLoading(false);
    }
  }, [selectedShift]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  if (!isLiveSupabaseConfigured && !isPosDemoMode) {
    return (
      <div className="py-16 text-center text-xs text-ink-muted bg-surface rounded-xl border border-line">
        التقارير تحتاج اتصال قاعدة البيانات (Supabase)
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      {/* الترويسة واختيار الشفت */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-line bg-surface p-3.5 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-800 flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-brand-700" />
          </div>
          <div>
            <h2 className="font-black text-sm sm:text-base text-ink">التقارير</h2>
            {isPosDemoMode && (
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">بيانات تجريبية للعرض</span>
            )}
            <p className="text-[11px] text-ink-muted">نهاية الشفت، مبيعات الأصناف، واستهلاك الصوصات</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <select
            value={selectedShift}
            onChange={(e) => setSelectedShift(e.target.value)}
            className="py-1.5 px-2.5 rounded-lg border border-line bg-surface text-xs font-bold text-ink focus:outline-none focus:border-brand-700"
          >
            {shifts.map((s) => (
              <option key={s.id} value={s.id}>
                شفت {new Date(s.opened_at).toLocaleDateString('ar-EG')}{' '}
                {new Date(s.opened_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                {s.status === 'open' ? ' (مفتوح)' : ''}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={loadReports}
            className="p-1.5 rounded-lg border border-line text-ink-muted hover:text-ink cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-2.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className="py-16 text-center text-xs text-ink-muted bg-surface rounded-xl border border-line">
          جاري تحميل التقارير...
        </div>
      ) : (
        <>
          {/* 1. تقرير نهاية الشفت */}
          {shiftReport && (
            <section className="rounded-xl border border-line bg-surface p-3.5 shadow-2xs space-y-3">
              <h3 className="font-extrabold text-sm text-ink border-b border-line pb-2">
                تقرير نهاية الشفت {shiftReport.status === 'open' ? '(شفت مفتوح)' : '(شفت مقفول)'}
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <StatCard label="عدد الأوردرات" value={String(shiftReport.orders?.count ?? 0)} />
                <StatCard label="إجمالي المبيعات" value={formatCurrency(shiftReport.orders?.net_total ?? 0)} />
                <StatCard label="الخصومات" value={formatCurrency(shiftReport.orders?.discounts ?? 0)} />
                <StatCard label="أوردرات ملغية" value={String(shiftReport.cancelled_orders ?? 0)} />
              </div>

              {/* المدفوعات بطريقة الدفع */}
              <div>
                <span className="text-xs font-extrabold text-ink block mb-1.5">المدفوعات بطريقة الدفع:</span>
                <div className="space-y-1">
                  {(shiftReport.payments_by_method || []).map((p: any) => (
                    <div key={p.method} className="flex items-center justify-between text-xs rounded-lg bg-surface-2/40 border border-line px-2.5 py-1.5">
                      <span className="font-bold text-ink">
                        {p.method} {p.is_cash ? '(كاش)' : '(إلكتروني)'} — {p.count} عملية
                      </span>
                      <span className="font-mono font-extrabold text-ink">{formatCurrency(p.total)}</span>
                    </div>
                  ))}
                  {(shiftReport.payments_by_method || []).length === 0 && (
                    <p className="text-[11px] text-ink-muted">لا توجد مدفوعات في هذا الشفت</p>
                  )}
                </div>
              </div>

              {/* الدرج */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-line">
                <StatCard label="عهدة أول الشفت" value={formatCurrency(shiftReport.opening_cash ?? 0)} />
                <StatCard label="حركات داخل" value={formatCurrency(shiftReport.movements_in ?? 0)} />
                <StatCard label="حركات خارج" value={formatCurrency(shiftReport.movements_out ?? 0)} />
                <StatCard
                  label="فرق الدرج"
                  value={
                    shiftReport.cash_difference != null ? formatCurrency(shiftReport.cash_difference) : '—'
                  }
                />
              </div>
            </section>
          )}

          {/* 2. تقرير الأصناف مقسمة */}
          {salesReport && (
            <section className="rounded-xl border border-line bg-surface p-3.5 shadow-2xs space-y-3">
              <h3 className="font-extrabold text-sm text-ink border-b border-line pb-2">مبيعات الأصناف</h3>

              {/* البوكسات */}
              <div>
                <span className="text-xs font-extrabold text-ink block mb-1.5">البوكسات (عدد مبيعات كل بوكس):</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(salesReport.donut_boxes || []).map((b: any) => (
                    <div key={b.name} className="p-2.5 rounded-lg bg-surface-2/40 border border-line text-center">
                      <div className="text-xs font-bold text-ink">{b.name}</div>
                      <div className="text-lg font-black text-brand-700 font-mono">{b.boxes}</div>
                      <div className="text-[10px] text-ink-muted font-mono">{formatCurrency(b.revenue)}</div>
                    </div>
                  ))}
                  {(salesReport.donut_boxes || []).length === 0 && (
                    <p className="text-[11px] text-ink-muted col-span-full">لا توجد مبيعات بوكسات</p>
                  )}
                </div>
              </div>

              {/* قطع الدونتس بالصوص */}
              <div>
                <span className="text-xs font-extrabold text-ink block mb-1.5">قطع الدونتس بالصوص (بالاسم):</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(salesReport.donut_pieces_by_sauce || []).map((s: any) => (
                    <div key={`${s.sauce}-${s.role}`} className="p-2.5 rounded-lg bg-surface-2/40 border border-line text-center">
                      <div className="text-xs font-bold text-ink">{s.sauce}</div>
                      <div className="text-[10px] text-ink-muted">{s.role === 'filling' ? 'حشوة' : 'توبنج'}</div>
                      <div className="text-lg font-black text-brand-700 font-mono">{s.pieces}</div>
                    </div>
                  ))}
                  {(salesReport.donut_pieces_by_sauce || []).length === 0 && (
                    <p className="text-[11px] text-ink-muted col-span-full">لا توجد قطع دونتس</p>
                  )}
                </div>
              </div>

              {/* الوافل والمشروبات وباقي الأصناف بالاسم */}
              <div>
                <span className="text-xs font-extrabold text-ink block mb-1.5">الوافل والمشروبات والأصناف (بالاسم لكل قطعة):</span>
                <div className="rounded-lg border border-line overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-surface-2/60 text-ink-muted border-b border-line">
                        <th className="py-2 px-2.5 text-right font-extrabold">القسم</th>
                        <th className="py-2 px-2.5 text-right font-extrabold">الصنف</th>
                        <th className="py-2 px-2.5 text-right font-extrabold">الحجم</th>
                        <th className="py-2 px-2.5 text-right font-extrabold">العدد</th>
                        <th className="py-2 px-2.5 text-right font-extrabold">المبيعات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(salesReport.items || []).map((it: any, idx: number) => (
                        <tr key={`${it.name}-${it.size || ''}-${idx}`} className="border-b border-line/60 last:border-0">
                          <td className="py-2 px-2.5 text-ink-muted">{it.department}</td>
                          <td className="py-2 px-2.5 font-bold text-ink">{it.name}</td>
                          <td className="py-2 px-2.5 text-ink">{it.size || '—'}</td>
                          <td className="py-2 px-2.5 font-mono font-extrabold text-brand-700">{it.quantity}</td>
                          <td className="py-2 px-2.5 font-mono font-bold text-ink">{formatCurrency(it.revenue)}</td>
                        </tr>
                      ))}
                      {(salesReport.items || []).length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-[11px] text-ink-muted">
                            لا توجد مبيعات أصناف
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {/* 3. استهلاك الصوصات */}
          <section className="rounded-xl border border-line bg-surface p-3.5 shadow-2xs space-y-3">
            <h3 className="font-extrabold text-sm text-ink border-b border-line pb-2">
              استهلاك الصوصات (محسوب من الرسبي × المبيعات)
            </h3>
            {sauceReport.length === 0 ? (
              <p className="text-[11px] text-ink-muted">
                لا يوجد استهلاك محسوب. جهّز وصفات الأصناف من لوحة الإدارة — تبويب الرسبي.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {sauceReport.map((s: any) => (
                  <div key={s.ingredient} className="p-2.5 rounded-lg bg-surface-2/40 border border-line text-center">
                    <div className="text-xs font-bold text-ink">{s.ingredient}</div>
                    <div className="text-lg font-black text-brand-700 font-mono">
                      {Number(s.total_consumed).toLocaleString('ar-EG')}
                    </div>
                    <div className="text-[10px] text-ink-muted">{s.unit}</div>
                    <div className="text-[10px] text-ink-dim mt-1">
                      {(s.breakdown || []).map((b: any) => `${b.target}: ${b.units}`).join(' | ')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="p-2.5 rounded-lg bg-surface-2/40 border border-line text-center">
    <div className="text-[10px] text-ink-muted font-bold">{label}</div>
    <div className="text-sm font-black text-ink font-mono mt-0.5">{value}</div>
  </div>
);
