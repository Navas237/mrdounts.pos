import React, { useState } from 'react';
import { useDonutInjection } from '@/hooks/useKitchen';
import { useStationPause } from '@/hooks/useStationPause';
import {
  Check,
  PauseCircle,
  PlayCircle,
  Syringe,
} from 'lucide-react';

export const DonutsInjectionKitchen: React.FC = () => {
  const { isPaused, pausedAt, togglePause } = useStationPause('donut_injection');
  const { injectionData, isLoading, isError, refetch, toggleSauce } = useDonutInjection(pausedAt);

  const [selectedSizeFilter, setSelectedSizeFilter] = useState<'all' | 'regular' | 'mini' | 'stuffed'>('all');

  if (isLoading) {
    return (
      <div className="py-20 text-center text-xs font-bold text-ink-muted">
        جاري تحميل بيانات محطة الحقن...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="py-20 text-center space-y-3">
        <p className="text-xs font-bold text-red-600">
          تعذر تحميل بيانات محطة الحقن. تحقق من الاتصال بالسيرفر.
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors cursor-pointer"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  // تصفية الصوصات بحسب الحجم والنوع
  const filteredSauces = injectionData.sauce_aggregates.filter((s) => {
    if (selectedSizeFilter === 'all') return true;
    return s.donut_type === selectedSizeFilter;
  });

  const queuedCount = injectionData.queued_orders_count || 0;

  return (
    <div className="space-y-3.5">
      
      {/* 1. الترويسة الرئيسية مع زر إيقاف / استئناف استلام الطلبات */}
      <div className="p-3 sm:p-3.5 rounded-xl bg-surface border border-line shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center font-bold shrink-0">
            <Syringe className="w-4 h-4" />
          </div>
          <div>
            <h1 className="font-extrabold text-sm sm:text-base text-ink">
              شاشة حقن وحشو الدونتس
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {/* زر إيقاف / استئناف استلام الطلبات */}
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
        </div>
      </div>

      {/* تنبيه حالة التوقف المؤقت وتجميد الأعداد */}
      {isPaused && (
        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-between gap-2 text-xs font-bold animate-in fade-in">
          <div className="flex items-center gap-2">
            <PauseCircle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              تم إيقاف استقبال الطلبات وتجميد أعداد القطع حتى تنتهي من الدفعة الحالية.
              {queuedCount > 0 ? ` (يوجد ${queuedCount} طلب جديد بانتظار الاستئناف)` : ' (لا توجد طلبات جديدة معلقة)'}
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

      {/* 2. شريط الإحصائيات السريعة لأعداد القطع المجمدة/الحالية */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 rounded-xl bg-surface border border-line shadow-2xs">
          <span className="text-xs font-bold text-ink-muted block">إجمالي الدونتس المطلوب</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl sm:text-2xl font-black text-ink font-mono">
              {injectionData.total_pieces}
            </span>
            <span className="text-xs text-ink-muted font-bold">قطعة</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200 shadow-2xs">
          <span className="text-xs font-bold text-amber-900 block">قطع محشية (تحتاج حقن)</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl sm:text-2xl font-black text-amber-800 font-mono">
              {injectionData.total_stuffed}
            </span>
            <span className="text-xs text-amber-700 font-bold">قطعة</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-surface border border-line shadow-2xs">
          <span className="text-xs font-bold text-ink-muted block">قطع سادة (بدون حشو)</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl sm:text-2xl font-black text-ink font-mono">
              {injectionData.total_plain}
            </span>
            <span className="text-xs text-ink-muted font-bold">قطعة</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-surface border border-line shadow-2xs">
          <span className="text-xs font-bold text-ink-muted block">الطلبات قيد التجهيز</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl sm:text-2xl font-black text-brand-700 font-mono">
              {injectionData.pending_orders_count}
            </span>
            <span className="text-xs text-ink-muted font-bold">طلب</span>
          </div>
        </div>
      </div>

      {/* 3. القسم الرئيسي: كروت صوصات الحقن (كام قطعة من كل صوص حشو) */}
      <div className="bg-surface rounded-2xl border border-line p-3.5 sm:p-4 space-y-3.5 shadow-2xs">
        
        {/* ترويسة القسم وأزرار التصفية بحسب الحجم */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-line">
          <div>
            <h2 className="text-sm sm:text-base font-black text-ink flex items-center gap-2">
              <span>كمية الحقن المطلوبة من كل صوص</span>
              <span className="text-xs font-normal text-ink-muted">
                (اضغط على الصوص لتحديده كمكتمل)
              </span>
            </h2>
          </div>

          <div className="flex items-center gap-1.5 bg-surface-2 p-1 rounded-xl border border-line">
            <button
              type="button"
              onClick={() => setSelectedSizeFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedSizeFilter === 'all'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              الكل ({injectionData.sauce_aggregates.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedSizeFilter('mini')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedSizeFilter === 'mini'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              ميني
            </button>
            <button
              type="button"
              onClick={() => setSelectedSizeFilter('stuffed')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedSizeFilter === 'stuffed'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              حشو
            </button>
            <button
              type="button"
              onClick={() => setSelectedSizeFilter('regular')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedSizeFilter === 'regular'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              عادي
            </button>
          </div>
        </div>

        {/* شبكة كروت صوصات الحقن صغيرة ومفصولة ومدمجة لشاشات المطبخ */}
        {filteredSauces.length === 0 ? (
          <div className="py-12 text-center text-xs text-ink-muted border border-dashed border-line rounded-xl">
            لا توجد قطع دونتس مطلوب حقنها حالياً
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
            {filteredSauces.map((sauce) => {
              const isPlain = sauce.sauce_name.includes('سادة');

              return (
                <div
                  key={sauce.key}
                  onClick={() => toggleSauce(sauce.key)}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer select-none flex items-center justify-between gap-2 shadow-2xs ${
                    sauce.is_completed
                      ? 'bg-emerald-50/70 border-emerald-300 opacity-60'
                      : isPlain
                      ? 'bg-surface-2/60 border-line hover:border-line-strong'
                      : 'bg-surface border-line hover:border-brand-600 hover:shadow-xs'
                  }`}
                  title={`${sauce.sauce_name} (${sauce.donut_type_label}) — اضغط لتأكيد الإنجاز`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border transition-colors ${
                        sauce.is_completed
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-surface-2 border-line text-transparent hover:text-stone-300'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </span>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3
                          className={`text-xs sm:text-sm font-black truncate leading-tight ${
                            sauce.is_completed ? 'line-through text-ink-muted' : 'text-ink'
                          }`}
                        >
                          {sauce.sauce_name}
                        </h3>
                        <span
                          className={`text-[10px] font-black px-1.5 py-0.5 rounded leading-none shrink-0 border ${
                            sauce.donut_type === 'mini'
                              ? 'bg-amber-50 text-amber-900 border-amber-200'
                              : sauce.donut_type === 'stuffed'
                              ? 'bg-rose-50 text-rose-900 border-rose-200'
                              : 'bg-stone-100 text-stone-800 border-stone-200'
                          }`}
                        >
                          {sauce.donut_type_label}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-left shrink-0 flex items-baseline gap-0.5 pl-1">
                    <span className="text-lg sm:text-xl font-black font-mono text-brand-700 leading-none">
                      {sauce.total_pieces}
                    </span>
                    <span className="text-[10px] font-bold text-ink-muted">قطع</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

    </div>
  );
};
