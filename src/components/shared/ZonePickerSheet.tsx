import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { MapPin, X, Search, RefreshCw, AlertCircle } from 'lucide-react';
import { posService, DeliveryZone } from '@/services/pos.service';
import { formatCurrency } from '@/utils/formatters';

/** شاشة منبثقة طويلة من تحت لاختيار منطقة التوصيل: اختيار المنطقة يحدد رسوم التوصيل. */
export const ZonePickerSheet: React.FC<{
  selectedId?: string | null;
  onSelect: (zone: DeliveryZone) => void;
  onClose: () => void;
}> = ({ selectedId, onSelect, onClose }) => {
  const [zones, setZones] = useState<DeliveryZone[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');

  const load = useCallback(() => {
    setError(null);
    posService
      .listDeliveryZones()
      .then(setZones)
      .catch((e) => setError(e.message || 'تعذر تحميل المناطق'));
  }, []);
  useEffect(load, [load]);

  const shown = (zones || []).filter((z) => z.name.includes(q.trim()));

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl h-[85vh] bg-surface rounded-t-3xl shadow-2xl flex flex-col animate-in slide-in-from-bottom duration-300"
      >
        <div className="pt-2 pb-1 flex justify-center">
          <div className="w-10 h-1.5 rounded-full bg-stone-300" />
        </div>
        <div className="flex items-center justify-between px-4 pb-2 border-b border-line">
          <div className="flex items-center gap-2 font-black text-sm text-ink">
            <MapPin className="w-4 h-4 text-brand-700" />
            <span>اختار المنطقة</span>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-2 cursor-pointer" aria-label="إغلاق">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 pt-3">
          <div className="flex items-center rounded-xl border border-line bg-surface-2/50 focus-within:border-brand-700">
            <Search className="w-4 h-4 mx-2 text-ink-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ابحث باسم المنطقة"
              className="w-full py-2.5 pe-3 text-sm bg-transparent focus:outline-none font-bold text-ink"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {error && (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-bold text-rose-700">
              <span className="flex items-center gap-1.5"><AlertCircle className="w-4 h-4" />{error}</span>
              <button type="button" onClick={load} className="px-2.5 py-1 rounded-md bg-rose-700 text-white text-[11px] font-extrabold flex items-center gap-1 cursor-pointer">
                <RefreshCw className="w-3 h-3" /> إعادة المحاولة
              </button>
            </div>
          )}
          {!error && zones === null && <p className="text-center text-xs text-ink-muted py-8">جاري التحميل...</p>}
          {zones && zones.length === 0 && (
            <p className="text-center text-xs text-ink-muted py-8">لا توجد مناطق توصيل معرفة. أضفها من لوحة الإدارة، تبويب «مناطق التوصيل».</p>
          )}
          {shown.map((z) => (
            <button
              key={z.id}
              type="button"
              onClick={() => onSelect(z)}
              className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border text-sm font-extrabold transition-colors cursor-pointer ${
                selectedId === z.id
                  ? 'border-brand-700 bg-brand-50 text-brand-900'
                  : 'border-line bg-surface hover:bg-surface-2 text-ink'
              }`}
            >
              <span>{z.name}</span>
              <span className="font-mono text-brand-700">{formatCurrency(z.fee)}</span>
            </button>
          ))}
          {zones && zones.length > 0 && shown.length === 0 && (
            <p className="text-center text-xs text-ink-muted py-8">مفيش منطقة بالاسم ده</p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};
