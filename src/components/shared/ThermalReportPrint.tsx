import React from 'react';

/**
 * تخطيط طباعة التقارير على طابعة حرارية 80mm.
 * يُستخدم مرتين: معاينة على الشاشة داخل مودال، وجذر طباعة مخفي
 * (portal على body) تظهره قواعد @media print في index.css وحدها.
 * كل التنسيق في classes ‏.tp-*‏ حتى تتطابق المعاينة مع المطبوع.
 */

const fmtNum = (n: unknown): string =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(
    Math.round(Number(n) || 0),
  );

const fmtDT = (iso?: string | null): string => {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('ar-EG-u-nu-latn', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return '—';
  }
};

const ORDER_TYPE_LABELS: Record<string, string> = {
  delivery: 'ديليفري',
  dine_in: 'صالة',
  takeaway: 'تيك أواي',
  pickup: 'استلام',
};
const orderTypeLabel = (t: string): string => ORDER_TYPE_LABELS[t] || t;

const Row: React.FC<{ name: React.ReactNode; value: React.ReactNode; bold?: boolean }> = ({
  name,
  value,
  bold,
}) => (
  <div className={bold ? 'tp-row tp-bold' : 'tp-row'}>
    <span className="tp-name">{name}</span>
    <span className="tp-num">{value}</span>
  </div>
);

export interface ThermalReportDocProps {
  kind: 'sales' | 'items';
  shiftReport?: any;
  salesReport?: any;
  shift?: { opened_at?: string; status?: string } | null;
  printedAt?: Date;
  sauceReport?: any;
}

export const ThermalReportDoc: React.FC<ThermalReportDocProps> = ({
  kind,
  shiftReport,
  salesReport,
  shift,
  printedAt = new Date(),
  sauceReport,
}) => (
  <div className="tp-doc" dir="rtl">
    <div className="tp-center tp-brand">MR DONUTS</div>
    <div className="tp-center tp-title">
      {kind === 'sales' ? 'تقرير المبيعات — نهاية الشفت' : 'تقرير الأصناف'}
    </div>
    {shift?.opened_at && (
      <div className="tp-center tp-small">
        شفت: {fmtDT(shift.opened_at)}
        {shift.status === 'open' ? ' (مفتوح)' : ''}
      </div>
    )}
    <div className="tp-center tp-small">وقت الطباعة: {fmtDT(printedAt.toISOString())}</div>
    <div className="tp-sep" />
    {kind === 'sales' ? <SalesBody r={shiftReport} /> : <ItemsBody r={salesReport} sauces={sauceReport} />}
    <div className="tp-sep" />
    <div className="tp-center tp-small">نهاية التقرير</div>
  </div>
);

const SalesBody: React.FC<{ r: any }> = ({ r }) => {
  if (!r) return <div className="tp-center tp-small">لا توجد بيانات</div>;
  const o = r.orders || {};
  return (
    <>
      <Row name="عدد الأوردرات" value={fmtNum(o.count)} />
      <Row name="أوردرات ملغية" value={fmtNum(r.cancelled_orders)} />
      <div className="tp-sep" />
      <Row name="الإجمالي قبل الخصم" value={fmtNum(o.subtotal)} />
      <Row name="الخصومات" value={fmtNum(o.discounts)} />
      {Number(o.tax) > 0 && <Row name="الضريبة" value={fmtNum(o.tax)} />}
      {Number(o.delivery_fees) > 0 && <Row name="رسوم التوصيل" value={fmtNum(o.delivery_fees)} />}
      <div className="tp-grand tp-row">
        <span>صافي المبيعات</span>
        <span className="tp-num">{fmtNum(o.net_total)}</span>
      </div>

      {(r.orders_by_type || []).length > 0 && (
        <>
          <div className="tp-sec">حسب نوع الطلب</div>
          {(r.orders_by_type || []).map((t: any) => (
            <Row
              key={t.type}
              name={`${orderTypeLabel(t.type)} (${fmtNum(t.count)})`}
              value={fmtNum(t.total)}
            />
          ))}
          <div className="tp-sep" />
        </>
      )}

      {(r.payments_by_method || []).length > 0 && (
        <>
          <div className="tp-sec">طرق الدفع</div>
          {(r.payments_by_method || []).map((p: any) => (
            <Row
              key={p.method}
              name={`${p.method} (${fmtNum(p.count)})`}
              value={fmtNum(p.total)}
            />
          ))}
          <div className="tp-sep" />
        </>
      )}

      <div className="tp-sec">الدرج</div>
      <Row name="عهدة أول الشفت" value={fmtNum(r.opening_cash)} />
      <Row name="صافي كاش المبيعات" value={fmtNum(r.net_cash)} />
      <Row name="حركات داخل" value={fmtNum(r.movements_in)} />
      <Row name="حركات خارج" value={fmtNum(r.movements_out)} />
      {r.expected_cash != null && <Row name="المتوقع في الدرج" value={fmtNum(r.expected_cash)} />}
      {r.counted_cash != null && <Row name="المعدود فعلياً" value={fmtNum(r.counted_cash)} />}
      {r.cash_difference != null && (
        <Row name="فرق الدرج" value={fmtNum(r.cash_difference)} bold />
      )}
    </>
  );
};

const ItemsBody: React.FC<{ r: any; sauces?: any }> = ({ r, sauces }) => {
  if (!r) return <div className="tp-center tp-small">لا توجد بيانات</div>;
  const boxes: any[] = r.donut_boxes || [];
  const pieces: any[] = r.donut_pieces_by_type || [];
  const consumption: any[] = sauces?.consumption || [];
  const missing: any[] = sauces?.missing_recipes || [];
  const unmapped: any[] = sauces?.unmapped_options || [];
  const items: any[] = r.items || [];
  const totalRevenue =
    boxes.reduce((s, b) => s + (Number(b.revenue) || 0), 0) +
    items.reduce((s, it) => s + (Number(it.revenue) || 0), 0);

  // تجميع الأصناف حسب القسم
  const byDept = new Map<string, any[]>();
  for (const it of items) {
    const d = it.department || 'أخرى';
    if (!byDept.has(d)) byDept.set(d, []);
    byDept.get(d)!.push(it);
  }

  return (
    <>
      {boxes.length > 0 && (
        <>
          <div className="tp-sec">البوكسات</div>
          <div className="tp-row tp-head">
            <span className="tp-grow">البوكس</span>
            <span className="tp-num">عدد</span>
            <span className="tp-num tp-w-amt">مبيعات</span>
          </div>
          {boxes.map((b: any) => (
            <div className="tp-row" key={b.name}>
              <span className="tp-grow">{b.name}</span>
              <span className="tp-num">{fmtNum(b.boxes)}</span>
              <span className="tp-num tp-w-amt">{fmtNum(b.revenue)}</span>
            </div>
          ))}
          <div className="tp-sep" />
        </>
      )}

      {pieces.length > 0 && (
        <>
          <div className="tp-sec">قطع الدونتس حسب النوع</div>
          {pieces.map((t: any) => (
            <Row
              key={t.name}
              name={t.name}
              value={`${fmtNum(t.pieces)} قطعة`}
            />
          ))}
          <div className="tp-sep" />
        </>
      )}

      {[...byDept.entries()].map(([dept, list]) => (
        <React.Fragment key={dept}>
          <div className="tp-sec">{dept}</div>
          {list.map((it: any, i: number) => (
            <div className="tp-row" key={`${it.name}-${i}`}>
              <span className="tp-grow">
                {it.name}
                {it.size ? ` (${it.size})` : ''}
              </span>
              <span className="tp-num">{fmtNum(it.quantity)}</span>
              <span className="tp-num tp-w-amt">{fmtNum(it.revenue)}</span>
            </div>
          ))}
        </React.Fragment>
      ))}

      {consumption.length > 0 && (
        <>
          <div className="tp-sep" />
          <div className="tp-sec">استهلاك الصوصات (من الرسبي)</div>
          {consumption.map((g: any) => (
            <Row
              key={g.ingredient}
              name={g.ingredient}
              value={`${fmtNum(g.total_consumed)} ${g.unit}`}
            />
          ))}
        </>
      )}
      {missing.length > 0 && (
        <div className="tp-small">بدون رسبي (خارج الاستهلاك): {missing.join('، ')}</div>
      )}
      {unmapped.length > 0 && (
        <div className="tp-small">صوصات بدون كمية بالرسبي: {unmapped.join('، ')}</div>
      )}

      <div className="tp-grand tp-row">
        <span>إجمالي إيراد الأصناف</span>
        <span className="tp-num">{fmtNum(totalRevenue)}</span>
      </div>
    </>
  );
};
