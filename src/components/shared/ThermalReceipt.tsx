import React from 'react';
import type { CartItem, SplitPaymentItem } from '@/types/order';
import type { OrderListItem } from '@/services/pos.service';

/**
 * إيصال العميل على طابعة حرارية 80mm، لأنواع الطلب: صالة / تيك أواي / ديليفري (+ استلام).
 * يستخدم نفس classes ‏.tp-*‏ الخاصة بتقارير الطباعة، وجذر portal على body.
 */

export interface ReceiptItem {
  name: string;
  size?: string;
  qty: number;
  unit_price: number;
  line_total: number;
  options: string[];
  piece_lines: string[];
  notes?: string;
}

export interface ReceiptData {
  branch: { name?: string | null; phone?: string | null; address?: string | null };
  order_number: number | string;
  order_type: string;
  created_at: string;
  customer_name?: string;
  customer_phone?: string;
  address?: string;
  zone?: string;
  items: ReceiptItem[];
  subtotal: number;
  discount: number;
  tax: number;
  delivery_fee: number;
  total: number;
  payments: Array<{ method: string; amount: number }>;
  notes?: string;
}

const money = (n: unknown): string => {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: Number.isInteger(v) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(v);
};

const fmtDateTime = (iso: string): string => {
  try {
    return new Intl.DateTimeFormat('ar-EG-u-nu-latn', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return '';
  }
};

const TYPE_LABEL: Record<string, string> = {
  dine_in: 'صالة',
  takeaway: 'تيك أواي',
  delivery: 'ديليفري',
  pickup: 'استلام',
};

const GENERIC_NAMES = ['عميل صالة', 'عميل'];

export interface PieceLike {
  type: 'stuffed' | 'topping_only';
  filling?: string | null;
  topping?: string | null;
}

/** تجميع القطع المتطابقة في سطر واحد: «2× محشي: حشو نوتيلا + توبنج شوكولاتة» */
export function groupPieceLines(typeName: string | undefined, pieces: PieceLike[]): string[] {
  const groups = new Map<string, { n: number; text: string }>();
  for (const p of pieces) {
    const bits: string[] = [];
    if (p.type === 'stuffed') {
      if (p.filling) bits.push(`حشو ${p.filling}`);
      if (p.topping) bits.push(`توبنج ${p.topping}`);
    } else {
      bits.push(p.topping ? p.topping : 'سادة');
    }
    const label = p.type === 'stuffed' ? 'محشي' : typeName || 'عادي';
    const text = `${label}: ${bits.join(' + ') || 'سادة'}`;
    const g = groups.get(text) || { n: 0, text };
    g.n += 1;
    groups.set(text, g);
  }
  return [...groups.values()].map((g) => `${g.n} قطعة ${g.text}`);
}

export function receiptFromCart(args: {
  branch: ReceiptData['branch'];
  orderNumber: number | string;
  orderType: string;
  items: CartItem[];
  customerName?: string;
  customerPhone?: string;
  address?: string;
  subtotal: number;
  discount: number;
  tax: number;
  deliveryFee: number;
  total: number;
  payments: SplitPaymentItem[];
}): ReceiptData {
  return {
    branch: args.branch,
    order_number: args.orderNumber,
    order_type: args.orderType,
    created_at: new Date().toISOString(),
    customer_name: args.customerName,
    customer_phone: args.customerPhone,
    address: args.address,
    items: args.items.map((it) => ({
      name:
        it.item_name ||
        (it.is_donut_box ? `بوكس دونتس (${it.donut_pieces_count || 0} قطعة)` : 'صنف'),
      size: it.size_name,
      qty: it.quantity,
      unit_price: it.unit_price,
      line_total: it.line_total,
      options: (it.options || []).map((o) => o.name),
      piece_lines: groupPieceLines(
        it.donut_type === 'mini' ? 'ميني' : 'عادي',
        (it.donut_pieces || []).map((p) => ({
          type: p.piece_type,
          filling: p.stuffing_sauce_id === 'plain' ? null : p.stuffing_sauce_name,
          topping: p.topping_sauce_name,
        })),
      ),
      notes: it.notes,
    })),
    subtotal: args.subtotal,
    discount: args.discount,
    tax: args.tax,
    delivery_fee: args.deliveryFee,
    total: args.total,
    payments: args.payments.map((p) => ({ method: p.method_name, amount: p.amount })),
  };
}

export function receiptFromOrder(o: OrderListItem, branch: ReceiptData['branch']): ReceiptData {
  const anyO = o as any;
  return {
    branch,
    order_number: o.order_number,
    order_type: o.order_type,
    created_at: o.created_at,
    customer_name: o.customer_name,
    customer_phone: o.customer_phone,
    address: anyO.address_snapshot?.address,
    zone: anyO.delivery_zone_name,
    items: (o.items || [])
      .filter((i) => i.status !== 'cancelled')
      .map((i: any) => ({
        name: i.item_name,
        size: i.size_name,
        qty: i.quantity,
        unit_price: i.unit_price,
        line_total: i.line_total,
        options: (i.options || []).map((x: any) => x.option_name ?? x),
        piece_lines: groupPieceLines(
          i.donut_type_name,
          (i.piece_details || []).map((p: any) => ({
            type: p.kind,
            filling: p.filling,
            topping: p.topping,
          })),
        ),
        notes: i.notes,
      })),
    subtotal: o.subtotal,
    discount: o.discount_amount,
    tax: o.tax_amount,
    delivery_fee: o.delivery_fee,
    total: o.total,
    payments: (o.payments || []).map((p) => ({ method: p.method_name, amount: p.amount })),
    notes: o.notes,
  };
}

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

export const ThermalReceiptDoc: React.FC<{ data: ReceiptData }> = ({ data }) => {
  const type = data.order_type;
  const isDelivery = type === 'delivery';
  const paid = data.payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const change = Math.max(0, Math.round((paid - data.total) * 100) / 100);
  const showName =
    data.customer_name && !GENERIC_NAMES.includes(data.customer_name.trim());
  const cashOnDelivery = isDelivery && data.payments.length === 0;

  return (
    <div className="tp-doc" dir="rtl">
      <div className="tp-center">
        <div className="tp-brand">{data.branch.name || 'MR DONUTS'}</div>
        {data.branch.address && <div className="tp-small">{data.branch.address}</div>}
        {data.branch.phone && <div className="tp-small">تليفون: {data.branch.phone}</div>}
      </div>
      <div className="tp-sep" />

      <div className="tp-center">
        <div className="tp-type">{TYPE_LABEL[type] || type}</div>
        <div className="tp-orderno">#{data.order_number}</div>
        <div className="tp-small">{fmtDateTime(data.created_at)}</div>
      </div>
      <div className="tp-sep" />

      {(showName || data.customer_phone || (isDelivery && (data.address || data.zone))) && (
        <>
          {showName && <Row name="العميل" value={data.customer_name} />}
          {data.customer_phone && <Row name="التليفون" value={<span dir="ltr">{data.customer_phone}</span>} />}
          {isDelivery && data.zone && <Row name="المنطقة" value={data.zone} />}
          {isDelivery && data.address && (
            <div className="tp-addr">
              <span className="tp-bold">العنوان: </span>
              {data.address}
            </div>
          )}
          <div className="tp-sep" />
        </>
      )}

      <div className="tp-row tp-head">
        <span className="tp-grow">الصنف</span>
        <span className="tp-w-qty">كمية</span>
        <span className="tp-w-amt">إجمالي</span>
      </div>
      {data.items.map((it, idx) => (
        <div key={idx} className="tp-item">
          <div className="tp-row">
            <span className="tp-grow tp-bold">
              {it.name}
              {it.size ? ` - ${it.size}` : ''}
            </span>
            <span className="tp-w-qty tp-num">{it.qty}</span>
            <span className="tp-w-amt tp-num">{money(it.line_total)}</span>
          </div>
          {it.qty > 1 && (
            <div className="tp-sub">
              سعر الوحدة {money(it.unit_price)}
            </div>
          )}
          {it.piece_lines.map((l, i) => (
            <div key={`p${i}`} className="tp-sub">
              {l}
            </div>
          ))}
          {it.options.length > 0 && <div className="tp-sub">+ {it.options.join('، ')}</div>}
          {it.notes && <div className="tp-sub">ملاحظة: {it.notes}</div>}
        </div>
      ))}
      <div className="tp-sep" />

      <Row name="المجموع" value={money(data.subtotal)} />
      {Number(data.discount) > 0 && <Row name="الخصم" value={money(data.discount)} />}
      {Number(data.tax) > 0 && <Row name="الضريبة" value={money(data.tax)} />}
      {isDelivery && <Row name="خدمة التوصيل" value={money(data.delivery_fee)} />}
      <div className="tp-grand tp-row">
        <span>{isDelivery ? 'المطلوب من العميل' : 'الإجمالي'}</span>
        <span className="tp-num">{money(data.total)}</span>
      </div>

      {data.payments.length > 0 && (
        <>
          <div className="tp-sec">الدفع</div>
          {data.payments.map((p, i) => (
            <Row key={i} name={p.method} value={money(p.amount)} />
          ))}
          {change > 0 && <Row name="الباقي للعميل" value={money(change)} bold />}
        </>
      )}
      {cashOnDelivery && <div className="tp-center tp-bold">الدفع عند الاستلام</div>}

      {data.notes && (
        <>
          <div className="tp-sep" />
          <div className="tp-small">ملاحظات الطلب: {data.notes}</div>
        </>
      )}
      <div className="tp-sep" />
      <div className="tp-center tp-small">شكراً لزيارتكم</div>
      {isDelivery && <div className="tp-center tp-small">نتمنى لكم وجبة سعيدة</div>}
    </div>
  );
};
