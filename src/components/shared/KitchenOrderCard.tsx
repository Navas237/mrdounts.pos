import React, { useState } from 'react';
import { KitchenItem } from '@/services/kitchen.service';
import { StatusBadge } from './StatusBadge';
import { formatTime } from '@/utils/formatters';
import { CheckCircle, Play, Printer, Check } from 'lucide-react';
import { LabelPreviewModal } from './LabelPreviewModal';
import { PermissionGate } from './PermissionGate';

export interface KitchenOrderGroup {
  order_id: string;
  order_daily_number: number;
  order_type: string;
  created_at: string;
  items: KitchenItem[];
}

interface KitchenOrderCardProps {
  orderGroup?: KitchenOrderGroup;
  item?: KitchenItem;
  departmentName: string;
  onStart: (itemId: string) => Promise<void>;
  onFinish: (itemId: string) => Promise<void>;
}

export const KitchenOrderCard: React.FC<KitchenOrderCardProps> = ({
  orderGroup,
  item,
  departmentName,
  onStart,
  onFinish,
}) => {
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);

  // دعم التوافق سواء تم تمرير مجموعة أوردر كاملة أو صنف فردي
  const group: KitchenOrderGroup = orderGroup || {
    order_id: item?.order_id || '',
    order_daily_number: item?.order_daily_number || 1,
    order_type: item?.order_type || 'صالة',
    created_at: item?.created_at || new Date().toISOString(),
    items: item ? [item] : [],
  };

  const { items, order_daily_number, order_type, created_at } = group;

  // تقييم حالة الكارد الإجمالية
  const hasPreparing = items.some((i) => i.status === 'preparing');
  const allReady = items.length > 0 && items.every((i) => i.status === 'ready');
  const allPending = items.every((i) => i.status === 'pending');
  const cardStatus = allReady
    ? 'ready'
    : hasPreparing || items.some((i) => i.status === 'ready')
    ? 'preparing'
    : 'pending';

  const isPreparing = cardStatus === 'preparing';

  // معالجة بدء تحضير كافة الأصناف غير المبدوءة في هذا الأوردر
  const handleStartAll = async () => {
    const pendingItems = items.filter((i) => i.status === 'pending');
    await Promise.all(pendingItems.map((i) => onStart(i.id)));
  };

  // معالجة تسليم كافة الأصناف الجاهزة في هذا الأوردر
  const handleFinishAll = async () => {
    const unfinishedItems = items.filter((i) => i.status !== 'ready');
    await Promise.all(unfinishedItems.map((i) => onFinish(i.id)));
  };

  return (
    <>
      <div
        className={`rounded-xl bg-surface p-3 sm:p-3.5 shadow-2xs space-y-2.5 border transition-all ${
          isPreparing ? 'border-brand-600 ring-1 ring-brand-600/30 shadow-xs' : 'border-line'
        }`}
      >
        {/* ترويسة بطاقة الأوردر الموحدة */}
        <div className="flex items-center justify-between border-b border-line pb-2">
          <div>
            <span className="text-xs font-bold text-ink-muted">{order_type}</span>
            <h3 className="text-base font-black text-brand-700">أوردر #{order_daily_number}</h3>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-ink-muted font-mono">{formatTime(created_at)}</span>
            <StatusBadge status={cardStatus} size="sm" />
          </div>
        </div>

        {/* قائمة كافة أصناف هذا الأوردر في هذا القسم */}
        <div className="space-y-2.5 divide-y divide-line/60">
          {items.map((it, idx) => (
            <div key={it.id} className={idx > 0 ? 'pt-2.5' : ''}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {items.length > 1 && (
                      <span className="w-5 h-5 rounded-full bg-surface-2 text-ink text-[11px] font-black flex items-center justify-center shrink-0 border border-line">
                        {idx + 1}
                      </span>
                    )}
                    <h4 className="font-extrabold text-sm text-ink">{it.item_name}</h4>
                    {it.size_name && (
                      <span className="text-xs font-semibold text-brand-800 bg-brand-50 px-1.5 py-0.5 rounded inline-block">
                        الحجم: {it.size_name}
                      </span>
                    )}
                  </div>

                  {it.options.length > 0 && (
                    <p className="text-xs text-brand-700 font-bold mt-1 pr-1">
                      الإضافات: {it.options.map((o) => o.name).join(' + ')}
                    </p>
                  )}

                  {it.notes && (
                    <div className="mt-1.5 text-xs text-ink-muted bg-surface-2 p-1.5 rounded-lg border border-line">
                      <span className="font-bold text-ink">ملاحظة: </span>
                      {it.notes}
                    </div>
                  )}
                </div>

                {/* زر مستقل للصنف الفردي في حال رغب الشيف في تحضير صنف قبل صنف */}
                {items.length > 1 && (
                  <div className="shrink-0 pt-0.5">
                    <PermissionGate action="kitchen.prepare">
                      {it.status === 'pending' ? (
                        <button
                          type="button"
                          onClick={() => onStart(it.id)}
                          className="px-2 py-1 rounded-lg bg-surface-2 hover:bg-brand-700 hover:text-white text-ink text-xs font-bold transition-colors border border-line flex items-center gap-1 shadow-2xs"
                          title="بدء تحضير هذا الصنف فقط"
                        >
                          <Play className="w-3 h-3 text-brand-700 hover:text-white" />
                          <span className="text-[10px]">بدء</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onFinish(it.id)}
                          className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-700 text-xs font-bold transition-colors border border-emerald-200 flex items-center gap-1 shadow-2xs"
                          title="تسليم هذا الصنف فقط"
                        >
                          <Check className="w-3 h-3 text-emerald-600 hover:text-white" />
                          <span className="text-[10px]">جاهز</span>
                        </button>
                      )}
                    </PermissionGate>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* أزرار الإجراءات الرئيسية للأوردر بالكامل */}
        <div className="pt-2 border-t border-line flex gap-1.5">
          <PermissionGate action="kitchen.prepare">
            {allPending ? (
              <button
                type="button"
                onClick={handleStartAll}
                className="flex-1 py-2 px-3 rounded-lg bg-brand-700 hover:bg-brand-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 touch-target transition-colors shadow-2xs active:scale-98"
              >
                <Play className="w-3.5 h-3.5" />
                <span>
                  {items.length > 1 ? `بدء التحضير (${items.length} أصناف)` : 'بدء التحضير'}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinishAll}
                className="flex-1 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 touch-target transition-colors shadow-2xs active:scale-98"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>
                  {items.length > 1 ? `جاهز للتسليم (${items.length} أصناف)` : 'جاهز للتسليم'}
                </span>
              </button>
            )}
          </PermissionGate>

          <button
            type="button"
            aria-label="معاينة وطباعة ملصق الصنف"
            onClick={() => setIsLabelModalOpen(true)}
            className="p-2 rounded-lg border border-line bg-surface hover:bg-surface-2 text-ink-muted hover:text-ink touch-target transition-colors shadow-2xs"
            title="طباعة بون الأصناف"
          >
            <Printer className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <LabelPreviewModal
        isOpen={isLabelModalOpen}
        onClose={() => setIsLabelModalOpen(false)}
        orderNumber={order_daily_number}
        itemName={items.map((i) => `${i.item_name}${i.size_name ? ` (${i.size_name})` : ''}`).join(' + ')}
        departmentName={departmentName}
      />
    </>
  );
};
