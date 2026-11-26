import React, { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Check, ImagePlus, Trash2 } from 'lucide-react';
import { posService, DEFAULT_RECEIPT_SETTINGS, ReceiptSettings } from '@/services/pos.service';
import { RECEIPT_SETTINGS_KEY } from '@/hooks/useReceiptSettings';
import { ThermalReceiptDoc, ReceiptData } from '@/components/shared/ThermalReceipt';

const MAX_LINES = 8;

/** تصغير الصورة المرفوعة لعرض أقصى 384px وحفظها كصورة صغيرة (data URL) عشان تتطبع بدون اعتماد على رابط خارجي */
async function fileToLogoDataUrl(file: File): Promise<string> {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error('الصورة لازم PNG أو JPG أو WEBP');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('تعذر قراءة الصورة'));
      i.src = url;
    });
    const scale = Math.min(1, 384 / img.width);
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.width * scale));
    c.height = Math.max(1, Math.round(img.height * scale));
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}

const SAMPLE: Record<'dine_in' | 'takeaway' | 'delivery', ReceiptData> = (() => {
  const base = {
    branch: { name: 'MR DONUTS', phone: '01012345678', address: 'شارع الجمهورية - الفرع الرئيسي' },
    order_number: 1042,
    created_at: new Date().toISOString(),
    items: [
      { name: 'بوكس 6 عادي', qty: 1, unit_price: 120, line_total: 120, extras: [{ name: 'لوتس', qty: 2, price: 5 }], notes: undefined },
      { name: 'وافل نوتيلا', qty: 1, unit_price: 65, line_total: 65, extras: [] },
    ].map((i: any) => ({ ...i, line_total: i.line_total + i.extras.reduce((s: number, e: any) => s + e.qty * e.price, 0) })),
    subtotal: 195, discount: 0, tax: 0, delivery_fee: 0, total: 195,
    payments: [{ method: 'نقدي', amount: 200 }],
  };
  return {
    dine_in: { ...base, order_type: 'dine_in' },
    takeaway: { ...base, order_type: 'takeaway' },
    delivery: {
      ...base, order_type: 'delivery', customer_name: 'منى', customer_phone: '01000000000', zone: 'سيدي بشر',
      address: '12 شارع الجمهورية، برج النور', delivery_fee: 15, total: 210, payments: [{ method: 'نقدي', amount: 210 }],
    },
  } as any;
})();

const LinesEditor: React.FC<{
  label: string; hint?: string; lines: string[]; onChange: (l: string[]) => void;
}> = ({ label, hint, lines, onChange }) => (
  <div className="space-y-1.5">
    <div>
      <div className="text-xs font-extrabold text-ink">{label}</div>
      {hint && <div className="text-[11px] text-ink-muted">{hint}</div>}
    </div>
    {lines.map((l, i) => (
      <div key={i} className="flex items-center gap-1.5">
        <input
          value={l}
          maxLength={80}
          onChange={(e) => onChange(lines.map((x, k) => (k === i ? e.target.value : x)))}
          className="flex-1 py-1.5 px-2.5 rounded-lg border border-line bg-surface text-xs font-bold text-ink"
        />
        <button type="button" onClick={() => onChange(lines.filter((_, k) => k !== i))} className="p-1.5 rounded-lg text-rose-700 hover:bg-rose-50 cursor-pointer" aria-label="حذف السطر">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    ))}
    {lines.length < MAX_LINES && (
      <button type="button" onClick={() => onChange([...lines, ''])} className="text-[11px] font-extrabold text-brand-700 cursor-pointer">+ إضافة سطر</button>
    )}
  </div>
);

export const ReceiptSettingsManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const [st, setSt] = useState<ReceiptSettings | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<'dine_in' | 'takeaway' | 'delivery'>('delivery');
  const [urlInput, setUrlInput] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    posService.getReceiptSettings().then(setSt).catch((e) => setMsg({ ok: false, text: e.message || 'تعذر تحميل إعدادات الإيصال' }));
  }, []);

  if (!st) return <p className="text-xs text-ink-muted py-6 text-center">{msg ? msg.text : 'جاري التحميل...'}</p>;

  const set = (patch: Partial<ReceiptSettings>) => setSt({ ...st, ...patch });
  const autoHeader = st.header_lines === null;
  const branch = st.branch || {};
  const sampleData = { ...SAMPLE[preview], branch: { name: branch.name || 'MR DONUTS', phone: branch.phone, address: branch.address } };

  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const saved = await posService.saveReceiptSettings({
        ...st,
        header_lines: st.header_lines === null ? null : st.header_lines.map((l) => l.trim()).filter(Boolean),
        footer_lines: st.footer_lines.map((l) => l.trim()).filter(Boolean),
        delivery_footer_lines: st.delivery_footer_lines.map((l) => l.trim()).filter(Boolean),
      });
      setSt({ ...saved, branch: st.branch });
      await queryClient.invalidateQueries({ queryKey: RECEIPT_SETTINGS_KEY });
      setMsg({ ok: true, text: 'تم حفظ إعدادات الإيصال. هتظهر على كل الإيصالات الجديدة.' });
    } catch (e: any) {
      setMsg({ ok: false, text: e.message || 'فشل الحفظ' });
    } finally { setBusy(false); }
  };

  const onFile = async (f?: File | null) => {
    if (!f) return;
    try { set({ logo_url: await fileToLogoDataUrl(f) }); setMsg(null); } catch (e: any) { setMsg({ ok: false, text: e.message }); }
  };

  return (
    <div className="space-y-3">
      <div className="border-b border-line pb-2.5">
        <h3 className="text-sm font-extrabold text-ink">إعدادات إيصال العميل</h3>
        <p className="text-[11px] text-ink-muted">اللوجو والنصوص الثابتة على إيصال الصالة والتيك أواي والديليفري. الإعدادات خاصة بالفرع الحالي.</p>
      </div>
      {msg && (
        <div className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${msg.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
          {msg.ok ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}<span>{msg.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4 items-start">
        <div className="space-y-4">
          <section className="space-y-2 p-3 rounded-xl border border-line">
            <div className="text-xs font-extrabold text-ink">اللوجو</div>
            <div className="flex items-center gap-3">
              <div className="w-20 h-20 rounded-lg border border-dashed border-line bg-white flex items-center justify-center overflow-hidden">
                {st.logo_url ? <img src={st.logo_url} alt="" className="max-w-full max-h-full" /> : <ImagePlus className="w-6 h-6 text-ink-muted" />}
              </div>
              <div className="flex-1 space-y-1.5">
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => fileRef.current?.click()} className="px-3 py-1.5 rounded-lg bg-brand-700 text-white text-[11px] font-extrabold cursor-pointer">رفع صورة</button>
                  {st.logo_url && (
                    <button type="button" onClick={() => set({ logo_url: null })} className="px-3 py-1.5 rounded-lg border border-line text-[11px] font-bold text-rose-700 cursor-pointer">إزالة</button>
                  )}
                  <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" data-testid="logo-file" onChange={(e) => onFile(e.target.files?.[0])} />
                </div>
                <div className="flex gap-1.5">
                  <input
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="أو الصق رابط الصورة (https://...)"
                    dir="ltr"
                    className="flex-1 py-1.5 px-2.5 rounded-lg border border-line bg-surface text-[11px] text-ink"
                  />
                  <button
                    type="button"
                    onClick={() => { if (/^https?:\/\//i.test(urlInput.trim())) { set({ logo_url: urlInput.trim() }); setUrlInput(''); setMsg(null); } else setMsg({ ok: false, text: 'الرابط لازم يبدأ بـ http:// أو https://' }); }}
                    className="px-3 py-1.5 rounded-lg border border-line text-[11px] font-extrabold text-ink cursor-pointer"
                  >استخدام</button>
                </div>
                <p className="text-[10px] text-ink-muted">الصورة المرفوعة بتتصغر وتتحفظ مع الإعدادات. على الطابعة الحرارية بتتطبع أبيض وأسود.</p>
              </div>
            </div>
            <div className="flex items-center gap-4 pt-1">
              <label className="flex items-center gap-1.5 text-xs font-bold text-ink cursor-pointer">
                <input type="checkbox" checked={st.show_logo} onChange={(e) => set({ show_logo: e.target.checked })} /> إظهار اللوجو على الإيصال
              </label>
              <label className="flex items-center gap-1.5 text-xs font-bold text-ink">
                العرض
                <input type="range" min={10} max={60} value={st.logo_width_mm} onChange={(e) => set({ logo_width_mm: Number(e.target.value) })} />
                <span className="font-mono">{st.logo_width_mm} مم</span>
              </label>
            </div>
          </section>

          <section className="space-y-2 p-3 rounded-xl border border-line">
            <div>
              <div className="text-xs font-extrabold text-ink">اسم الإيصال</div>
              <input
                value={st.brand_name || ''}
                maxLength={60}
                placeholder={branch.name || 'MR DONUTS'}
                onChange={(e) => set({ brand_name: e.target.value || null })}
                className="mt-1 w-full py-1.5 px-2.5 rounded-lg border border-line bg-surface text-xs font-bold text-ink"
              />
              <div className="text-[10px] text-ink-muted mt-0.5">فاضي = اسم الفرع.</div>
            </div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-ink cursor-pointer">
              <input
                type="checkbox"
                checked={autoHeader}
                onChange={(e) => set({ header_lines: e.target.checked ? null : [branch.address, branch.phone ? `تليفون: ${branch.phone}` : ''].filter(Boolean) as string[] })}
              />
              عنوان وتليفون الفرع تلقائي (من بيانات الفرع)
            </label>
            {!autoHeader && (
              <LinesEditor label="سطور أعلى الإيصال (العنوان، التليفون...)" lines={st.header_lines || []} onChange={(l) => set({ header_lines: l })} />
            )}
          </section>

          <section className="space-y-3 p-3 rounded-xl border border-line">
            <LinesEditor label="سطور أسفل كل إيصال" hint="مثال: شكراً لزيارتكم" lines={st.footer_lines} onChange={(l) => set({ footer_lines: l })} />
            <LinesEditor label="سطور إضافية لإيصال الديليفري فقط" hint="مثال: نتمنى لكم وجبة سعيدة" lines={st.delivery_footer_lines} onChange={(l) => set({ delivery_footer_lines: l })} />
          </section>

          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={save} className="px-5 py-2 rounded-xl bg-brand-700 hover:bg-brand-800 disabled:opacity-60 text-white font-extrabold text-xs cursor-pointer">
              {busy ? 'جاري الحفظ...' : 'حفظ'}
            </button>
            <button type="button" onClick={() => setSt({ ...DEFAULT_RECEIPT_SETTINGS, branch: st.branch })} className="px-4 py-2 rounded-xl border border-line text-xs font-bold text-ink cursor-pointer">
              رجوع للافتراضي
            </button>
          </div>
        </div>

        <div className="lg:sticky lg:top-2 space-y-2">
          <div className="flex gap-1">
            {(['dine_in', 'takeaway', 'delivery'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setPreview(t)}
                className={`flex-1 py-1.5 rounded-lg text-[11px] font-extrabold cursor-pointer border ${preview === t ? 'bg-brand-700 text-white border-brand-700' : 'border-line text-ink'}`}
              >
                {t === 'dine_in' ? 'صالة' : t === 'takeaway' ? 'تيك أواي' : 'ديليفري'}
              </button>
            ))}
          </div>
          <div className="bg-white rounded-lg border border-line mx-auto overflow-hidden" style={{ width: '80mm', padding: '4mm' }} data-testid="receipt-preview">
            <ThermalReceiptDoc data={sampleData} settings={st} />
          </div>
          <p className="text-[10px] text-ink-muted text-center">معاينة مباشرة، بيانات الطلب تجريبية.</p>
        </div>
      </div>
    </div>
  );
};
