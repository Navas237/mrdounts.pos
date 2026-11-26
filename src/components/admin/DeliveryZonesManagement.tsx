import React, { useCallback, useEffect, useState } from 'react';
import { posService, DeliveryZone } from '@/services/pos.service';
import { formatCurrency } from '@/utils/formatters';
import { Plus, Trash2, AlertCircle, Check } from 'lucide-react';

export const DeliveryZonesManagement: React.FC = () => {
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [name, setName] = useState('');
  const [fee, setFee] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [edits, setEdits] = useState<Record<string, { name: string; fee: string }>>({});

  const load = useCallback(async () => {
    try {
      setZones(await posService.listDeliveryZones(true));
    } catch (e: any) {
      setMessage(e.message || 'فشل تحميل المناطق');
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const run = async (fn: () => Promise<void>, fail: string) => {
    setBusy(true); setMessage(null);
    try { await fn(); await load(); } catch (e: any) { setMessage(e.message || fail); } finally { setBusy(false); }
  };

  const add = () => {
    const f = Number(fee);
    if (!name.trim() || !(f >= 0) || fee.trim() === '') { setMessage('اكتب اسم المنطقة والرسوم'); return; }
    run(async () => {
      await posService.saveDeliveryZone({ name: name.trim(), fee: f, sort_order: zones.length + 1 });
      setName(''); setFee('');
    }, 'فشل إضافة المنطقة');
  };

  return (
    <div className="space-y-3">
      <div className="border-b border-line pb-2.5">
        <h3 className="text-sm font-extrabold text-ink">مناطق التوصيل ورسومها</h3>
        <p className="text-[11px] text-ink-muted">الكاشير يختار المنطقة والرسوم تنزل تلقائي. الرسوم تتحدد من هنا فقط وتتحقق في السيرفر.</p>
      </div>
      {message && (
        <div className="p-2.5 rounded-xl border border-brand-200 bg-brand-50 text-brand-900 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /><span>{message}</span>
        </div>
      )}
      <div className="space-y-1.5">
        {zones.map((z) => {
          const e = edits[z.id];
          const dirty = e && (e.name !== z.name || Number(e.fee) !== Number(z.fee));
          return (
            <div key={z.id} className="flex items-center gap-1.5 p-2 rounded-lg border border-line bg-surface-2/40">
              <input
                value={e ? e.name : z.name}
                onChange={(ev) => setEdits({ ...edits, [z.id]: { name: ev.target.value, fee: e ? e.fee : String(z.fee) } })}
                className="flex-1 py-1.5 px-2.5 rounded-lg border border-line bg-surface text-xs font-bold text-ink"
              />
              <input
                value={e ? e.fee : String(z.fee)}
                inputMode="decimal"
                dir="ltr"
                onChange={(ev) => setEdits({ ...edits, [z.id]: { name: e ? e.name : z.name, fee: ev.target.value } })}
                className="w-20 py-1.5 px-2 rounded-lg border border-line bg-surface text-xs font-bold text-ink text-center"
              />
              <span className="text-[11px] text-ink-muted w-14">{formatCurrency(Number(e ? e.fee : z.fee) || 0)}</span>
              {dirty && (
                <button
                  type="button" disabled={busy}
                  onClick={() => run(async () => {
                    await posService.saveDeliveryZone({ id: z.id, name: e.name.trim(), fee: Number(e.fee), sort_order: z.sort_order, is_active: z.is_active });
                    setEdits(({ [z.id]: _drop, ...rest }) => rest);
                  }, 'فشل حفظ التعديل')}
                  className="p-1.5 rounded-lg bg-emerald-700 text-white cursor-pointer" title="حفظ"
                ><Check className="w-3.5 h-3.5" /></button>
              )}
              <button
                type="button" disabled={busy}
                onClick={() => { if (confirm(`حذف منطقة ${z.name}؟ الأوردرات القديمة تحتفظ باسمها.`)) run(() => posService.deleteDeliveryZone(z.id), 'فشل الحذف'); }}
                className="p-1.5 text-stone-400 hover:text-rose-600 cursor-pointer" title="حذف"
              ><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          );
        })}
        {zones.length === 0 && <p className="text-[11px] text-ink-muted py-4 text-center">لا توجد مناطق بعد. أضف أول منطقة بالأسفل.</p>}
      </div>
      <div className="flex items-center gap-1.5 pt-2 border-t border-line">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم المنطقة (مثال: سيدي بشر)"
          className="flex-1 py-1.5 px-2.5 rounded-lg border border-line bg-surface text-xs font-bold text-ink focus:outline-none focus:border-brand-700" />
        <input value={fee} onChange={(e) => setFee(e.target.value)} placeholder="الرسوم" inputMode="decimal" dir="ltr"
          className="w-24 py-1.5 px-2 rounded-lg border border-line bg-surface text-xs font-bold text-ink text-center focus:outline-none focus:border-brand-700" />
        <button type="button" onClick={add} disabled={busy}
          className="py-1.5 px-4 rounded-lg bg-brand-700 hover:bg-brand-800 text-white text-xs font-extrabold flex items-center gap-1 disabled:opacity-40 cursor-pointer">
          <Plus className="w-3.5 h-3.5" /><span>إضافة</span>
        </button>
      </div>
    </div>
  );
};
