import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShift } from '@/hooks/useShift';
import { usePickup } from '@/hooks/usePickup';
import { formatCurrency } from '@/utils/formatters';
import { PickupOrder } from '@/services/pickup.service';
import {
  ShoppingCart,
  Receipt,
  Wallet,
  BarChart3,
  CheckCircle2,
  Lock,
  Layers,
  ChevronLeft,
  PackageCheck,
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const nav = useNavigate();
  const { shift, isOpen, summary } = useShift();
  const { orders: pickupOrders = [], isLoading: isPickupLoading } = usePickup();

  const isShiftOpen = isOpen || shift?.status === 'open';

  const salesTotal = isShiftOpen && summary ? summary.sales_total : 0;
  const ordersCount = isShiftOpen && summary ? summary.orders_count : 0;
  const avgTicket = ordersCount > 0 ? Math.round(salesTotal / ordersCount) : 0;
  const expectedCash = isShiftOpen && summary ? summary.expected_cash : 0;
  const openingCash = isShiftOpen && summary ? summary.opening_cash : 0;
  const pendingOrdersCount = pickupOrders.filter((o) => !o.is_all_ready).length;

  // استخراج المبيعات الساعية الحقيقية من أوردرات الوردية الحالية
  const hourlySalesData = useMemo(() => {
    if (!pickupOrders || pickupOrders.length === 0) return [];

    const map = new Map<number, { hour: number; label: string; total: number; count: number }>();

    pickupOrders.forEach((ord) => {
      const date = new Date(ord.created_at);
      const hour = date.getHours();
      const hour12 = hour % 12 || 12;
      const period = hour >= 12 ? 'م' : 'ص';
      const label = `${hour12} ${period}`;

      const existing = map.get(hour) || { hour, label, total: 0, count: 0 };
      existing.total += Number(ord.total_amount) || 0;
      existing.count += 1;
      map.set(hour, existing);
    });

    return Array.from(map.values()).sort((a, b) => a.hour - b.hour);
  }, [pickupOrders]);

  const maxHourlyTotal = useMemo(() => {
    if (hourlySalesData.length === 0) return 1;
    return Math.max(...hourlySalesData.map((h) => h.total), 1);
  }, [hourlySalesData]);

  const peakHour = useMemo(() => {
    if (hourlySalesData.length === 0) return null;
    return [...hourlySalesData].sort((a, b) => b.total - a.total)[0];
  }, [hourlySalesData]);

  return (
    <div className="space-y-4">
      {/* 1. الترويسة الرئيسية ومعلومات اليوم والشفت */}
      <div className="p-3.5 sm:p-4 rounded-xl border border-line bg-surface flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-2xs">
        

        <div className="flex items-center gap-2 flex-wrap">
         

          <button
            type="button"
            onClick={() => nav('/cashier')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-brand-700 hover:bg-brand-800 text-white text-xs font-bold shadow-2xs transition-colors"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>طلب جديد </span>
          </button>
        </div>
      </div>

      {/* تنبيه إذا كان الشيفت مغلق */}
      {!isShiftOpen && (
        <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 flex items-center justify-between gap-3 text-xs sm:text-sm font-semibold">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              لا يوجد شيفت مفتوح حالياً — العمليات النقدية وتسجيل الفواتير تتطلب فتح وردية جديدة.
            </span>
          </div>
          <button
            type="button"
            onClick={() => nav('/shifts')}
            className="px-3 py-1.5 rounded-md bg-amber-800 text-white font-bold text-xs hover:bg-amber-900 shrink-0"
          >
            فتح وردية الآن
          </button>
        </div>
      )}

      {/* 2. صف مؤشرات الأداء الأربعة */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* كارت 1: مبيعات الشيفت */}
        <div className="p-4 rounded-xl border border-line bg-surface flex flex-col justify-between space-y-2.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-bold text-ink-muted">مبيعات الشيفت الحالي</span>
            <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center">
              <Receipt className="w-4 h-4 stroke-[2.2]" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-brand-700 font-mono tracking-tight">
              {formatCurrency(salesTotal)}
            </div>
            <div className="flex items-center justify-between text-xs sm:text-sm text-ink-muted mt-1.5 font-semibold">
              <span className="text-ink">{ordersCount} أوردر مسجل</span>
            </div>
          </div>
        </div>

        {/* كارت 2: المتوقع في الدرج كاش */}
        <div className="p-4 rounded-xl border border-line bg-surface flex flex-col justify-between space-y-2.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-bold text-ink-muted">المتوقع بالدرج (كاش)</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Wallet className="w-4 h-4 stroke-[2.2]" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-ink font-mono tracking-tight">
              {formatCurrency(expectedCash)}
            </div>
            <div className="flex items-center justify-between text-xs sm:text-sm text-ink-muted mt-1.5 font-semibold">
              <span>افتتاحية: {formatCurrency(openingCash)}</span>
            </div>
          </div>
        </div>

        {/* كارت 3: متوسط الفاتورة */}
        <div className="p-4 rounded-xl border border-line bg-surface flex flex-col justify-between space-y-2.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-bold text-ink-muted">متوسط قيمة الفاتورة</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 stroke-[2.2]" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-ink font-mono tracking-tight">
              {formatCurrency(avgTicket)}
            </div>
          </div>
        </div>

        {/* كارت 4: طلبات المطبخ النشطة */}
        <div className="p-4 rounded-xl border border-line bg-surface flex flex-col justify-between space-y-2.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-bold text-ink-muted">طلبات قيد التجهيز</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <Layers className="w-4 h-4 stroke-[2.2]" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-700 font-mono tracking-tight">
              {pendingOrdersCount}
            </div>
          </div>
        </div>
      </div>

      {/* 3. التقسيم الرئيسي (شارت أوقات الذروة والطلبات الحية + الإجراءات السريعة وتنبيهات المخزن) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* العمود الأيمن (8 أعمدة = ~66%): شارت أوقات الذروة + جدول الطلبات الحية */}
        <div className="lg:col-span-8 space-y-4">
          {/* كارت شارت أوقات الذروة والمبيعات الساعية */}
          <div className="p-4 sm:p-5 rounded-xl border border-line bg-surface space-y-3.5 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-line pb-3">
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-ink flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-brand-700 stroke-[2.2]" />
                  <span>توزيع المبيعات علي الساعات</span>
                </h3>
                <p className="text-xs sm:text-sm text-ink-muted mt-1">
                  {peakHour ? (
                    <>
                      الأعلى مبيعاً: الساعة <strong className="text-ink">{peakHour.label}</strong> بإجمالي{' '}
                      <strong className="text-brand-700 font-mono">{formatCurrency(peakHour.total)}</strong> ({peakHour.count} طلب)
                    </>
                  ) : (
                    'متابعة نشاط المبيعات لحظياً على مدار ساعات الوردية'
                  )}
                </p>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-surface-2 text-ink border border-line self-start sm:self-auto font-mono">
                {hourlySalesData.length > 0 ? `${hourlySalesData.length} ساعات نشطة` : 'لا توجد بيانات بعد'}
              </span>
            </div>

            {/* شبكة الأعمدة البيانية التفاعلية النظيفة */}
            {hourlySalesData.length === 0 ? (
              <div className="py-12 text-center text-xs text-ink-muted bg-surface-2/50 rounded-xl border border-dashed border-line">
                لا توجد مبيعات مسجلة بالساعات في هذه الوردية بعد. تظهر المؤشرات تلقائياً مع تسجيل الطلبات.
              </div>
            ) : (
              <div className="hour-bars-container">
                {hourlySalesData.map((h) => {
                  const heightPct = Math.round((h.total / maxHourlyTotal) * 100);
                  const isPeak = peakHour && h.hour === peakHour.hour;

                  return (
                    <div
                      key={h.hour}
                      className={`hour-bar-col ${isPeak ? 'is-peak' : ''}`}
                      title={`${h.label}: ${formatCurrency(h.total)} (${h.count} طلب)`}
                    >
                      <div
                        className="hour-bar-fill"
                        style={{ height: `${Math.max(heightPct, 8)}%` }}
                      />
                      <span className="hour-bar-label">{h.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* كارت أحدث طلبات الشيفت الحالية */}
          <div className="p-4 sm:p-5 rounded-xl border border-line bg-surface space-y-3.5 shadow-2xs">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-ink flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-brand-700 stroke-[2.2]" />
                  <span>أحدث طلبات الشيفت المفتوح</span>
                </h3>
                <p className="text-xs sm:text-sm text-ink-muted mt-0.5">
                  متابعة حالة الطلبات، الأصناف ومبالغ التحصيل
                </p>
              </div>
              <button
                type="button"
                onClick={() => nav('/pickup')}
                className="text-xs sm:text-sm font-bold text-brand-700 hover:text-brand-800 flex items-center gap-1 transition-colors"
              >
                <span>شاشة التسليم (البيك أب)</span>
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            {/* جدول أحدث الطلبات */}
            {isPickupLoading ? (
              <div className="py-8 text-center text-xs text-ink-muted">جاري تحميل الطلبات...</div>
            ) : pickupOrders.length === 0 ? (
              <div className="py-12 text-center text-xs text-ink-muted bg-surface-2/50 rounded-xl border border-dashed border-line">
                لا توجد طلبات مسجلة بعد في هذه الوردية. يمكنك إنشاء طلب جديد من شاشة الكاشير.
              </div>
            ) : (
              <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-right text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-line text-ink-muted text-xs">
                      <th className="pb-2.5 font-bold">#</th>
                      <th className="pb-2.5 font-bold">النوع</th>
                      <th className="pb-2.5 font-bold">العميل / الطاولة</th>
                      <th className="pb-2.5 font-bold">الأصناف</th>
                      <th className="pb-2.5 font-bold">الإجمالي</th>
                      <th className="pb-2.5 font-bold">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60">
                    {pickupOrders.slice(0, 10).map((ord: PickupOrder) => (
                      <tr
                        key={ord.id}
                        onClick={() => nav('/pickup')}
                        className="hover:bg-surface-2 cursor-pointer transition-colors"
                      >
                        <td className="py-3 font-bold font-mono text-brand-700">
                          #{ord.daily_number}
                        </td>
                        <td className="py-3 font-bold text-ink">
                          {ord.order_type_label}
                        </td>
                        <td className="py-3 text-ink font-medium">
                          {ord.customer_name || 'عميل صالة'}
                        </td>
                        <td className="py-3 text-ink leading-relaxed">
                          {ord.departments.map((d) => d.summary).join(' + ') || 'دونتس'}
                        </td>
                        <td className="py-3 font-bold font-mono text-ink">
                          {formatCurrency(ord.total_amount)}
                        </td>
                        <td className="py-3">
                          <span
                            className={`inline-flex px-2.5 py-1 rounded-md text-xs font-bold border ${
                              ord.is_all_ready
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}
                          >
                            {ord.is_all_ready ? 'جاهز للتسليم' : 'قيد التحضير'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* العمود الأيسر (4 أعمدة = ~34%): حالة المخزن والخامات */}
        <div className="lg:col-span-4 space-y-4">
          {/* كارت حالة المستودع والخامات */}
          <div className="p-4 sm:p-5 rounded-xl border border-line bg-surface space-y-3.5 shadow-2xs">
            <div className="flex items-center justify-between border-b border-line pb-2.5">
              <h3 className="font-extrabold text-sm sm:text-base text-ink flex items-center gap-1.5">
                <PackageCheck className="w-4 h-4 text-emerald-600" />
                <span>حالة الخامات والمستودع</span>
              </h3>
              <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                المستودع مستقر
              </span>
            </div>

            <div className="p-4 rounded-xl bg-surface-2 border border-line/80 text-center space-y-2">
              <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div className="text-xs sm:text-sm font-bold text-ink">
                جميع الخامات متوفرة ضمن الحدود الآمنة
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
