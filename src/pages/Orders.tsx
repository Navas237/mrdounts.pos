import React, { useCallback, useEffect, useState } from 'react';
import { posService, isPosDemoMode, OrderListItem, PaymentMethod } from '@/services/pos.service';
import { usePermissions } from '@/hooks/usePermissions';
import { formatCurrency } from '@/utils/formatters';
import {
  ClipboardList,
  Printer,
  Receipt,
  Pencil,
  X,
  RefreshCw,
  AlertCircle,
  Banknote,
  CreditCard,
  Trash2,
  Plus,
  Minus,
} from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  active: 'شغال',
  delivered: 'مسلّم',
  cancelled: 'ملغي',
};

const TYPE_LABELS: Record<string, string> = {
  dine_in: 'صالة',
  takeaway: 'تيك أواي',
  delivery: 'ديليفري',
  pickup: 'استلام',
};

export const Orders: React.FC = () => {
  const { hasActionPermission } = usePermissions();
  const canReprint = hasActionPermission('order.reprint');
  const canEdit = hasActionPermission('order.edit');

  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<OrderListItem | null>(null);
  const [editing, setEditing] = useState<OrderListItem | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const list = await posService.listOrders(null, statusFilter);
      setOrders(list);
    } catch (err: any) {
      setError(err.message || 'فشل تحميل الطلبات');
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener('mrdonuts:order-created', handler);
    return () => window.removeEventListener('mrdonuts:order-created', handler);
  }, [load]);

  const handleReprint = async (order: OrderListItem) => {
    setActionMessage(null);
    try {
      const res = await posService.reprintOrder(order.id);
      setActionMessage(`تم إرسال ${res.labels_created} ملصق للطباعة للأوردر #${order.order_number}`);
    } catch (err: any) {
      setActionMessage(err.message || 'فشل إعادة الطباعة');
    }
  };

  const handleReprintReceipt = async (order: OrderListItem) => {
    setActionMessage(null);
    try {
      await posService.reprintReceipt(order.id);
      setActionMessage(`تم إرسال إيصال الأوردر #${order.order_number} لطابعة الإيصالات`);
    } catch (err: any) {
      setActionMessage(err.message || 'فشل إعادة طباعة الإيصال');
    }
  };

  return (
    <div className="space-y-3.5">
      {/* الترويسة والفلاتر */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-line bg-surface p-3.5 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-800 flex items-center justify-center">
            <ClipboardList className="w-4 h-4 text-brand-700" />
          </div>
          <div>
            <h2 className="font-black text-sm sm:text-base text-ink">الطلبات</h2>
            {isPosDemoMode && (
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">بيانات تجريبية للعرض</span>
            )}
            <p className="text-[11px] text-ink-muted">عرض كل الطلبات وإعادة الطباعة والتعديل</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {[null, 'active', 'delivered', 'cancelled'].map((s) => (
            <button
              key={s || 'all'}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                statusFilter === s
                  ? 'bg-brand-700 text-white border-brand-700'
                  : 'bg-surface-2/50 text-ink border-line hover:bg-surface-2'
              }`}
            >
              {s === null ? 'الكل' : STATUS_LABELS[s]}
            </button>
          ))}
          <button
            type="button"
            onClick={load}
            className="p-1.5 rounded-lg border border-line text-ink-muted hover:text-ink cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="p-2.5 rounded-xl border border-brand-200 bg-brand-50 text-brand-900 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* قائمة الطلبات */}
      {isLoading ? (
        <div className="py-16 text-center text-xs text-ink-muted bg-surface rounded-xl border border-line">
          جاري تحميل الطلبات...
        </div>
      ) : error ? (
        <div className="py-16 text-center text-xs text-rose-700 bg-surface rounded-xl border border-rose-200">
          {error}
        </div>
      ) : orders.length === 0 ? (
        <div className="py-16 text-center text-xs text-ink-muted bg-surface rounded-xl border border-dashed border-line">
          لا توجد طلبات مطابقة
        </div>
      ) : (
        <div className="rounded-xl border border-line bg-surface shadow-2xs overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-surface-2/60 text-ink-muted border-b border-line">
                <th className="py-2.5 px-3 text-right font-extrabold">رقم</th>
                <th className="py-2.5 px-3 text-right font-extrabold">النوع</th>
                <th className="py-2.5 px-3 text-right font-extrabold">العميل</th>
                <th className="py-2.5 px-3 text-right font-extrabold">الإجمالي</th>
                <th className="py-2.5 px-3 text-right font-extrabold">الحالة</th>
                <th className="py-2.5 px-3 text-right font-extrabold">الوقت</th>
                <th className="py-2.5 px-3 text-right font-extrabold">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-line/60 last:border-0 hover:bg-surface-2/40">
                  <td className="py-2.5 px-3 font-mono font-black text-brand-700">#{o.order_number}</td>
                  <td className="py-2.5 px-3 font-bold text-ink">{TYPE_LABELS[o.order_type] || o.order_type}</td>
                  <td className="py-2.5 px-3 text-ink">{o.customer_name || '—'}</td>
                  <td className="py-2.5 px-3 font-mono font-extrabold text-ink">{formatCurrency(o.total)}</td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        o.status === 'active'
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : o.status === 'delivered'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-rose-50 text-rose-800 border border-rose-200'
                      }`}
                    >
                      {STATUS_LABELS[o.status] || o.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-ink-muted font-mono" dir="ltr">
                    {new Date(o.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setSelected(o)}
                        className="px-2 py-1 rounded-lg border border-line text-[11px] font-bold text-ink hover:bg-surface-2 cursor-pointer"
                      >
                        تفاصيل
                      </button>
                      {canReprint && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleReprintReceipt(o)}
                            title="إعادة طباعة إيصال العميل"
                            className="p-1.5 rounded-lg border border-line text-ink-muted hover:text-brand-700 hover:bg-brand-50 cursor-pointer"
                          >
                            <Receipt className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReprint(o)}
                            title="إعادة طباعة ملصقات الأقسام"
                            className="p-1.5 rounded-lg border border-line text-ink-muted hover:text-brand-700 hover:bg-brand-50 cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                      {canEdit && o.status === 'active' && (
                        <button
                          type="button"
                          onClick={() => setEditing(o)}
                          title="تعديل الطلب"
                          className="p-1.5 rounded-lg border border-line text-ink-muted hover:text-amber-700 hover:bg-amber-50 cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* مودال التفاصيل */}
      {selected && (
        <OrderDetailsModal order={selected} onClose={() => setSelected(null)} />
      )}

      {/* مودال التعديل */}
      {editing && (
        <OrderEditModal
          order={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------
// مودال تفاصيل الطلب
// ---------------------------------------------------------------------
const OrderDetailsModal: React.FC<{ order: OrderListItem; onClose: () => void }> = ({ order, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
      <div className="bg-surface border border-line rounded-2xl max-w-lg w-full p-4 sm:p-5 shadow-2xl space-y-3.5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-line pb-2.5">
          <h4 className="font-extrabold text-sm text-ink">
            طلب #{order.order_number} — {TYPE_LABELS[order.order_type] || order.order_type}
          </h4>
          <button type="button" onClick={onClose} className="p-1 rounded text-ink-muted hover:text-ink cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-1.5">
          {order.items.map((it) => (
            <div
              key={it.id}
              className={`flex items-center justify-between text-xs rounded-lg px-2.5 py-2 border ${
                it.status === 'cancelled' ? 'border-rose-200 bg-rose-50/50 line-through opacity-60' : 'border-line bg-surface-2/40'
              }`}
            >
              <span className="font-bold text-ink">
                {it.quantity > 1 ? `${it.quantity}x ` : ''}
                {it.item_name}
                {it.size_name ? ` (${it.size_name})` : ''}
                {it.pieces ? ` — ${it.pieces} قطعة` : ''}
              </span>
              <span className="font-mono font-extrabold text-ink">{formatCurrency(it.line_total)}</span>
            </div>
          ))}
        </div>

        <div className="space-y-1 pt-2 border-t border-line text-xs">
          {order.payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between text-ink-muted">
              <span className="flex items-center gap-1.5">
                {p.is_cash ? <Banknote className="w-3.5 h-3.5" /> : <CreditCard className="w-3.5 h-3.5" />}
                {p.method_name}
              </span>
              <span className="font-mono font-bold text-ink">{formatCurrency(p.amount)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between pt-1.5 border-t border-line text-sm font-black text-brand-700">
            <span>الإجمالي:</span>
            <span className="font-mono">{formatCurrency(order.total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// مودال تعديل الطلب: إلغاء أصناف لم تبدأ + كميات + مدفوعات + ملاحظات
// ---------------------------------------------------------------------
const OrderEditModal: React.FC<{
  order: OrderListItem;
  onClose: () => void;
  onSaved: () => void;
}> = ({ order, onClose, onSaved }) => {
  const [cancelIds, setCancelIds] = useState<string[]>([]);
  const [qtyChanges, setQtyChanges] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState(order.notes || '');
  const [payments, setPayments] = useState(order.payments.map((p) => ({ ...p })));
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    posService.listPaymentMethods().then(setMethods).catch(() => setMethods([]));
  }, []);

  const activeItems = order.items.filter((it) => it.status !== 'cancelled' && !cancelIds.includes(it.id));

  const newSubtotal = activeItems.reduce((sum, it) => {
    const q = qtyChanges[it.id] ?? it.quantity;
    const unitWithExtras = it.unit_price + (it.extras_total || 0);
    return sum + unitWithExtras * q;
  }, 0);
  const estimatedTotal = newSubtotal - order.discount_amount + order.tax_amount + order.delivery_fee;
  const paidSum = payments.reduce((sum, p) => sum + p.amount, 0);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await posService.editOrder(order.id, {
        notes,
        cancel_item_ids: cancelIds.length > 0 ? cancelIds : undefined,
        quantity_changes:
          Object.keys(qtyChanges).length > 0
            ? Object.entries(qtyChanges).map(([item_id, quantity]) => ({ item_id, quantity }))
            : undefined,
        payments: payments.map((p) => ({
          method_name: p.method_name,
          is_cash: p.is_cash,
          amount: p.amount,
          reference: p.reference,
        })),
      });
      window.dispatchEvent(new CustomEvent('mrdonuts:order-created'));
      onSaved();
    } catch (err: any) {
      setError(err.message || 'فشل حفظ التعديل');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
      <div className="bg-surface border border-line rounded-2xl max-w-xl w-full p-4 sm:p-5 shadow-2xl space-y-3.5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-line pb-2.5">
          <div>
            <h4 className="font-extrabold text-sm text-ink">تعديل طلب #{order.order_number}</h4>
            <p className="text-[11px] text-ink-muted">المسموح: أصناف لم يبدأ تجهيزها فقط</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded text-ink-muted hover:text-ink cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* الأصناف */}
        <div className="space-y-1.5">
          {order.items.map((it) => {
            const isCancelled = it.status === 'cancelled' || cancelIds.includes(it.id);
            const canTouch = it.status === 'pending' && !it.pieces;
            const qty = qtyChanges[it.id] ?? it.quantity;
            return (
              <div
                key={it.id}
                className={`flex items-center justify-between text-xs rounded-lg px-2.5 py-2 border ${
                  isCancelled ? 'border-rose-200 bg-rose-50/50 opacity-60' : 'border-line bg-surface-2/40'
                }`}
              >
                <span className={`font-bold text-ink ${isCancelled ? 'line-through' : ''}`}>
                  {it.item_name}
                  {it.size_name ? ` (${it.size_name})` : ''}
                  {it.status !== 'pending' && it.status !== 'cancelled' && (
                    <span className="text-[10px] text-amber-700 font-extrabold mr-1"> (بدأ التجهيز)</span>
                  )}
                </span>
                <span className="flex items-center gap-1.5">
                  {canTouch && !isCancelled ? (
                    <span className="flex items-center gap-1" dir="ltr">
                      <button
                        type="button"
                        onClick={() => qty > 1 && setQtyChanges({ ...qtyChanges, [it.id]: qty - 1 })}
                        className="p-1 rounded border border-line text-ink-muted hover:text-ink cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="font-mono font-extrabold text-ink w-6 text-center">{qty}</span>
                      <button
                        type="button"
                        onClick={() => setQtyChanges({ ...qtyChanges, [it.id]: qty + 1 })}
                        className="p-1 rounded border border-line text-ink-muted hover:text-ink cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </span>
                  ) : (
                    <span className="font-mono font-bold text-ink">{it.quantity}x</span>
                  )}
                  {it.status === 'pending' && !isCancelled && (
                    <button
                      type="button"
                      onClick={() => setCancelIds([...cancelIds, it.id])}
                      title="إلغاء الصنف"
                      className="p-1 rounded text-stone-400 hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {cancelIds.includes(it.id) && (
                    <button
                      type="button"
                      onClick={() => setCancelIds(cancelIds.filter((id) => id !== it.id))}
                      className="text-[10px] font-bold text-brand-700 hover:underline cursor-pointer"
                    >
                      تراجع
                    </button>
                  )}
                </span>
              </div>
            );
          })}
        </div>

        {/* ملاحظات */}
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="ملاحظات الطلب"
          className="w-full py-1.5 px-2.5 rounded-lg border border-line bg-surface text-xs font-bold text-ink focus:outline-none focus:border-brand-700"
        />

        {/* المدفوعات */}
        <div className="space-y-1.5 pt-2 border-t border-line">
          <span className="text-xs font-extrabold text-ink block">المدفوعات:</span>
          {payments.map((p, idx) => (
            <div key={p.id || idx} className="flex items-center gap-1.5 text-xs">
              <span className="font-bold text-ink flex-1">{p.method_name}</span>
              <input
                type="number"
                min="0"
                step="0.25"
                value={p.amount}
                onChange={(e) => {
                  const next = [...payments];
                  next[idx] = { ...p, amount: Number(e.target.value) };
                  setPayments(next);
                }}
                dir="ltr"
                className="w-24 py-1 px-2 rounded-lg border border-line bg-surface text-xs font-mono font-bold text-ink text-center"
              />
              <button
                type="button"
                onClick={() => setPayments(payments.filter((_, i) => i !== idx))}
                className="p-1 rounded text-stone-400 hover:text-rose-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {methods.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {methods.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() =>
                    setPayments([
                      ...payments,
                      { id: `new-${Date.now()}-${m.id}`, method_name: m.name, is_cash: m.is_cash, amount: 0 },
                    ])
                  }
                  className="px-2 py-1 rounded-lg border border-line bg-surface-2/50 text-[11px] font-bold text-ink hover:bg-surface-2 cursor-pointer"
                >
                  + {m.name}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between text-[11px] pt-1">
            <span className="text-ink-muted">
              الإجمالي التقريبي بعد التعديل: <strong className="font-mono">{formatCurrency(estimatedTotal)}</strong>
            </span>
            <span className={paidSum + 0.01 < estimatedTotal ? 'text-rose-700 font-bold' : 'text-emerald-700 font-bold'}>
              المدفوع: {formatCurrency(paidSum)}
            </span>
          </div>
        </div>

        {error && (
          <div className="p-2.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center gap-2 pt-2 border-t border-line">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || paidSum + 0.01 < estimatedTotal}
            className="flex-1 py-2 px-4 rounded-xl bg-brand-700 hover:bg-brand-800 text-white font-extrabold text-xs transition-colors disabled:opacity-40 cursor-pointer"
          >
            {isSaving ? 'جاري الحفظ...' : 'حفظ التعديل'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="py-2 px-4 rounded-xl border border-line text-ink font-bold text-xs hover:bg-surface-2 cursor-pointer"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
};
