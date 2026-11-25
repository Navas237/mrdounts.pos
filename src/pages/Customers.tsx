import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCustomers } from '@/hooks/useCustomers';
import { useCart } from '@/hooks/useCart';
import { formatCurrency } from '@/utils/formatters';
import {
  Users,
  Search,
  PhoneCall,
  MapPin,
  Plus,
  PhoneIncoming,
  ArrowLeft,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

export const Customers: React.FC = () => {
  const {
    customers,
    isLoading,
    period,
    setPeriod,
    sortBy,
    setSortBy,
    incomingCall,
    simulateIncomingCall,
    dismissIncomingCall,
  } = useCustomers();

  const { setCustomer, setOrderType } = useCart();
  const navigate = useNavigate();

  const handleConvertCallToDelivery = (phone: string, name?: string) => {
    setOrderType('delivery');
    setCustomer({
      phone,
      name: name || 'عميل جديد (كول سنتر)',
      delivery_fee: 20,
    });
    dismissIncomingCall();
    navigate('/cashier');
  };

  if (isLoading) {
    return <div className="p-8 text-center text-xs text-ink-muted">جاري تحميل بيانات العملاء...</div>;
  }

  return (
    <div className="space-y-3.5">
      {/* هيدر شاشة العملاء وتنبيه الكول سنتر المدمج */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 sm:p-3.5 rounded-2xl bg-surface border border-line shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold shadow-2xs shrink-0">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h1 className="font-extrabold text-sm sm:text-base text-ink">
              سجل العملاء (CRM) وتكامل الكول سنتر
            </h1>
          </div>
        </div>

        {/* زر محاكاة مكالمة واردة */}
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<PhoneCall className="w-3.5 h-3.5 text-purple-600" />}
            onClick={() => simulateIncomingCall('01099887766')}
            title="محاكاة اتصال هاتفي وارد من جهاز أندرويد الكول سنتر"
          >
            تجربة رنين مكالمة واردة
          </Button>
        </div>
      </div>

      {/* نافذة المكالمة الواردة الفورية */}
      {incomingCall && (
        <div className="p-3 sm:p-3.5 rounded-2xl bg-linear-to-l from-purple-900 to-brand-800 text-white shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3 border border-purple-400/30 animate-in fade-in slide-in-from-top-3">
          <div className="flex items-center gap-2.5 text-right">
            <div className="w-10 h-10 rounded-xl bg-white/20 text-white flex items-center justify-center animate-bounce shrink-0">
              <PhoneIncoming className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-purple-200 font-bold">
                مكالمة واردة الآن على هاتف الفرع (Android Webhook)
              </div>
              <div className="text-base font-black tracking-tight" dir="ltr">
                {incomingCall.caller_number}
              </div>
              {incomingCall.caller_name ? (
                <span className="text-xs text-emerald-300 font-bold block">
                  العميل: {incomingCall.caller_name}
                </span>
              ) : (
                <span className="text-xs text-purple-200 block">رقم جديد غير مسجل</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <button
              onClick={() =>
                handleConvertCallToDelivery(incomingCall.caller_number, incomingCall.caller_name)
              }
              className="flex-1 sm:flex-none py-2 px-4 rounded-xl bg-white text-brand-900 hover:bg-purple-50 font-black text-xs shadow-md transition-all flex items-center justify-center gap-1.5 touch-target"
            >
              <span>تحويل لأوردر ديليفري</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={dismissIncomingCall}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="إغلاق التنبيه"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
 
      {/* شريط البحث والفلاتر والترتيب المدمج */}
      <div className="p-3 rounded-xl bg-surface border border-line flex flex-col md:flex-row items-center justify-between gap-2.5 shadow-2xs">
        {/* حقل البحث */}
        <div className="relative w-full md:w-72">
          <Search className="w-3.5 h-3.5 absolute right-3 top-2.5 text-ink-muted" />
          <input
            type="text"
            placeholder="بحث برقم الهاتف أو اسم العميل..."
            className="w-full pr-8 pl-3 py-1.5 rounded-lg border border-line bg-surface-2 text-xs focus:outline-none focus:border-brand-700 transition-colors"
          />
        </div>

        {/* فلاتر الفترة الزمنية */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar w-full md:w-auto">
          <span className="text-xs font-bold text-ink-muted ml-1">الفترة:</span>
          {(['all', '30days', '7days', 'today'] as const).map((p) => {
            const labels = {
              all: 'الكل',
              '30days': '30 يوم',
              '7days': '7 أيام',
              today: 'اليوم',
            };
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`py-1 px-2.5 rounded-lg text-xs font-bold transition-all ${
                  period === p
                    ? 'bg-brand-700 text-white shadow-2xs font-black'
                    : 'bg-surface-2 text-ink-muted hover:text-ink'
                }`}
              >
                {labels[p]}
              </button>
            );
          })}
        </div>

        {/* الترتيب */}
        <div className="flex items-center gap-1">
          <span className="text-xs font-bold text-ink-muted ml-1">الترتيب:</span>
          <button
            type="button"
            onClick={() => setSortBy('total')}
            className={`py-1 px-2.5 rounded-lg text-xs font-bold transition-all ${
              sortBy === 'total'
                ? 'bg-brand-700 text-white shadow-2xs font-black'
                : 'bg-surface-2 text-ink-muted hover:text-ink'
            }`}
          >
            المشتريات
          </button>
          <button
            type="button"
            onClick={() => setSortBy('orders')}
            className={`py-1 px-2.5 rounded-lg text-xs font-bold transition-all ${
              sortBy === 'orders'
                ? 'bg-brand-700 text-white shadow-2xs font-black'
                : 'bg-surface-2 text-ink-muted hover:text-ink'
            }`}
          >
            الأوردرات
          </button>
        </div>
      </div>

      {/* جدول بيانات العملاء عالي الكثافة */}
      <div className="bg-surface rounded-xl border border-line overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-surface-2/70 border-b border-line text-ink-muted font-bold text-xs">
              <tr>
                <th className="p-3">اسم العميل</th>
                <th className="p-3">رقم الموبايل</th>
                <th className="p-3">العنوان المسجل</th>
                <th className="p-3 text-center">الأوردرات</th>
                <th className="p-3 text-left">إجمالي المشتريات</th>
                <th className="p-3 text-center">إجراء سريع</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-ink-muted">
                    لا يوجد عملاء مسجلون حالياً في قاعدة البيانات.
                  </td>
                </tr>
              ) : (
                customers.map((cust) => (
                <tr key={cust.id} className="hover:bg-surface-2/40 transition-colors">
                  <td className="p-3 font-bold text-ink">{cust.name}</td>
                  <td className="p-3 font-mono text-ink-muted text-xs" dir="ltr">
                    {cust.phone}
                  </td>
                  <td className="p-3 text-ink-muted text-xs">
                    {cust.default_address ? (
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-brand-700 shrink-0" />
                        <span className="truncate max-w-xs">{cust.default_address}</span>
                      </div>
                    ) : (
                      'â€”'
                    )}
                  </td>
                  <td className="p-3 font-extrabold text-ink text-center">
                    <span className="px-2 py-0.5 rounded-md bg-surface-2 font-mono text-xs">
                      {cust.orders_count}
                    </span>
                  </td>
                  <td className="p-3 font-black text-brand-700 text-left font-mono">
                    {formatCurrency(cust.total_spent)}
                  </td>
                  <td className="p-3 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setOrderType('delivery');
                        setCustomer({
                          phone: cust.phone,
                          name: cust.name,
                          address: cust.default_address,
                          delivery_fee: 20,
                        });
                        navigate('/cashier');
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand-50 hover:bg-brand-700 hover:text-white text-brand-800 font-bold text-xs transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      <span>أوردر ديليفري</span>
                    </button>
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

