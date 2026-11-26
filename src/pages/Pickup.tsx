import React from 'react';
import { usePickup } from '@/hooks/usePickup';
import { formatCurrency, formatTime } from '@/utils/formatters';
import { PackageCheck, Check, Clock, MapPin } from 'lucide-react';
import { PermissionGate } from '@/components/shared/PermissionGate';

export const Pickup: React.FC = () => {
  const { orders, isLoading, deliverOrder, deliverError, resetDeliverError, isDelivering } = usePickup();

  if (isLoading) {
    return <div className="p-8 text-center text-xs text-ink-muted">جاري تحميل أوردرات محطة التجميع...</div>;
  }

  return (
    <div className="space-y-3.5">
      {/* هيدر محطة البيك أب المدمج */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 sm:p-3.5 rounded-2xl bg-surface border border-line shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-bold shadow-2xs shrink-0">
            <PackageCheck className="w-4 h-4" />
          </div>
          <div>
            <h1 className="font-extrabold text-sm sm:text-base text-ink">محطة البيك أب والتسليم</h1>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs font-bold text-ink flex-wrap">
          <span className="px-2.5 py-1 rounded-lg bg-surface-2 border border-line text-xs">
            النشط: {orders.length}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs">
            جاهز للتسليم: {orders.filter((o) => o.is_all_ready).length}
          </span>
        </div>
      </div>

      {/* فشل التسليم يظهر هنا ويبقى الأوردر في القائمة */}
      {deliverError && (
        <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-bold">
          <span>تعذر تسليم الأوردر: {deliverError.message}</span>
          <button type="button" onClick={resetDeliverError} className="shrink-0 underline">إخفاء</button>
        </div>
      )}

      {/* بطاقات تجميع الأوردرات عالية الكثافة */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {orders.length === 0 ? (
          <div className="col-span-full py-12 text-center text-xs text-ink-muted bg-surface rounded-xl border border-dashed border-line">
            لا توجد أوردرات نشطة بانتظار التجميع حالياً.
          </div>
        ) : (
          orders.map((order) => (
            <div
              key={order.id}
              className={`rounded-xl bg-surface p-3 sm:p-3.5 shadow-2xs space-y-3 border transition-all ${
                order.is_all_ready
                  ? 'border-emerald-500 ring-1 ring-emerald-500/20 shadow-xs'
                  : 'border-line'
              }`}
            >
              <div className="flex items-center justify-between border-b border-line pb-2">
                <div>
                  <span className="text-xs font-bold text-ink-muted">
                    {order.order_type_label}
                  </span>
                  <h3 className="text-base font-black text-brand-700">أوردر #{order.daily_number}</h3>
                </div>
                <div className="text-right">
                  <span className="text-xs font-black text-ink block">
                    {formatCurrency(order.total_amount)}
                  </span>
                  <span className="text-xs text-ink-muted font-mono">{formatTime(order.created_at)}</span>
                </div>
              </div>

              {/* بيانات العميل والتوصيل إن وجدت */}
              {(order.customer_name || order.customer_phone) && (
                <div className="p-2 rounded-lg bg-surface-2 text-xs space-y-0.5">
                  <div className="flex items-center justify-between font-bold text-ink">
                    <span>{order.customer_name || 'عميل'}</span>
                    {order.customer_phone && (
                      <span className="font-mono text-ink-muted text-xs" dir="ltr">
                        {order.customer_phone}
                      </span>
                    )}
                  </div>
                  {order.delivery_address && (
                    <div className="text-xs text-ink-muted flex items-center gap-1">
                      <MapPin className="w-2.5 h-2.5 text-brand-700 shrink-0" />
                      <span className="truncate">{order.delivery_address}</span>
                    </div>
                  )}
                </div>
              )}

              {/* قائمة جاهزية أقسام الأوردر */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-ink-muted block">أقسام الأوردر:</span>
                {order.departments.map((dept) => (
                  <div
                    key={dept.department_name}
                    className={`flex items-center justify-between p-2 rounded-lg border text-xs transition-colors ${
                      dept.is_ready
                        ? 'bg-emerald-50/70 border-emerald-200/60 text-emerald-900'
                        : 'bg-amber-50/70 border-amber-200/60 text-amber-900'
                    }`}
                  >
                    <div className="font-bold flex items-center gap-1.5 truncate">
                      <span>{dept.department_name}:</span>
                      <span className="font-normal opacity-90 truncate max-w-[150px] text-xs">
                        {dept.summary}
                      </span>
                    </div>

                    <div className="shrink-0 font-extrabold flex items-center gap-1 text-xs">
                      {dept.is_ready ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />
                          <span>جاهز</span>
                        </>
                      ) : (
                        <>
                          <Clock className="w-3 h-3 text-amber-600 animate-spin" />
                          <span>بالمطبخ</span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* زر التسليم محمي بصلاحية order.deliver */}
              <PermissionGate action="order.deliver">
                <button
                  type="button"
                  disabled={!order.is_all_ready || isDelivering}
                  onClick={() => deliverOrder(order.id)}
                  className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 touch-target ${
                    order.is_all_ready
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs active:scale-98'
                      : 'bg-surface-2 text-ink-muted border border-line cursor-not-allowed opacity-50'
                  }`}
                >
                  <PackageCheck className="w-3.5 h-3.5" />
                  <span>
                    {order.is_all_ready ? 'تسليم الأوردر للعميل' : 'في انتظار اكتمال الأقسام'}
                  </span>
                </button>
              </PermissionGate>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

