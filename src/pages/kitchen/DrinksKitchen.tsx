import React from 'react';
import { useKitchen } from '@/hooks/useKitchen';
import { useStationPause } from '@/hooks/useStationPause';
import { Coffee, Printer, PauseCircle, PlayCircle } from 'lucide-react';
import { KitchenOrderCard } from '@/components/shared/KitchenOrderCard';

export const DrinksKitchen: React.FC = () => {
  const { items, isLoading, startItem, finishItem } = useKitchen('مشروبات');
  const { isPaused, pausedAt, togglePause } = useStationPause('drinks');

  // عند الإيقاف المؤقت، يتم تجميد الطلبات الحالية ولا يزيد العدد مع دخول طلبات جديدة
  const visibleItems = isPaused && pausedAt
    ? items.filter((i) => !i.created_at || new Date(i.created_at).getTime() <= new Date(pausedAt).getTime())
    : items;
  const queuedCount = items.length - visibleItems.length;

  // تجميع كافة أصناف نفس الأوردر معاً لتظهر في بطاقة واحدة جامعة (يُستدعى في أعلى المستوى دائماً)
  const groupedOrders = React.useMemo(() => {
    const map = new Map<string, {
      order_id: string;
      order_daily_number: number;
      order_type: string;
      created_at: string;
      items: typeof visibleItems;
    }>();

    for (const item of visibleItems) {
      const key = item.order_id || `order-${item.order_daily_number}`;
      const existing = map.get(key);
      if (existing) {
        existing.items.push(item);
      } else {
        map.set(key, {
          order_id: item.order_id,
          order_daily_number: item.order_daily_number,
          order_type: item.order_type,
          created_at: item.created_at,
          items: [item],
        });
      }
    }

    return Array.from(map.values());
  }, [visibleItems]);

  if (isLoading) {
    return <div className="p-8 text-center text-xs text-ink-muted">جاري تحميل طلبات بار المشروبات...</div>;
  }

  return (
    <div className="space-y-3.5">
      {/* هيدر قسم المشروبات المدمج مع زر إيقاف / استئناف الاستلام */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 sm:p-3.5 rounded-xl bg-surface border border-line shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-800 text-white flex items-center justify-center font-bold shrink-0">
            <Coffee className="w-4 h-4" />
          </div>
          <div>
            <h1 className="font-extrabold text-sm sm:text-base text-ink">بار المشروبات (الباريستا)</h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* زر إيقاف / استئناف استلام طلبات المشروبات */}
          <button
            type="button"
            onClick={togglePause}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer ${
              isPaused
                ? 'bg-amber-600 hover:bg-amber-700 text-white animate-pulse'
                : 'bg-surface hover:bg-surface-2 border border-line text-ink'
            }`}
          >
            {isPaused ? (
              <>
                <PlayCircle className="w-4 h-4" />
                <span>استئناف استلام الطلبات {queuedCount > 0 ? `(${queuedCount} بالانتظار)` : ''}</span>
              </>
            ) : (
              <>
                <PauseCircle className="w-4 h-4 text-amber-600" />
                <span>إيقاف استلام الطلبات مؤقتاً</span>
              </>
            )}
          </button>

          <span className="px-2.5 py-1 rounded-md bg-surface-2 border border-line text-xs font-bold text-ink flex items-center gap-1.5">
            <Printer className="w-3.5 h-3.5 text-ink-muted" />
            <span>الطابعة: متصلة</span>
          </span>
          <span className="px-2.5 py-1 rounded-md bg-surface-2 text-ink border border-line text-xs font-bold font-mono">
            النشط: {groupedOrders.length} أوردر ({visibleItems.length} صنف)
          </span>
        </div>
      </div>

      {/* تنبيه تجميد الأعداد عند التوقف المؤقت */}
      {isPaused && (
        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-between gap-2 text-xs font-bold animate-in fade-in">
          <div className="flex items-center gap-2">
            <PauseCircle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              تم إيقاف استقبال طلبات المشروبات وتجميد العدد الحالي حتى تنتهي.
              {queuedCount > 0 ? ` (يوجد ${queuedCount} طلب مشروبات جديد في الانتظار)` : ' (لا توجد طلبات جديدة معلقة)'}
            </span>
          </div>
          <button
            type="button"
            onClick={togglePause}
            className="px-2.5 py-1 rounded bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold transition-colors shrink-0 cursor-pointer"
          >
            فتح واستئناف الآن
          </button>
        </div>
      )}

      {/* بطاقات طلبات المشروبات عالية الكثافة - مجمعة حسب الأوردر */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {groupedOrders.length === 0 ? (
          <div className="col-span-full py-12 text-center text-xs text-ink-muted bg-surface rounded-xl border border-dashed border-line">
            {isPaused && queuedCount > 0
              ? `تم الانتهاء من الطلبات المجمدة! يوجد (${queuedCount}) طلبات جديدة بالانتظار — اضغط على "استئناف استلام الطلبات" لفتحها.`
              : 'لا توجد طلبات مشروبات حالياً.'}
          </div>
        ) : (
          groupedOrders.map((group) => (
            <KitchenOrderCard
              key={group.order_id || `order-${group.order_daily_number}`}
              orderGroup={group}
              departmentName="مشروبات"
              onStart={startItem}
              onFinish={finishItem}
            />
          ))
        )}
      </div>
    </div>
  );
};
